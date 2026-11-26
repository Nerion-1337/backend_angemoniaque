import { heightParts } from './levels.js'; import { walk } from './rules.js'; import { ignite } from './burn.js'; import { terrain } from './terrain.js'; import { tileCost, tileOf, loadTiles } from './tileTypes.js'; import { BLOCKING, occupiableAt } from './buildingCell.js'; import { fail, posOf } from '../lib/db.js';
/** Invocation MONTÉE (characters.riding_summon_id, migration 43) : profil de déplacement d'après son type de monstre. */
const MOUNT_SQL = `SELECT s.*, s.id summon_id, COALESCE(t.size, 1) size, t.model, t.icon, t.locomotion,
    'air' = ANY(COALESCE(t.locomotion, '{land}')) flying, 'water' = ANY(COALESCE(t.locomotion, '{land}')) aquatic, 'land' = ANY(COALESCE(t.locomotion, '{land}')) terrestrial
  FROM characters c JOIN summons s ON s.id=c.riding_summon_id LEFT JOIN monsters t ON t.id=s.monster_id WHERE c.id=$1`;
export const activeMount = async (db: any, id: number) => (await db.query(MOUNT_SQL, [id])).rows[0];
export const isWater = (kind: string) => kind === 'shallow' || kind === 'deep';
/** Acteur courant : l'invocation contrôlée, sinon le héros (monté ou non). */
export async function actor(db: any, ch: any) {
  await loadTiles();   // coûts de case (admin « Cases ») à jour pour stepCost/pathCost, qui restent synchrones
  if (ch.controlled_summon_id) {
    const { rows: [sm] } = await db.query('SELECT * FROM summons WHERE id=$1 AND owner_id=$2', [ch.controlled_summon_id, ch.id]);
    if (sm) { const { rows: [mp] } = await db.query('SELECT * FROM positions WHERE summon_id=$1', [sm.id]); return { sm, mount: null, loco: await summonLoco(db, sm), mp, see: sm.see, range: 1 }; }
  }
  const mount = await activeMount(db, ch.id), mp = await posOf(db, ch.id);
  const b = mp ? await occupiableAt(db, mp.map_id, mp.coord_x, mp.coord_y) : null;   // bâtiment occupé : bonus de vue / portée
  // Hauteur (+1 vision / +1 portée par niveau : terrain, taille de la monture, monture volante = +6) et capacités PASSIVES des sorts
  // de la monture ; ses anciens bonus de vue / portée ne comptent plus (migration 34).
  const height = mp ? heightParts(mp.map_id, mp.coord_x, mp.coord_y, mount) : [], passive = mount ? await mountPassives(db, mount.monster_id) : [];
  const add = (k: 'see' | 'range') => height.reduce((n, p) => n + p.value, 0) + passive.filter(p => p.stat === k).reduce((n, p) => n + p.value, 0) + (b?.[`bonus_${k}`] ?? 0);
  const parts = (k: 'see' | 'range') => [...height, ...passive.filter(p => p.stat === k).map(p => ({ label: `Capacité passive : ${p.label}`, value: p.value, kind: 'buff' })),
    ...(b?.[`bonus_${k}`] ? [{ label: 'Bâtiment occupé', value: b[`bonus_${k}`], kind: 'building' }] : [])];
  return { sm: null, mount, mp, see: ch.see + add('see'), range: ch.range + add('range'), extra: { see: parts('see'), range: parts('range') } };
}
/** Locomotion d'une invocation d'après son type de monstre (null = à pied) : volante → 1 énergie par case, comme une monture volante. */
export async function summonLoco(db: any, sm: any) {
  if (!sm.monster_id) return null;
  const { rows: [t] } = await db.query('SELECT locomotion FROM monsters WHERE id=$1', [sm.monster_id]);
  const l: string[] = t?.locomotion?.length ? t.locomotion : ['land'];
  return { flying: l.includes('air'), aquatic: l.includes('water'), terrestrial: l.includes('land') };
}
/** Effets de caractéristique des sorts PASSIFS du type de la monture (spells.effects.stats, vision / portée). */
export async function mountPassives(db: any, monsterId: number | null) {
  if (!monsterId) return [];
  const { rows } = await db.query("SELECT s.name, s.effects FROM monster_spells ms JOIN spells s ON s.id=ms.spell_id WHERE ms.monster_id=$1 AND ms.mode='passive'", [monsterId]);
  return rows.flatMap((r: any) => (r.effects?.stats ?? []).filter((x: any) => x.stat === 'see' || x.stat === 'range').map((x: any) => ({ stat: x.stat as string, value: Number(x.value) || 0, label: r.name as string })));
}
/** La monture marche-t-elle sur la terre ferme ? (`terrestrial`, migration 25 ; absent = historique : un aquatique ne quitte pas l'eau) */
const onLand = (m: any) => (m ? m.terrestrial ?? !m.aquatic : true);
/** Coût d'une case selon l'acteur (combinaisons terrestre / aérien / aquatique d'une monture) : aérienne = 1 partout ;
 *  aquatique = 1 sur l'eau ; terre ferme interdite si la monture n'est pas terrestre ; sinon (à pied, terrestre) coût du type
 *  de case de CE monde (admin « Cases », défaut KIND_COST), eau profonde = interdite. */
export function stepCost(t: { kind: string; cost: number }, a: any): number {
  const m = a.mount ?? a.loco; if (m?.flying) return 1;   // volant (monture montée ou créature contrôlée) : 1 partout
  if (m?.aquatic && isWater(t.kind)) return 1;
  if (!isWater(t.kind) && !onLand(m)) return Infinity;
  return t.kind === 'deep' ? Infinity : tileCost(a.mp?.map_id, t.kind, t.cost);
}
const blockedMsg = (kind: string, a: any) => (a.mount ?? a.loco) && !onLand(a.mount ?? a.loco) && !isWater(kind) ? 'Une monture aquatique ne quitte pas l’eau' : kind === 'deep' ? 'Eau profonde : un navire, une monture volante ou aquatique est requis' : 'Terrain infranchissable';
/** Paiement d'énergie : 'move' = déplacement (invocation montée), 'mount' = capacité de l'invocation montée, 'action' = énergie du personnage. L'invocation contrôlée paie tout. */
export async function spend(db: any, ch: any, a: any, amount: number, kind: 'move' | 'action' | 'mount' = 'action') {
  if (!amount) return;
  if (a.sm) { if (a.sm.energy_current < amount) fail(409, `Énergie de l'invocation insuffisante (${amount})`); await db.query('UPDATE summons SET energy_current=energy_current-$2 WHERE id=$1', [a.sm.id, amount]); a.sm.energy_current -= amount; }
  else if (a.mount && kind !== 'action') { if (a.mount.energy_current < amount) fail(409, `Énergie de la monture insuffisante (${amount})`); await db.query('UPDATE summons SET energy_current=energy_current-$2 WHERE id=$1', [a.mount.summon_id, amount]); a.mount.energy_current -= amount; }
  else { if (ch.energy_current < amount) fail(409, `Énergie insuffisante (${amount} requis)`); await db.query('UPDATE characters SET energy_current=energy_current-$2 WHERE id=$1', [ch.id, amount]); ch.energy_current -= amount; }
}
/** Énergie divine (coût réglé en admin à côté de l'énergie, 0 par défaut) : toujours payée par le personnage lui-même. */
export async function spendDivine(db: any, ch: any, amount: number) {
  if (!amount) return;
  if ((ch.divine_energy_current ?? 0) < amount) fail(409, `Énergie divine insuffisante (${amount} requise)`);
  await db.query('UPDATE characters SET divine_energy_current=divine_energy_current-$2 WHERE id=$1', [ch.id, amount]); ch.divine_energy_current -= amount;
}
export const pathCost = (a: any, from: any, to: any, stopAt = 0) => {
  let cost = 0;
  for (const c of walk(from, to)) { const s = stepCost(terrain(c.x, c.y, a.mp?.map_id), a); if (!isFinite(s)) return Infinity; cost += s; if (Math.max(Math.abs(c.x - to.x), Math.abs(c.y - to.y)) <= stopAt) break; } return cost;
};
/** Avance vers `target` jusqu'à `stopAt` cases (0 = sur la case). Trajet payé par la monture si invoquée ; l'action par le personnage. */
export async function travel(db: any, ch: any, a: any, target: { x: number; y: number }, stopAt: number, actionCost = 0) {
  const mp = a.mp, { rows: [m] } = await db.query('SELECT width w,height h FROM maps WHERE id=$1', [mp.map_id]);
  if (target.x < 0 || target.y < 0 || target.x >= m.w || target.y >= m.h) fail(409, 'Hors de la carte');
  const cells: { x: number; y: number }[] = []; let cost = 0, divine = 0, lava = false;
  for (const c of walk({ x: mp.coord_x, y: mp.coord_y }, target)) { const t = terrain(c.x, c.y, mp.map_id), s = stepCost(t, a); if (!isFinite(s)) fail(409, blockedMsg(t.kind, a)); cells.push(c); cost += s; divine += tileOf(mp.map_id, t.kind)?.divine_energy_cost ?? 0; if (t.burn) lava = true;
    if (Math.max(Math.abs(c.x - target.x), Math.abs(c.y - target.y)) <= stopAt) break; }
  if (cells.length && (await db.query(`SELECT 1 FROM positions WHERE map_id=$1 AND ${BLOCKING} AND (coord_x||','||coord_y)=ANY($2)`, [mp.map_id, cells.map(c => `${c.x},${c.y}`)])).rowCount) fail(409, 'Chemin bloqué');
  await spendDivine(db, ch, divine);   // cases à coût divin (admin « Cases ») : vérifié avant tout débit
  await spend(db, ch, a, cost, 'move'); await spend(db, ch, a, actionCost, 'action');
  const last = cells[cells.length - 1];
  if (last) { await db.query(`UPDATE positions SET coord_x=$2, coord_y=$3 WHERE ${a.sm ? 'summon_id' : 'character_id'}=$1`, [a.sm ? a.sm.id : ch.id, last.x, last.y]); a.mp = { ...mp, coord_x: last.x, coord_y: last.y }; }
  if (lava && !a.sm) await ignite(db, ch.id);      // volcan : brûlure dès qu'on traverse une case
  return { cost, divine, pos: last ?? { x: mp.coord_x, y: mp.coord_y }, mapId: mp.map_id };
}

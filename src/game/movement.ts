import { walk } from './rules.js'; import { terrain } from './terrain.js'; import { fail, posOf } from '../lib/db.js';
const MOUNT_SQL = `SELECT cm.*, m.name, m.hp_max, m.armor, m.strength, m.agility, m.energy_max, m.bonus_see, m.bonus_range, m.flying, m.aquatic, m.recovery, m.special_attack_name, m.special_attack_damage, m.special_attack_energy
  FROM character_mounts cm JOIN mounts m ON m.id=cm.mount_id WHERE cm.character_id=$1 AND cm.active`;
export const activeMount = async (db: any, id: number) => (await db.query(MOUNT_SQL, [id])).rows[0];
export const isWater = (kind: string) => kind === 'shallow' || kind === 'deep';
/** Acteur courant : l'invocation contrôlée, sinon le héros (monté ou non). */
export async function actor(db: any, ch: any) {
  if (ch.controlled_summon_id) {
    const { rows: [sm] } = await db.query('SELECT * FROM summons WHERE id=$1 AND owner_id=$2', [ch.controlled_summon_id, ch.id]);
    if (sm) { const { rows: [mp] } = await db.query('SELECT * FROM positions WHERE summon_id=$1', [sm.id]); return { sm, mount: null, mp, see: sm.see, range: 1 }; }
  }
  const mount = await activeMount(db, ch.id), mp = await posOf(db, ch.id);
  return { sm: null, mount, mp, see: ch.see + (mount?.bonus_see ?? 0), range: ch.range + (mount?.bonus_range ?? 0) };
}
/** Coût d'une case selon l'acteur : monture volante = 1 partout ; monture aquatique/navire = 1 sur l'eau, rien sur terre ;
 *  à pied ou en monture terrestre : eau peu profonde = 4, eau profonde = interdite. */
export function stepCost(t: { kind: string; cost: number }, a: any): number {
  const m = a.mount; if (m?.flying) return 1;
  if (m?.aquatic) return isWater(t.kind) ? 1 : Infinity;
  return t.kind === 'deep' ? Infinity : t.cost;
}
const blockedMsg = (kind: string, a: any) => a.mount?.aquatic ? 'Une monture aquatique ne quitte pas l’eau' : kind === 'deep' ? 'Eau profonde : un navire, une monture volante ou aquatique est requis' : 'Terrain infranchissable';
/** Paiement d'énergie : 'move' = déplacement (monture si invoquée), 'mount' = capacité de la monture, 'action' = énergie du personnage. L'invocation contrôlée paie tout. */
export async function spend(db: any, ch: any, a: any, amount: number, kind: 'move' | 'action' | 'mount' = 'action') {
  if (!amount) return;
  if (a.sm) { if (a.sm.energy_current < amount) fail(409, `Énergie de l'invocation insuffisante (${amount})`); await db.query('UPDATE summons SET energy_current=energy_current-$2 WHERE id=$1', [a.sm.id, amount]); a.sm.energy_current -= amount; }
  else if (a.mount && kind !== 'action') { if (a.mount.energy_current < amount) fail(409, `Énergie de la monture insuffisante (${amount})`); await db.query('UPDATE character_mounts SET energy_current=energy_current-$3 WHERE character_id=$1 AND mount_id=$2', [ch.id, a.mount.mount_id, amount]); a.mount.energy_current -= amount; }
  else { if (ch.energy_current < amount) fail(409, `Énergie insuffisante (${amount} requis)`); await db.query('UPDATE characters SET energy_current=energy_current-$2 WHERE id=$1', [ch.id, amount]); ch.energy_current -= amount; }
}
export const pathCost = (a: any, from: any, to: any, stopAt = 0) => {
  let cost = 0;
  for (const c of walk(from, to)) { const s = stepCost(terrain(c.x, c.y), a); if (!isFinite(s)) return Infinity; cost += s; if (Math.max(Math.abs(c.x - to.x), Math.abs(c.y - to.y)) <= stopAt) break; } return cost;
};
/** Avance vers `target` jusqu'à `stopAt` cases (0 = sur la case). Trajet payé par la monture si invoquée ; l'action par le personnage. */
export async function travel(db: any, ch: any, a: any, target: { x: number; y: number }, stopAt: number, actionCost = 0) {
  const mp = a.mp, { rows: [m] } = await db.query('SELECT width w,height h FROM maps WHERE id=$1', [mp.map_id]);
  if (target.x < 0 || target.y < 0 || target.x >= m.w || target.y >= m.h) fail(409, 'Hors de la carte');
  const cells: { x: number; y: number }[] = []; let cost = 0;
  for (const c of walk({ x: mp.coord_x, y: mp.coord_y }, target)) { const t = terrain(c.x, c.y), s = stepCost(t, a); if (!isFinite(s)) fail(409, blockedMsg(t.kind, a)); cells.push(c); cost += s;
    if (Math.max(Math.abs(c.x - target.x), Math.abs(c.y - target.y)) <= stopAt) break; }
  if (cells.length && (await db.query(`SELECT 1 FROM positions WHERE map_id=$1 AND item_id IS NULL AND (coord_x||','||coord_y)=ANY($2)`, [mp.map_id, cells.map(c => `${c.x},${c.y}`)])).rowCount) fail(409, 'Chemin bloqué');
  await spend(db, ch, a, cost, 'move'); await spend(db, ch, a, actionCost, 'action');
  const last = cells[cells.length - 1];
  if (last) { await db.query(`UPDATE positions SET coord_x=$2, coord_y=$3 WHERE ${a.sm ? 'summon_id' : 'character_id'}=$1`, [a.sm ? a.sm.id : ch.id, last.x, last.y]); a.mp = { ...mp, coord_x: last.x, coord_y: last.y }; }
  return { cost, pos: last ?? { x: mp.coord_x, y: mp.coord_y }, mapId: mp.map_id };
}

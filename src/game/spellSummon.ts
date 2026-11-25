import { fail, log } from '../lib/db.js'; import { freeCell } from './spawn.js'; import { maxSummons } from './stats.js';
import { bagRoom } from './bag.js'; import { Effects, applyEffects } from './spellEffects.js';
import { loadTarget, type Target } from './combatlib.js';
/**
 * Lot D (migration 27) — invocations par sort et sorts déclenchés par les objets portés.
 * Invocation (`effects.summon` = { kind, refId, qty, durationH }) : monstre (instance de combat contrôlable près du lanceur),
 * monture (type de monstre montable → la monture est ajoutée au lanceur), objet (`qty` exemplaires dans le sac), bâtiment
 * (copie du modèle posée près du lanceur, à lui). durationH 0 = permanent ; sinon retiré au tick après l'échéance.
 */
/** Copie un bâtiment modèle (toutes ses caractéristiques et ses sorts liés) sur une case, au nom du propriétaire. */
export async function copyBuilding(db: any, templateId: number, ownerId: number, mapId: number, x: number, y: number) {
  const { rows: [bd] } = await db.query(
    `INSERT INTO buildings(name,kind,owner_id,invulnerable,data,structure,size,prerequisites,armor,occupiable,occupant_attack,bonus_armor,bonus_magic_armor,bonus_see,bonus_range)
     SELECT name,kind,$2,false,data,structure,size,prerequisites,armor,occupiable,occupant_attack,bonus_armor,bonus_magic_armor,bonus_see,bonus_range FROM buildings WHERE id=$1 RETURNING id, name`, [templateId, ownerId]);
  if (!bd) fail(404, 'Bâtiment modèle inconnu');
  await db.query("INSERT INTO entity_spells(kind,ref_id,spell_id,mode) SELECT 'building',$2,spell_id,mode FROM entity_spells WHERE kind='building' AND ref_id=$1", [templateId, bd.id]);
  await db.query('INSERT INTO positions(map_id,coord_x,coord_y,building_id) VALUES ($1,$2,$3,$4)', [mapId, x, y, bd.id]);
  return bd;
}
/** Exécute l'invocation d'un sort pour le lanceur ; renvoie un libellé. Contrôles avant toute écriture. */
export async function castSummon(db: any, me: any, mp: any, s: any) {   // s : effects.summon déjà validé (Effects)
  let refId: number, label: string;
  if (s.kind === 'monster') {
    const { rows: [m] } = await db.query('SELECT * FROM monsters WHERE id=$1', [s.refId]); if (!m) fail(404, 'Monstre à invoquer inconnu');
    const cap = await maxSummons(db, me), n = (await db.query('SELECT count(*)::int n FROM summons WHERE owner_id=$1', [me.id])).rows[0].n;
    if (n >= cap) fail(409, `Limite d'invocations atteinte (${cap} max)`);
    const cell = await freeCell(db, mp.map_id, mp.coord_x, mp.coord_y, 1);
    const { rows: [sm] } = await db.query(
      `INSERT INTO summons(owner_id,name,hp_current,hp_max,recovery,see,strength,agility,energy_current,energy_max,armor,magic_armor,damage,monster_id)
       VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$8,$9,$10,$6,$11) RETURNING id`,
      [me.id, m.name, m.hp_max ?? 1, m.recovery ?? 0, m.see ?? 3, m.strength ?? 0, m.agility ?? 0, m.energy_max ?? 0, m.armor ?? 0, m.magic_armor ?? 0, m.id]);
    await db.query('INSERT INTO positions(map_id,coord_x,coord_y,summon_id) VALUES ($1,$2,$3,$4)', [mp.map_id, cell.x, cell.y, sm.id]);
    refId = sm.id; label = `invoque ${m.name}`;
  } else if (s.kind === 'mount') {
    const { rows: [mo] } = await db.query('SELECT mo.* FROM mounts mo JOIN monsters m ON m.id=mo.monster_id WHERE m.id=$1 AND m.mountable', [s.refId]);
    if (!mo) fail(409, 'Ce monstre ne peut pas servir de monture');
    await db.query('INSERT INTO character_mounts(character_id,mount_id,energy_current,hp_current) VALUES ($1,$2,$3,$4)', [me.id, mo.id, mo.energy_max, mo.hp_max]);
    refId = mo.id; label = `obtient la monture ${mo.name}`;
  } else if (s.kind === 'item') {
    const { rows: [it] } = await db.query('SELECT id, name FROM items WHERE id=$1', [s.refId]); if (!it) fail(404, 'Objet à invoquer inconnu');
    if (await bagRoom(db, me.id) <= 0) fail(409, 'Inventaire plein');
    await db.query('INSERT INTO character_items(character_id,item_id,qty) VALUES ($1,$2,$3)', [me.id, it.id, s.qty]);
    refId = it.id; label = `obtient ${it.name}${s.qty > 1 ? ` ×${s.qty}` : ''}`;
  } else {
    const cell = await freeCell(db, mp.map_id, mp.coord_x, mp.coord_y, 1);
    const bd = await copyBuilding(db, s.refId, me.id, mp.map_id, cell.x, cell.y);
    refId = bd.id; label = `fait apparaître ${bd.name}`;
  }
  if (s.durationH > 0) await db.query("INSERT INTO spell_summons(caster_id,kind,ref_id,qty,until) VALUES ($1,$2,$3,$4,now()+make_interval(hours=>$5))", [me.id, s.kind, refId, s.qty, s.durationH]);
  return `${label}${s.durationH > 0 ? ` pour ${s.durationH} h` : ''}`;
}
/** Tick : retire les invocations temporaires échues (objets : sac, puis coffre, puis portés — bonus d'équipement rendus par le trigger). */
export async function expireSummons(db: any) {
  const { rows } = await db.query('DELETE FROM spell_summons WHERE until <= now() RETURNING *');
  for (const r of rows) {
    if (r.kind === 'monster') await db.query('DELETE FROM summons WHERE id=$1', [r.ref_id]);
    else if (r.kind === 'mount') await db.query('DELETE FROM character_mounts WHERE ctid=(SELECT ctid FROM character_mounts WHERE character_id=$1 AND mount_id=$2 ORDER BY active LIMIT 1)', [r.caster_id, r.ref_id]);
    else if (r.kind === 'building') {
      await db.query("DELETE FROM entity_spells WHERE kind='building' AND ref_id=$1", [r.ref_id]);
      await db.query('DELETE FROM positions WHERE building_id=$1', [r.ref_id]);
      await db.query('DELETE FROM buildings WHERE id=$1', [r.ref_id]);
    } else {
      let left = r.qty;
      const { rows: lines } = await db.query('SELECT ctid::text, qty FROM character_items WHERE character_id=$1 AND item_id=$2 ORDER BY (equipped_slot IS NOT NULL), in_chest', [r.caster_id, r.ref_id]);
      for (const l of lines) { if (!left) break; const take = Math.min(left, l.qty ?? 1); left -= take;
        if (take >= (l.qty ?? 1)) await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [l.ctid]); else await db.query('UPDATE character_items SET qty=qty-$2 WHERE ctid=$1::tid', [l.ctid, take]); }
    }
    await log(db, r.caster_id, 'Fin d\'une invocation temporaire');
  }
  return rows.length;
}
/**
 * Sorts déclenchés par les objets PORTÉS d'un personnage : `on_hit` (il porte un coup) ou `on_struck` (il reçoit une attaque).
 * Le sort s'applique au porteur si sa cible est « soi-même », sinon à l'autre combattant. Sans coût d'énergie.
 */
export async function triggerItemSpells(db: any, wearer: any, other: Target, mode: 'on_hit' | 'on_struck') {
  const { rows } = await db.query(`SELECT DISTINCT s.id, s.name, s.effects FROM entity_spells es JOIN character_items ci ON ci.item_id=es.ref_id AND ci.character_id=$1 AND ci.equipped_slot IS NOT NULL
    JOIN spells s ON s.id=es.spell_id WHERE es.kind='item' AND es.mode=$2`, [wearer.id, mode]);
  const out: string[] = [];
  for (const s of rows) {
    const e = Effects.safeParse(s.effects ?? {}); if (!e.success || !Object.keys(s.effects ?? {}).length) continue;
    let t: Target | null = other;
    if (e.data.target === 'self') { const { rows: [p] } = await db.query('SELECT * FROM positions WHERE character_id=$1', [wearer.id]); t = p ? await loadTarget(db, p) : null; }
    if (!t || (t.kind !== 'character' && (t.row.hp_current ?? 0) <= 0)) continue;
    out.push(`${s.name} : ${await applyEffects(db, wearer, s.id, e.data, t)}`);
  }
  return out;
}

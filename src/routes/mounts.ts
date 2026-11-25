import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log, posOf } from '../lib/db.js'; import { broadcast } from '../realtime/ws.js';
import { activeMount } from '../game/movement.js'; import { terrain } from '../game/terrain.js'; import { freeCell } from '../game/spawn.js'; import { maxSummons } from '../game/stats.js';
import { bagCount, BAG_MAX } from './market.js';
/**
 * Montures possédées (character_mounts, migration 29) :
 *  - MONTÉE (`active`) : le cavalier se déplace, l'énergie des déplacements est prise sur la monture ; ses capacités actives
 *    (sorts du type de monstre) sont lançables et payées par la monture. Seulement si le type peut servir de monture.
 *  - INVOQUÉE À PIED : invocation contrôlable (summons.char_mount_id) qui reprend ses PV / son énergie et ses caractéristiques
 *    équipement compris ; contrôlée, elle paie ses déplacements et ses capacités ; à son départ (renvoi, mort) ses PV et son
 *    énergie reviennent sur la monture (trigger).
 *  - ÉQUIPÉE : objets du sac posés sur les parties du corps autorisées par son type (mount_equips), rendus au sac au retrait.
 */
export const mounts = router();
const ownMount = async (db: any, chId: number, cmId: number) => {
  const { rows: [m] } = await db.query(`SELECT cm.*, mo.name, mo.monster_id, mo.hp_max, mo.energy_max, COALESCE(t.mountable, true) can_ride
    FROM character_mounts cm JOIN mounts mo ON mo.id=cm.mount_id LEFT JOIN monsters t ON t.id=mo.monster_id WHERE cm.id=$1 AND cm.character_id=$2`, [cmId, chId]);
  return m ?? fail(404, 'Monture non possédée');
};
/** Caractéristiques de la créature : monture + objets équipés (colonnes historiques et bonuses). */
export async function mountStats(db: any, cmId: number) {
  const { rows: [m] } = await db.query(`SELECT mo.*, t.magic_armor t_ma, t.see t_see FROM character_mounts cm JOIN mounts mo ON mo.id=cm.mount_id LEFT JOIN monsters t ON t.id=mo.monster_id WHERE cm.id=$1`, [cmId]);
  const { rows: eq } = await db.query('SELECT i.* FROM mount_equips me JOIN items i ON i.id=me.item_id WHERE me.char_mount_id=$1', [cmId]);
  const sum = (f: (i: any) => number) => eq.reduce((s: number, i: any) => s + (Number(f(i)) || 0), 0), b = (k: string) => sum(i => i.bonuses?.[k]);
  return { hp_max: (m.hp_max ?? 1) + b('hp_max'), energy_max: (m.energy_max ?? 0) + b('energy_max'), recovery: (m.recovery ?? 0) + b('recovery'), see: (m.t_see ?? 4) + b('see'),
    strength: (m.strength ?? 0) + sum(i => i.strength_bonus), agility: (m.agility ?? 0) + sum(i => i.agility_bonus), armor: (m.armor ?? 0) + sum(i => i.armor), magic_armor: (m.t_ma ?? 0) + sum(i => i.magic_armor) };
}
def(mounts, 'get', '/mounts/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  const { rows } = await db.query(`SELECT m.*, cm.id cm_id, cm.energy_current, cm.hp_current, cm.active, COALESCE(t.mountable, true) can_ride, t.locomotion,
      (SELECT id FROM summons WHERE char_mount_id=cm.id) summon_id,
      COALESCE((SELECT json_agg(slot ORDER BY slot) FROM monster_slots WHERE monster_id=m.monster_id), '[]') slots,
      COALESCE((SELECT json_agg(json_build_object('slot', me.slot, 'item_id', me.item_id, 'name', i.name) ORDER BY me.slot) FROM mount_equips me JOIN items i ON i.id=me.item_id WHERE me.char_mount_id=cm.id), '[]') equips,
      COALESCE((SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'energy_cost', s.energy_cost, 'effects', s.effects)) FROM monster_spells ms JOIN spells s ON s.id=ms.spell_id WHERE ms.monster_id=m.monster_id AND ms.mode='active'), '[]') capacities
    FROM character_mounts cm JOIN mounts m ON m.id=cm.mount_id LEFT JOIN monsters t ON t.id=m.monster_id WHERE cm.character_id=$1 ORDER BY cm.id`, [me.id]);
  for (const r of rows) r.stats = await mountStats(db, r.cm_id);
  return rows;
}));
/** Monter dessus (une seule monture montée) : type montable, PV > 0, pas déjà invoquée à pied. `cmId` (ou l'ancien `mountId`). */
def(mounts, 'post', '/mounts/summon', z.object({ characterId: z.number(), cmId: z.number().optional(), mountId: z.number().optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId);
  const cmId = b.cmId ?? (await db.query('SELECT id FROM character_mounts WHERE character_id=$1 AND mount_id=$2 ORDER BY id LIMIT 1', [me.id, b.mountId ?? -1])).rows[0]?.id;
  const m = await ownMount(db, me.id, cmId ?? -1);
  if (!m.can_ride) fail(409, `${m.name} ne peut pas servir de monture : invoquez-la à pied`);
  if ((await db.query('SELECT 1 FROM summons WHERE char_mount_id=$1', [m.id])).rowCount) fail(409, `${m.name} est déjà invoquée à pied : renvoyez-la d'abord`);
  if (m.hp_current <= 0) fail(409, `${m.name} est à terre (0 PV) : attendez sa régénération`);
  await db.query('UPDATE character_mounts SET active=false WHERE character_id=$1', [me.id]);
  await db.query('UPDATE character_mounts SET active=true WHERE id=$1', [m.id]);
  await log(db, me.id, `Monte ${m.name}`); broadcast((await posOf(db, me.id)).map_id, { type: 'moved' }); return { ok: true };
}));
def(mounts, 'post', '/mounts/dismount', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), mp = await posOf(db, me.id), m = await activeMount(db, me.id);
  if (m && !m.flying && terrain(mp.coord_x, mp.coord_y, mp.map_id).kind === 'deep') fail(409, 'Impossible de renvoyer sa monture en eau profonde');
  await db.query('UPDATE character_mounts SET active=false WHERE character_id=$1', [me.id]); broadcast(mp.map_id, { type: 'moved' }); return { ok: true }; }));
/** Invoquer à pied : invocation contrôlable près du joueur (limite d'invocations), avec les PV / l'énergie actuels de la monture. */
def(mounts, 'post', '/mounts/call', z.object({ characterId: z.number(), cmId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), m = await ownMount(db, me.id, b.cmId), mp = await posOf(db, me.id);
  if (m.active) fail(409, `Vous êtes sur ${m.name} : descendez d'abord`);
  if ((await db.query('SELECT 1 FROM summons WHERE char_mount_id=$1', [m.id])).rowCount) fail(409, `${m.name} est déjà invoquée`);
  if (m.hp_current <= 0) fail(409, `${m.name} est à terre (0 PV) : attendez sa régénération`);
  const cap = await maxSummons(db, me), n = (await db.query('SELECT count(*)::int n FROM summons WHERE owner_id=$1', [me.id])).rows[0].n;
  if (n >= cap) fail(409, `Limite d'invocations atteinte (${cap} max)`);
  const st = await mountStats(db, m.id), cell = await freeCell(db, mp.map_id, mp.coord_x, mp.coord_y, 1);
  const { rows: [s] } = await db.query(`INSERT INTO summons(owner_id,name,hp_current,hp_max,recovery,see,strength,agility,energy_current,energy_max,armor,magic_armor,damage,monster_id,char_mount_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$7,$13,$14) RETURNING id`,
    [me.id, m.name, Math.min(m.hp_current, st.hp_max), st.hp_max, st.recovery, st.see, st.strength, st.agility, Math.min(m.energy_current, st.energy_max), st.energy_max, st.armor, st.magic_armor, m.monster_id, m.id]);
  await db.query('INSERT INTO positions(map_id,coord_x,coord_y,summon_id) VALUES ($1,$2,$3,$4)', [mp.map_id, cell.x, cell.y, s.id]);
  await log(db, me.id, `Invoque ${m.name} à pied`); broadcast(mp.map_id, { type: 'spawn', summonId: s.id, x: cell.x, y: cell.y });
  return { ok: true, summonId: s.id };
}));
const Slot = z.enum(['mains', 'tete', 'torse', 'pieds', 'collier', 'bracelet', 'bague']);
/** Équiper : objet du SAC, partie autorisée par le type (monster_slots), une pièce par partie. Pas pendant une invocation à pied. */
def(mounts, 'post', '/mounts/equip', z.object({ characterId: z.number(), cmId: z.number(), itemId: z.number(), slot: Slot }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), m = await ownMount(db, me.id, b.cmId);
  if ((await db.query('SELECT 1 FROM summons WHERE char_mount_id=$1', [m.id])).rowCount) fail(409, 'Renvoyez d\'abord la créature invoquée');
  if (!(await db.query('SELECT 1 FROM monster_slots WHERE monster_id=$1 AND slot=$2', [m.monster_id ?? -1, b.slot])).rowCount) fail(400, `${m.name} ne peut rien porter sur cette partie du corps`);
  if ((await db.query('SELECT 1 FROM mount_equips WHERE char_mount_id=$1 AND slot=$2', [m.id, b.slot])).rowCount) fail(409, 'Partie déjà équipée');
  const { rows: [line] } = await db.query('SELECT ctid::text, qty FROM character_items WHERE character_id=$1 AND item_id=$2 AND NOT in_chest AND equipped_slot IS NULL LIMIT 1', [me.id, b.itemId]);
  if (!line) fail(404, 'Objet absent du sac');
  if ((line.qty ?? 1) > 1) await db.query('UPDATE character_items SET qty=qty-1 WHERE ctid=$1::tid', [line.ctid]); else await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [line.ctid]);
  await db.query('INSERT INTO mount_equips(char_mount_id,slot,item_id) VALUES ($1,$2,$3)', [m.id, b.slot, b.itemId]);
  return { ok: true };
}));
def(mounts, 'post', '/mounts/unequip', z.object({ characterId: z.number(), cmId: z.number(), slot: Slot }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), m = await ownMount(db, me.id, b.cmId);
  if ((await db.query('SELECT 1 FROM summons WHERE char_mount_id=$1', [m.id])).rowCount) fail(409, 'Renvoyez d\'abord la créature invoquée');
  if (await bagCount(db, me.id) >= BAG_MAX) fail(409, 'Inventaire plein');
  const { rows: [e] } = await db.query('DELETE FROM mount_equips WHERE char_mount_id=$1 AND slot=$2 RETURNING item_id', [m.id, b.slot]);
  if (!e) fail(404, 'Rien sur cette partie');
  await db.query('INSERT INTO character_items(character_id,item_id) VALUES ($1,$2)', [me.id, e.item_id]);
  return { ok: true };
}));

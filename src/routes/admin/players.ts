import { def, router, z, P } from '../../lib/route.js'; import { pool, tx, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { freeCell } from '../../game/spawn.js';
/** Endpoints hérités de l'admin historique — complétés en phase 4 (modération, rôles mod). */
export const playerRoutes = router();
const STATS = ['hp_max', 'energy_max', 'divine_energy_max', 'recovery', 'see', 'strength', 'agility', 'armor', 'range', 'xp', 'gold'];
def(playerRoutes, 'post', '/admin/players/{id}/block', z.object({ blocked: z.boolean() }), async (c, b) => {
  await pool.query('UPDATE characters SET blocked=$2 WHERE id=$1', [P(c, 'id'), b.blocked]);
  await audit(c, 'player.block', 'player', P(c, 'id'), null, b);
  return { ok: true };
});
def(playerRoutes, 'post', '/admin/players/{id}/teleport', z.object({ map: z.number(), x: z.number(), y: z.number() }), (c, b) => tx(async db => {
  const cell = await freeCell(db, b.map, b.x, b.y, 2);
  await db.query('UPDATE positions SET map_id=$2,coord_x=$3,coord_y=$4 WHERE character_id=$1', [P(c, 'id'), b.map, cell.x, cell.y]);
  await audit(c, 'player.teleport', 'player', P(c, 'id'), null, b);
  return cell;
}));
def(playerRoutes, 'post', '/admin/players/{id}/stat', z.object({ stat: z.string(), delta: z.number().int() }), async (c, b) => {
  if (!STATS.includes(b.stat)) fail(400, 'Statistique inconnue');
  await pool.query(`UPDATE characters SET ${b.stat}=GREATEST(0,${b.stat}+$2) WHERE id=$1`, [P(c, 'id'), b.delta]);
  await audit(c, 'player.stat', 'player', P(c, 'id'), null, b);
  return { ok: true };
});
const GRANT: Record<string, string> = {
  item: 'INSERT INTO character_items(character_id,item_id) VALUES ($1,$2)',
  spell: 'INSERT INTO character_spells(character_id,spell_id) VALUES ($1,$2)',
  mount: 'INSERT INTO character_mounts(character_id,mount_id,energy_current,hp_current) SELECT $1,id,energy_max,hp_max FROM mounts WHERE id=$2'
};
def(playerRoutes, 'post', '/admin/players/{id}/grant', z.object({ kind: z.enum(['item', 'spell', 'mount', 'divine']), refId: z.number() }), async (c, b) => {
  const charId = P(c, 'id');
  if (b.kind === 'divine') {
    // Objet divin : transfert du détenteur (UPDATE, jamais d'insertion => aucune duplication), dans la limite des caps.
    const r = await pool.query('UPDATE divine_items SET holder_character_id=$2 WHERE id=$1', [b.refId, charId]);
    if (!r.rowCount) fail(404, 'Objet divin inconnu');
  } else await pool.query(GRANT[b.kind], [charId, b.refId]);
  await audit(c, 'player.grant', 'player', charId, null, b);
  return { ok: true };
});

// ---- Section admin « Joueurs » : liste paginée par race + fiche complète éditable ----
/** Caractéristiques éditables en valeur absolue (fiche joueur). */
export const EDITABLE = ['hp_current', 'hp_max', 'energy_current', 'energy_max', 'divine_energy_current', 'divine_energy_max', 'recovery', 'see', 'strength', 'agility', 'armor', 'range', 'xp', 'gold', 'chest_size', 'summon_cap'] as const;
const LIST_SQL = `FROM characters c JOIN accounts a ON a.id=c.account_id LEFT JOIN positions p ON p.character_id=c.id LEFT JOIN specializations s ON s.id=c.specialization_id`;
def(playerRoutes, 'get', '/admin/players', null, async c => {
  const q = c.req.query(), per = Math.min(Math.max(Number(q.per ?? 20) || 20, 1), 100), page = Math.max(Number(q.page ?? 1) || 1, 1);
  const w: string[] = [], v: any[] = [];
  if (q.race) w.push(`c.race=$${v.push(q.race)}`);
  if (q.q) w.push(`(c.pseudo ILIKE $${v.push(`%${q.q}%`)} OR a.email ILIKE $${v.length})`);
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const { rows: [t] } = await pool.query(`SELECT count(*)::int n ${LIST_SQL} ${where}`, v);
  const { rows } = await pool.query(
    `SELECT c.id,c.pseudo,c.race,c.xp,c.gold,c.blocked,a.email,p.map_id,p.coord_x x,p.coord_y y,s.name rank_name,s.current_rank
     ${LIST_SQL} ${where} ORDER BY c.race, c.pseudo LIMIT ${per} OFFSET ${(page - 1) * per}`, v);
  const races = (await pool.query('SELECT race,count(*)::int n FROM characters GROUP BY race ORDER BY race')).rows;
  return { total: t.n, page, per, pages: Math.max(1, Math.ceil(t.n / per)), races, rows };
});
def(playerRoutes, 'get', '/admin/players/{id}', null, async c => {
  const id = P(c, 'id');
  const { rows: [ch] } = await pool.query(
    `SELECT c.*, a.email, p.map_id, p.coord_x x, p.coord_y y, s.name rank_name, s.current_rank ${LIST_SQL} WHERE c.id=$1`, [id]);
  if (!ch) fail(404, 'Joueur inconnu');
  const q = (sql: string) => pool.query(sql, [id]).then((r: any) => r.rows);
  return {
    character: ch,
    ranks: (await pool.query('SELECT id,name,current_rank FROM specializations WHERE race=$1 ORDER BY current_rank', [ch.race])).rows,
    items: await q(`SELECT ci.item_id, i.name, i.slot, COALESCE(i.rarity,'commun') rarity, ci.qty, ci.equipped_slot,
      CASE WHEN ci.in_chest THEN 'chest' WHEN ci.equipped_slot IS NOT NULL THEN 'equipped' ELSE 'bag' END place
      FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 ORDER BY place, i.name`),
    spells: await q('SELECT cs.spell_id, sp.name, sp.kind, sp.rarity FROM character_spells cs JOIN spells sp ON sp.id=cs.spell_id WHERE cs.character_id=$1 ORDER BY sp.name'),
    mounts: await q('SELECT cm.mount_id, m.name, cm.active, cm.hp_current, m.hp_max, cm.energy_current, m.energy_max FROM character_mounts cm JOIN mounts m ON m.id=cm.mount_id WHERE cm.character_id=$1 ORDER BY m.name'),
    buildings: await q('SELECT b.id, b.name, b.kind, b.structure, p.map_id, p.coord_x x, p.coord_y y FROM buildings b LEFT JOIN positions p ON p.building_id=b.id WHERE b.owner_id=$1 ORDER BY b.id'),
    divine: await q('SELECT di.id, di.kind, i.name FROM divine_items di LEFT JOIN items i ON i.id=di.item_id WHERE di.holder_character_id=$1 ORDER BY di.kind, di.id'),
  };
});
const Edit = z.object(Object.fromEntries(EDITABLE.map(k => [k, z.number().int().min(0).optional()]))).extend({ specialization_id: z.number().int().optional() });
def(playerRoutes, 'put', '/admin/players/{id}', Edit, async (c, b) => {
  const id = P(c, 'id');
  const { rows: [before] } = await pool.query('SELECT * FROM characters WHERE id=$1', [id]);
  if (!before) fail(404, 'Joueur inconnu');
  if (b.specialization_id !== undefined && !(await pool.query('SELECT 1 FROM specializations WHERE id=$1 AND race=$2', [b.specialization_id, before.race])).rowCount) fail(400, 'Rang inconnu pour cette race');
  const cols = [...EDITABLE, 'specialization_id'].filter(k => (b as any)[k] !== undefined);
  if (!cols.length) fail(400, 'Aucun champ à modifier');
  const { rows: [row] } = await pool.query(`UPDATE characters SET ${cols.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`, [id, ...cols.map(k => (b as any)[k])]);
  await audit(c, 'player.update', 'player', id, Object.fromEntries(cols.map(k => [k, before[k]])), b);
  return row;
});
/** Ajoute un objet dans le sac ou le coffre (empilé si déjà présent au même endroit, hors équipement). */
def(playerRoutes, 'post', '/admin/players/{id}/items', z.object({ itemId: z.number().int(), qty: z.number().int().min(1).max(9999).default(1), place: z.enum(['bag', 'chest']).default('bag') }), (c, b) => tx(async db => {
  const id = P(c, 'id'), chest = b.place === 'chest';
  if (!(await db.query('SELECT 1 FROM items WHERE id=$1', [b.itemId])).rowCount) fail(404, 'Objet inconnu');
  const up = await db.query('UPDATE character_items SET qty=qty+$4 WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND in_chest=$3 AND equipped_slot IS NULL LIMIT 1)', [id, b.itemId, chest, b.qty]);
  if (!up.rowCount) await db.query('INSERT INTO character_items(character_id,item_id,in_chest,qty) VALUES ($1,$2,$3,$4)', [id, b.itemId, chest, b.qty]);
  await audit(c, 'player.item.add', 'player', id, null, b);
  return { ok: true };
}));
/** Retire un objet (une ligne) d'un emplacement : sac, coffre ou équipé. */
def(playerRoutes, 'delete', '/admin/players/{id}/items/{itemId}', null, async c => {
  const id = P(c, 'id'), itemId = P(c, 'itemId'), place = c.req.query('place') ?? 'bag';
  const cond = place === 'chest' ? 'in_chest' : place === 'equipped' ? 'NOT in_chest AND equipped_slot IS NOT NULL' : 'NOT in_chest AND equipped_slot IS NULL';
  const r = await pool.query(`DELETE FROM character_items WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND ${cond} LIMIT 1)`, [id, itemId]);
  if (!r.rowCount) fail(404, 'Objet absent de cet emplacement');
  await audit(c, 'player.item.remove', 'player', id, { itemId, place }, null);
  return { ok: true };
});
def(playerRoutes, 'delete', '/admin/players/{id}/spells/{spellId}', null, async c => {
  const id = P(c, 'id'), r = await pool.query('DELETE FROM character_spells WHERE character_id=$1 AND spell_id=$2', [id, P(c, 'spellId')]);
  if (!r.rowCount) fail(404, 'Sort non possédé');
  await audit(c, 'player.spell.remove', 'player', id, { spellId: P(c, 'spellId') }, null);
  return { ok: true };
});
def(playerRoutes, 'delete', '/admin/players/{id}/mounts/{mountId}', null, async c => {
  const id = P(c, 'id'), r = await pool.query('DELETE FROM character_mounts WHERE ctid=(SELECT ctid FROM character_mounts WHERE character_id=$1 AND mount_id=$2 LIMIT 1)', [id, P(c, 'mountId')]);
  if (!r.rowCount) fail(404, 'Monture non possédée');
  await audit(c, 'player.mount.remove', 'player', id, { mountId: P(c, 'mountId') }, null);
  return { ok: true };
});
/** Supprime un bâtiment du joueur (et sa position sur la carte). */
def(playerRoutes, 'delete', '/admin/players/{id}/buildings/{buildingId}', null, (c) => tx(async db => {
  const id = P(c, 'id'), bid = P(c, 'buildingId');
  const { rows: [bd] } = await db.query('SELECT * FROM buildings WHERE id=$1 AND owner_id=$2', [bid, id]);
  if (!bd) fail(404, 'Bâtiment non possédé');
  await db.query('DELETE FROM positions WHERE building_id=$1', [bid]);
  await db.query('DELETE FROM buildings WHERE id=$1', [bid]);
  await audit(c, 'player.building.remove', 'player', id, bd, null);
  return { ok: true };
}));
/** Libère un exemplaire divin détenu (il redevient libre, sans gardien). */
def(playerRoutes, 'post', '/admin/players/{id}/divine/{divineId}/release', null, async c => {
  const id = P(c, 'id'), r = await pool.query('UPDATE divine_items SET holder_character_id=NULL WHERE id=$1 AND holder_character_id=$2', [P(c, 'divineId'), id]);
  if (!r.rowCount) fail(404, 'Exemplaire non détenu par ce joueur');
  await audit(c, 'player.divine.release', 'player', id, { divineId: P(c, 'divineId') }, null);
  return { ok: true };
});

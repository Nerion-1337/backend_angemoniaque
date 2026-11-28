import { def, router, P } from '../lib/route.js'; import { pool } from '../lib/db.js'; import { terrain } from '../game/terrain.js'; import { zoneAt } from '../game/gates.js'; import { getPublicHealthState } from '../game/rules.js';
import { loadTiles, tilePublic, TILE_KINDS } from '../game/tileTypes.js'; import { depositAt, depositPublic } from '../game/deposits.js'; import { harvestNeeds, harvestMissing } from '../game/harvest.js'; import { ownChar } from '../lib/db.js';
export const mapRoutes = router();
const SEL = `SELECT p.coord_x x,p.coord_y y, p.air, CASE WHEN p.character_id IS NOT NULL THEN 'character' WHEN p.monsters_id IS NOT NULL THEN 'monster' WHEN p.summon_id IS NOT NULL THEN 'summon' WHEN p.building_id IS NOT NULL THEN 'building' ELSE 'item' END kind,
  COALESCE(ch.pseudo,mo.name,sm.name,b.name) name, ch.race, ch.id char_id, mo.id monster_id, sm.id summon_id, b.id building_id, b.kind building_kind, b.data->>'race' building_race, b.invulnerable, b.owner_id building_owner, b.structure smax, COALESCE(b.structure_current, b.structure) shp, s.name rank_name, s.current_rank rank, g.name guild,
  ch.hp_current chp, ch.hp_max chpmax, mo.hp_current mhp, mo.hp_max mhpmax, mo.armor marmor, mo.magic_armor mmarmor, own.pseudo owner, mt.name mount_name, 'air' = ANY(mtt.locomotion) mount_flying, mtt.model mount_model, mtt.icon mount_icon, mtt.locomotion mount_loco, mtt.size mount_size,
  COALESCE(mo.model, mop.model, smo.model) model, COALESCE(mo.icon, mop.icon, smo.icon) icon, COALESCE(mop.locomotion, mo.locomotion, smo.locomotion) locomotion, COALESCE(mo.size, smo.size) size,
  COALESCE('air' = ANY(mtt.locomotion), 'air' = ANY(mo.locomotion), 'air' = ANY(smo.locomotion), false) flying
  FROM positions p LEFT JOIN characters ch ON ch.id=p.character_id LEFT JOIN specializations s ON s.id=ch.specialization_id LEFT JOIN guilds g ON g.id=ch.guild_id LEFT JOIN monsters mo ON mo.id=p.monsters_id
  LEFT JOIN summons sm ON sm.id=p.summon_id LEFT JOIN monsters smo ON smo.id=sm.monster_id LEFT JOIN characters own ON own.id=sm.owner_id LEFT JOIN buildings b ON b.id=p.building_id LEFT JOIN summons mt ON mt.id=ch.riding_summon_id
  LEFT JOIN monsters mtt ON mtt.id=mt.monster_id LEFT JOIN monsters mop ON mop.id=NULLIF(mo.data->>'prototype','')::int`;
/** Structure invisible (migration 49, `buildings.visible = false`) : jamais renvoyée aux joueurs. */
const SEEN = `(p.building_id IS NULL OR b.visible)`;
/** Confidentialité : jamais les PV exacts d'un autre joueur, seulement son état de forme. */
const pub = (r: any) => { const { chp, chpmax, ...o } = r; return r.kind === 'character' ? { ...o, health: getPublicHealthState(chp, chpmax) } : o; };
def(mapRoutes, 'get', '/map/{mapId}/area', null, async c => {
  const q = c.req.query(), x = +q.x, y = +q.y, r = Math.min(+q.r || 5, 25);
  return (await pool.query(`${SEL} WHERE p.map_id=$1 AND p.coord_x BETWEEN $2 AND $3 AND p.coord_y BETWEEN $4 AND $5 AND ${SEEN}`, [P(c, 'mapId'), x - r, x + r, y - r, y + r])).rows.map(pub);
});
def(mapRoutes, 'get', '/map/{mapId}/cell', null, async c => {
  // jusqu'à deux entités (une au sol, une dans les airs, migration 46) : `entities`, la première au sol ; `entity` = celle de `air` demandé, sinon la première
  const q = c.req.query(), x = +q.x, y = +q.y, all = (await pool.query(`${SEL} WHERE p.map_id=$1 AND p.coord_x=$2 AND p.coord_y=$3 AND p.item_id IS NULL AND ${SEEN} ORDER BY (p.building_id IS NOT NULL), p.air`, [P(c, 'mapId'), x, y])).rows.map(pub);
  const out: any = (q.air != null ? all.find((e: any) => e.air === (q.air === '1')) : null) ?? all[0] ?? null;
  for (const e of all) if (e.kind === 'character' && q.details) e.visibleGear = (await pool.query('SELECT i.name FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.equipped_slot IS NOT NULL', [e.char_id])).rows.map((r: any) => r.name);
  await loadTiles(); const t = terrain(x, y, P(c, 'mapId'));
  const dep = await depositAt(pool, P(c, 'mapId'), x, y);
  return { x, y, terrain: t, tile: tilePublic(P(c, 'mapId'), t.kind), deposit: depositPublic(dep), harvestNeeds: await harvestNeeds(pool, dep?.resource ?? t.resourceId),
    harvestMissing: q.characterId ? await harvestMissing(pool, await ownChar(pool, c, Number(q.characterId)), dep?.resource ?? t.resourceId) : undefined, peace: await zoneAt(pool, 'peace_radius', P(c, 'mapId'), x, y), entity: out, entities: all };
});
/** Types de case du monde (nom, description, coût, sort passif) : carte de case + estimation d'énergie du front. */
def(mapRoutes, 'get', '/map/{mapId}/tile-types', null, async c => { await loadTiles(); const id = P(c, 'mapId'); return TILE_KINDS.map(k => tilePublic(id, k)); });
def(mapRoutes, 'get', '/map/{mapId}/landmarks', null, async c => (await pool.query(`SELECT b.name,b.kind,p.coord_x x,p.coord_y y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE p.map_id=$1 AND b.invulnerable AND b.visible`, [P(c, 'mapId')])).rows);
/** Zones de paix du monde (structures, migration 48) : le jeu grise les attaques dedans ; nom caché pour une structure invisible. */
def(mapRoutes, 'get', '/map/{mapId}/zones', null, async c => (await pool.query(`SELECT b.id, CASE WHEN b.visible THEN b.name ELSE 'une structure' END name, p.coord_x x, p.coord_y y, b.peace_radius r
  FROM buildings b JOIN positions p ON p.building_id=b.id WHERE p.map_id=$1 AND b.peace_radius > 0`, [P(c, 'mapId')])).rows);

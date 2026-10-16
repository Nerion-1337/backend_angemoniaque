import { OpenAPIHono } from '@hono/zod-openapi'; import { def, P } from '../lib/route.js'; import { pool } from '../lib/db.js'; import { terrain } from '../game/terrain.js';
export const mapRoutes = new OpenAPIHono();
const SEL = `SELECT p.coord_x x,p.coord_y y, CASE WHEN p.character_id IS NOT NULL THEN 'character' WHEN p.monsters_id IS NOT NULL THEN 'monster' WHEN p.building_id IS NOT NULL THEN 'building' WHEN p.mount_id IS NOT NULL THEN 'mount' ELSE 'item' END kind,
  COALESCE(ch.pseudo,mo.name,b.name) name, ch.race, ch.id char_id, mo.id monster_id, b.id building_id, b.kind building_kind, ch.hp_current, ch.hp_max, s.name rank_name FROM positions p
  LEFT JOIN characters ch ON ch.id=p.character_id LEFT JOIN specializations s ON s.id=ch.specialization_id LEFT JOIN monsters mo ON mo.id=p.monsters_id LEFT JOIN buildings b ON b.id=p.building_id`;
def(mapRoutes, 'get', '/map/{mapId}/area', null, async c => {
  const q = c.req.query(), x = +q.x, y = +q.y, r = Math.min(+q.r || 5, 25);
  return (await pool.query(`${SEL} WHERE p.map_id=$1 AND p.coord_x BETWEEN $2 AND $3 AND p.coord_y BETWEEN $4 AND $5`, [P(c, 'mapId'), x - r, x + r, y - r, y + r])).rows;
});
def(mapRoutes, 'get', '/map/{mapId}/cell', null, async c => {
  const q = c.req.query(), x = +q.x, y = +q.y;
  const e = (await pool.query(`${SEL} WHERE p.map_id=$1 AND p.coord_x=$2 AND p.coord_y=$3 AND p.item_id IS NULL`, [P(c, 'mapId'), x, y])).rows[0];
  return { x, y, terrain: terrain(x, y), entity: e ?? null };
});

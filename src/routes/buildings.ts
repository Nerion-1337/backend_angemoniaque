import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z, P } from '../lib/route.js'; import { tx, ownChar, posOf, fail, log, dist } from '../lib/db.js';
import { travel } from '../game/movement.js'; import { terrain } from '../game/terrain.js'; import { broadcast } from '../realtime/ws.js';
export const buildings = new OpenAPIHono();
const BUILD_COST = 3;
def(buildings, 'post', '/buildings/place', z.object({ characterId: z.number(), kind: z.enum(['wall', 'tower', 'factory', 'totem']), x: z.number().int(), y: z.number().int(), totem: z.object({ stat: z.string(), delta: z.number(), radius: z.number() }).optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const mp = await posOf(db, me.id);
  const { rows: [sc] } = await db.query("SELECT ci.ctid::text, i.name FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND i.slot='scroll' AND i.data->>'kind'=$2 AND NOT ci.in_chest LIMIT 1", [me.id, b.kind]);
  if (!sc) fail(403, 'Parchemin de construction requis');
  if (terrain(b.x, b.y).cost >= 99 || (await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [mp.map_id, b.x, b.y])).rowCount) fail(409, 'Case indisponible');
  const t = await travel(db, me, mp, b, 1, BUILD_COST);                  // trajet + action calculés ensemble
  await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [sc.ctid]);
  const { rows: [bd] } = await db.query('INSERT INTO buildings(name,kind,owner_id,data) VALUES ($1,$2,$3,$4) RETURNING id', [b.kind, b.kind, me.id, JSON.stringify({ hp: 200, ...(b.totem ? { totem: b.totem } : {}) })]);
  await db.query('INSERT INTO positions(map_id,coord_x,coord_y,building_id) VALUES ($1,$2,$3,$4)', [mp.map_id, b.x, b.y, bd.id]);
  await log(db, me.id, `Construit : ${b.kind}`); broadcast(mp.map_id, { type: 'built', x: b.x, y: b.y, kind: b.kind }); return { ok: true, cost: t.cost + BUILD_COST };
}));
def(buildings, 'post', '/buildings/{id}/interact', z.object({ characterId: z.number() }), (c, b) => tx(async db => {   // 0 énergie
  const me = await ownChar(db, c, b.characterId); const mp = await posOf(db, me.id);
  const { rows: [bd] } = await db.query('SELECT b.*,p.map_id,p.coord_x,p.coord_y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.id=$1', [P(c, 'id')]);
  if (!bd || bd.map_id !== mp.map_id || dist(mp, bd) > 1) fail(409, 'Trop loin'); return { id: bd.id, name: bd.name, kind: bd.kind, data: bd.data };
}));

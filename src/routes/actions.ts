import { def, router, z } from '../lib/route.js'; import { tx, ownChar, fail, log, trimLog } from '../lib/db.js';
import { actor, travel, spend } from '../game/movement.js'; import { terrain } from '../game/terrain.js'; import { broadcast } from '../realtime/ws.js';
export const actions = router();
const XY = z.object({ characterId: z.number(), x: z.number().int(), y: z.number().int() }), GATHER = 4;
def(actions, 'post', '/actions/move', XY, (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId), a = await actor(db, ch); const r = await travel(db, ch, a, b, 0);
  await log(db, ch.id, `Déplacement vers ${b.x},${b.y}`); await trimLog(db, ch.id); broadcast(r.mapId, { type: 'moved' }); return { ok: true, cost: r.cost };
}));
/** Récolte : sur place, ou à distance (trajet + 4 énergie). */
def(actions, 'post', '/actions/gather', z.object({ characterId: z.number(), x: z.number().int().optional(), y: z.number().int().optional() }), (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId), a = await actor(db, ch); const tx_ = b.x ?? a.mp.coord_x, ty = b.y ?? a.mp.coord_y, t = terrain(tx_, ty, a.mp.map_id);
  if (!t.resource || (t.kind === 'deep' && !a.mount?.aquatic && !a.mount?.flying)) fail(409, 'Rien à récolter ici');
  if (tx_ !== a.mp.coord_x || ty !== a.mp.coord_y) { if ((await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [a.mp.map_id, tx_, ty])).rowCount) fail(409, 'Case occupée'); await travel(db, ch, a, { x: tx_, y: ty }, 0, GATHER); } else await spend(db, ch, a, GATHER);
  await db.query(`UPDATE characters SET resources=jsonb_set(resources,$2,to_jsonb(COALESCE((resources->>$3)::int,0)+1)) WHERE id=$1`, [ch.id, `{${t.resourceId}}`, t.resourceId]);
  await log(db, ch.id, `Récolte : ${t.resource}`); broadcast(a.mp.map_id, { type: 'moved' }); return { ok: true, resource: t.resource };
}));
/** « S'approcher à côté de… » : trajet jusqu'à la case adjacente d'une cible/structure. */
def(actions, 'post', '/actions/approach', XY, (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId), a = await actor(db, ch); const r = await travel(db, ch, a, b, 1);
  await log(db, ch.id, `S'approche de ${b.x},${b.y}`); broadcast(r.mapId, { type: 'moved' }); return { ok: true, cost: r.cost };
}));

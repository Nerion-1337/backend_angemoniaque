import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z } from '../lib/route.js'; import { tx, ownChar, posOf, fail, log, trimLog } from '../lib/db.js';
import { travel } from '../game/movement.js'; import { terrain } from '../game/terrain.js'; import { broadcast } from '../realtime/ws.js';
export const actions = new OpenAPIHono();
const XY = z.object({ characterId: z.number(), x: z.number().int(), y: z.number().int() });
def(actions, 'post', '/actions/move', XY, (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId); const mp = await posOf(db, ch.id);
  const r = await travel(db, ch, mp, b, 0); await log(db, ch.id, `Déplacement vers ${b.x},${b.y}`); await trimLog(db, ch.id);
  broadcast(mp.map_id, { type: 'moved', characterId: ch.id, x: r.pos.x, y: r.pos.y }); return { ok: true, cost: r.cost };
}));
def(actions, 'post', '/actions/gather', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId); const mp = await posOf(db, ch.id); const t = terrain(mp.coord_x, mp.coord_y);
  if (!t.resource || t.kind === 'lake' || ch.energy_current < 2) fail(409, 'Rien à récolter ou énergie insuffisante');
  await db.query(`UPDATE characters SET energy_current=energy_current-2, resources=jsonb_set(resources,$2,to_jsonb(COALESCE((resources->>$3)::int,0)+1)) WHERE id=$1`, [ch.id, `{${t.resource}}`, t.resource]);
  await log(db, ch.id, `Récolte : ${t.resource}`); return { ok: true, resource: t.resource };
}));

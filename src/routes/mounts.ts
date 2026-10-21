import { OpenAPIHono } from '@hono/zod-openapi'; import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log, posOf } from '../lib/db.js'; import { broadcast } from '../realtime/ws.js'; import { activeMount, isWater } from '../game/movement.js'; import { terrain } from '../game/terrain.js';
export const mounts = router();
def(mounts, 'get', '/mounts/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId'));
  return (await db.query('SELECT m.*,cm.energy_current,cm.hp_current,cm.active FROM character_mounts cm JOIN mounts m ON m.id=cm.mount_id WHERE cm.character_id=$1', [me.id])).rows; }));
def(mounts, 'post', '/mounts/summon', z.object({ characterId: z.number(), mountId: z.number() }), (c, b) => tx(async db => {   // le personnage monte automatiquement
  const me = await ownChar(db, c, b.characterId); await db.query('UPDATE character_mounts SET active=false WHERE character_id=$1', [me.id]);
  const r = await db.query('UPDATE character_mounts SET active=true WHERE character_id=$1 AND mount_id=$2', [me.id, b.mountId]); if (!r.rowCount) fail(404, 'Monture non possédée');
  await log(db, me.id, 'Invoque une monture'); broadcast((await posOf(db, me.id)).map_id, { type: 'moved' }); return { ok: true };
}));
def(mounts, 'post', '/mounts/dismount', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), mp = await posOf(db, me.id), m = await activeMount(db, me.id);
  if (m && !m.flying && terrain(mp.coord_x, mp.coord_y, mp.map_id).kind === 'deep') fail(409, 'Impossible de renvoyer sa monture en eau profonde');
  await db.query('UPDATE character_mounts SET active=false WHERE character_id=$1', [me.id]); broadcast(mp.map_id, { type: 'moved' }); return { ok: true }; }));

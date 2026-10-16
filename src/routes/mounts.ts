import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log } from '../lib/db.js';
export const mounts = new OpenAPIHono();
def(mounts, 'get', '/mounts/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId'));
  return (await db.query('SELECT m.*,cm.energy_current,cm.hp_current,cm.active FROM character_mounts cm JOIN mounts m ON m.id=cm.mount_id WHERE cm.character_id=$1', [me.id])).rows; }));
def(mounts, 'post', '/mounts/summon', z.object({ characterId: z.number(), mountId: z.number() }), (c, b) => tx(async db => {   // le personnage monte automatiquement
  const me = await ownChar(db, c, b.characterId); await db.query('UPDATE character_mounts SET active=false WHERE character_id=$1', [me.id]);
  const r = await db.query('UPDATE character_mounts SET active=true WHERE character_id=$1 AND mount_id=$2', [me.id, b.mountId]); if (!r.rowCount) fail(404, 'Monture non possédée');
  await log(db, me.id, 'Invoque une monture'); return { ok: true };
}));
def(mounts, 'post', '/mounts/dismount', z.object({ characterId: z.number() }), (c, b) => tx(async db => { const me = await ownChar(db, c, b.characterId); await db.query('UPDATE character_mounts SET active=false WHERE character_id=$1', [me.id]); return { ok: true }; }));

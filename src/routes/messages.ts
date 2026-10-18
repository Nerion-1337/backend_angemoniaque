import { OpenAPIHono } from '@hono/zod-openapi'; import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, posOf, fail } from '../lib/db.js'; import { broadcast } from '../realtime/ws.js';
export const messages = router();
const VISION = `SELECT m.id,m.body,m.created_at,ch.pseudo FROM messages m JOIN characters ch ON ch.id=m.sender_id JOIN positions p ON p.character_id=m.sender_id
  WHERE m.channel='vision' AND m.created_at>now()-interval '12 hours' AND p.map_id=$1 AND GREATEST(abs(p.coord_x-$2),abs(p.coord_y-$3))<=$4`;
def(messages, 'post', '/messages', z.object({ characterId: z.number(), channel: z.enum(['vision', 'guild', 'mail']), body: z.string().min(1).max(1000), to: z.string().optional(), subject: z.string().max(80).optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const mp = await posOf(db, me.id);
  if (b.channel === 'guild') { if (!me.guild_id) fail(403, 'Aucune guilde');
    await db.query("INSERT INTO messages(channel,sender_id,guild_id,body) VALUES ('guild',$1,$2,$3)", [me.id, me.guild_id, b.body]);
    await db.query("DELETE FROM messages WHERE channel='guild' AND guild_id=$1 AND id NOT IN (SELECT id FROM messages WHERE channel='guild' AND guild_id=$1 ORDER BY id DESC LIMIT 100)", [me.guild_id]);
  } else if (b.channel === 'vision') { await db.query("INSERT INTO messages(channel,sender_id,map_id,body) VALUES ('vision',$1,$2,$3)", [me.id, mp.map_id, b.body]); broadcast(mp.map_id, { type: 'chat', channel: 'vision' }); }
  else { const { rows: [r] } = await db.query('SELECT id FROM characters WHERE pseudo=$1', [b.to ?? '']); if (!r) fail(404, 'Destinataire introuvable');
    const { rows: [m] } = await db.query("INSERT INTO messages(channel,sender_id,body,subject) VALUES ('mail',$1,$2,$3) RETURNING id", [me.id, b.body, b.subject ?? '(sans objet)']);
    await db.query('INSERT INTO conversation_participants(message_id,character_id,read) VALUES ($1,$2,true),($1,$3,false)', [m.id, me.id, r.id]); }
  return { ok: true };
}));
def(messages, 'get', '/messages/{characterId}/{channel}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId')); const mp = await posOf(db, me.id); const ch = c.req.param('channel');
  if (ch === 'vision') return (await db.query(`${VISION} ORDER BY m.id DESC LIMIT 100`, [mp.map_id, mp.coord_x, mp.coord_y, me.see])).rows.reverse();
  if (ch === 'guild') return (await db.query("SELECT m.body,m.created_at,x.pseudo FROM messages m JOIN characters x ON x.id=m.sender_id WHERE m.channel='guild' AND m.guild_id=$1 ORDER BY m.id", [me.guild_id ?? -1])).rows;
  return (await db.query("SELECT m.id,m.body,m.subject,m.created_at,s.pseudo,cp.read FROM conversation_participants cp JOIN messages m ON m.id=cp.message_id JOIN characters s ON s.id=m.sender_id WHERE cp.character_id=$1 ORDER BY m.id DESC", [me.id])).rows;
}));
def(messages, 'get', '/messages/{characterId}/unread/count', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId')); const mp = await posOf(db, me.id);
  const v = (await db.query(`SELECT count(*)::int n FROM (${VISION} AND m.created_at>$5) t`, [mp.map_id, mp.coord_x, mp.coord_y, me.see, me.last_vision_read])).rows[0].n;
  const g = (await db.query("SELECT count(*)::int n FROM messages WHERE channel='guild' AND guild_id=$1 AND created_at>$2 AND sender_id<>$3", [me.guild_id ?? -1, me.last_guild_read, me.id])).rows[0].n;
  const m = (await db.query('SELECT count(*)::int n FROM conversation_participants WHERE character_id=$1 AND NOT read', [me.id])).rows[0].n; return { vision: v, guild: g, mail: m };
}));
def(messages, 'post', '/messages/{characterId}/read', z.object({ channel: z.enum(['vision', 'guild', 'mail']) }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  if (b.channel === 'mail') await db.query('UPDATE conversation_participants SET read=true WHERE character_id=$1', [me.id]);
  else await db.query(`UPDATE characters SET last_${b.channel}_read=now() WHERE id=$1`, [me.id]); return { ok: true };
}));

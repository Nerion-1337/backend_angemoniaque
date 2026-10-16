import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z, P } from '../lib/route.js'; import { tx, ownChar, fail } from '../lib/db.js';
export const guilds = new OpenAPIHono();
const inGuild = async (db: any, c: any, cid: number) => { const me = await ownChar(db, c, cid); if (!me.guild_id) fail(403, 'Aucune guilde'); return me; };
def(guilds, 'post', '/guilds', z.object({ characterId: z.number(), name: z.string().min(3).max(30) }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); if (me.guild_id) fail(409, 'Déjà en guilde');
  const { rows: [g] } = await db.query('INSERT INTO guilds(name,leader_id) VALUES ($1,$2) RETURNING id', [b.name, me.id]); await db.query('UPDATE characters SET guild_id=$2 WHERE id=$1', [me.id, g.id]); return g;
}));
def(guilds, 'post', '/guilds/join', z.object({ characterId: z.number(), name: z.string() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const { rows: [g] } = await db.query('SELECT id FROM guilds WHERE name=$1', [b.name]); if (!g) fail(404, 'Guilde introuvable');
  await db.query('UPDATE characters SET guild_id=$2 WHERE id=$1', [me.id, g.id]); return { ok: true };
}));
def(guilds, 'post', '/guilds/leave', z.object({ characterId: z.number() }), (c, b) => tx(async db => { const me = await inGuild(db, c, b.characterId); await db.query('UPDATE characters SET guild_id=NULL WHERE id=$1', [me.id]); return { ok: true }; }));
def(guilds, 'get', '/guilds/{characterId}', null, c => tx(async db => {
  const me = await inGuild(db, c, P(c, 'characterId'));
  const { rows: [g] } = await db.query('SELECT * FROM guilds WHERE id=$1', [me.guild_id]);
  return { guild: g, members: (await db.query('SELECT id,pseudo,race FROM characters WHERE guild_id=$1', [g.id])).rows,
    folders: (await db.query('SELECT f.id,f.name,(SELECT json_agg(json_build_object(\'id\',t.id,\'title\',t.title)) FROM guild_topics t WHERE t.folder_id=f.id) topics FROM guild_folders f WHERE f.guild_id=$1', [g.id])).rows };
}));
def(guilds, 'post', '/guilds/folders', z.object({ characterId: z.number(), name: z.string() }), (c, b) => tx(async db => { const me = await inGuild(db, c, b.characterId);
  return (await db.query('INSERT INTO guild_folders(guild_id,name) VALUES ($1,$2) RETURNING id', [me.guild_id, b.name])).rows[0]; }));
def(guilds, 'post', '/guilds/topics', z.object({ characterId: z.number(), folderId: z.number(), title: z.string(), body: z.string() }), (c, b) => tx(async db => {
  const me = await inGuild(db, c, b.characterId); if (!(await db.query('SELECT 1 FROM guild_folders WHERE id=$1 AND guild_id=$2', [b.folderId, me.guild_id])).rowCount) fail(404, 'Dossier introuvable');
  const { rows: [t] } = await db.query('INSERT INTO guild_topics(folder_id,title,author_id) VALUES ($1,$2,$3) RETURNING id', [b.folderId, b.title, me.id]);
  await db.query('INSERT INTO guild_posts(topic_id,author_id,body) VALUES ($1,$2,$3)', [t.id, me.id, b.body]); return t;
}));
def(guilds, 'post', '/guilds/posts', z.object({ characterId: z.number(), topicId: z.number(), body: z.string() }), (c, b) => tx(async db => {
  const me = await inGuild(db, c, b.characterId); if (!(await db.query('SELECT 1 FROM guild_topics t JOIN guild_folders f ON f.id=t.folder_id WHERE t.id=$1 AND f.guild_id=$2', [b.topicId, me.guild_id])).rowCount) fail(404, 'Sujet introuvable');
  await db.query('INSERT INTO guild_posts(topic_id,author_id,body) VALUES ($1,$2,$3)', [b.topicId, me.id, b.body]); return { ok: true };
}));
def(guilds, 'get', '/guilds/topics/{characterId}/{topicId}', null, c => tx(async db => { const me = await inGuild(db, c, P(c, 'characterId'));
  return (await db.query('SELECT p.body,p.created_at,ch.pseudo FROM guild_posts p JOIN characters ch ON ch.id=p.author_id JOIN guild_topics t ON t.id=p.topic_id JOIN guild_folders f ON f.id=t.folder_id WHERE p.topic_id=$1 AND f.guild_id=$2 ORDER BY p.id', [P(c, 'topicId'), me.guild_id])).rows; }));

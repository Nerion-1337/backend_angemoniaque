import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log } from '../lib/db.js';
export const guilds = router();
const PERMS = ['accept_applicants', 'send_invites', 'create_topics', 'assign_ranks'] as const;
const ALL = Object.fromEntries(PERMS.map(p => [p, true])), DEFAULT_RANKS = [['Chef', true, ALL], ['Officier', false, ALL], ['Membre', false, { create_topics: true }]] as const;
const words = (t: string) => (t.trim() === '' ? 0 : t.trim().split(/\s+/).length);
/** Membre de guilde avec son rang : le Chef a tous les droits. */
async function member(db: any, c: any, cid: number) {
  const me = await ownChar(db, c, cid); if (!me.guild_id) fail(403, 'Vous n’êtes dans aucune guilde');
  const { rows: [rk] } = await db.query('SELECT * FROM guild_ranks WHERE id=$1', [me.guild_rank_id]);
  return { me, rank: rk, leader: !!rk?.is_leader, can: (p: string) => !!rk?.is_leader || !!rk?.permissions?.[p] };
}
const need = (m: any, p: string) => { if (!m.can(p)) fail(403, 'Votre rang ne permet pas cette action'); };
const lowestRank = async (db: any, gid: number) => (await db.query("SELECT id FROM guild_ranks WHERE guild_id=$1 AND NOT is_leader ORDER BY id DESC LIMIT 1", [gid])).rows[0].id;
/** Vrai si aucun autre membre ne porte un rang Chef : le dernier Chef ne peut ni quitter ni changer de rang. */
const lastChef = async (db: any, gid: number, meId: number) =>
  !(await db.query('SELECT 1 FROM characters c JOIN guild_ranks r ON r.id = c.guild_rank_id WHERE c.guild_id = $1 AND c.id <> $2 AND r.is_leader LIMIT 1', [gid, meId])).rowCount;
def(guilds, 'post', '/guilds', z.object({ characterId: z.number(), name: z.string().min(3).max(30), tag: z.string().min(2).max(6).optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); if (me.guild_id) fail(409, 'Vous êtes déjà dans une guilde');
  const { rows: [g] } = await db.query('INSERT INTO guilds(name,leader_id,tag) VALUES ($1,$2,$3) RETURNING id', [b.name, me.id, (b.tag ?? b.name.slice(0, 4)).toUpperCase()]);
  let chef = 0; for (const [n, lead, perms] of DEFAULT_RANKS) { const { rows: [r] } = await db.query('INSERT INTO guild_ranks(guild_id,name,is_leader,permissions) VALUES ($1,$2,$3,$4) RETURNING id', [g.id, n, lead, JSON.stringify(perms)]); if (lead) chef = r.id; }
  await db.query('UPDATE characters SET guild_id=$2, guild_rank_id=$3 WHERE id=$1', [me.id, g.id, chef]); await log(db, me.id, `Fonde la guilde ${b.name}`); return g;
}));
def(guilds, 'post', '/guilds/apply', z.object({ characterId: z.number(), name: z.string() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); if (me.guild_id) fail(409, 'Vous êtes déjà dans une guilde');
  const { rows: [g] } = await db.query('SELECT id FROM guilds WHERE name=$1', [b.name]); if (!g) fail(404, 'Guilde introuvable');
  await db.query('INSERT INTO guild_applications(guild_id,character_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [g.id, me.id]); return { ok: true };
}));
def(guilds, 'get', '/guilds/invitations/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId'));
  return (await db.query('SELECT i.id,g.name guild,g.tag FROM guild_invitations i JOIN guilds g ON g.id=i.guild_id WHERE i.character_id=$1', [me.id])).rows; }));
def(guilds, 'post', '/guilds/invitations/{id}/accept', z.object({ characterId: z.number(), accept: z.boolean() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const { rows: [i] } = await db.query('DELETE FROM guild_invitations WHERE id=$1 AND character_id=$2 RETURNING guild_id', [P(c, 'id'), me.id]); if (!i) fail(404, 'Invitation introuvable');
  if (b.accept) { if (me.guild_id) fail(409, 'Déjà dans une guilde'); await db.query('UPDATE characters SET guild_id=$2, guild_rank_id=$3 WHERE id=$1', [me.id, i.guild_id, await lowestRank(db, i.guild_id)]); } return { ok: true };
}));
def(guilds, 'post', '/guilds/leave', z.object({ characterId: z.number() }), (c, b) => tx(async db => { const m = await member(db, c, b.characterId);
  if (m.leader && await lastChef(db, m.me.guild_id, m.me.id)) fail(409, 'Le dernier Chef ne peut pas quitter la guilde');
  await db.query('UPDATE characters SET guild_id=NULL, guild_rank_id=NULL WHERE id=$1', [m.me.id]); return { ok: true }; }));
def(guilds, 'get', '/guilds/{characterId}', null, c => tx(async db => {
  const m = await member(db, c, P(c, 'characterId')), gid = m.me.guild_id; const { rows: [g] } = await db.query('SELECT id,name,tag,logo,mantra,description FROM guilds WHERE id=$1', [gid]);
  const vis = (r: any) => m.leader || (r.visible_ranks ?? []).includes(m.rank.name);
  const folders = (await db.query('SELECT id,name,visible_ranks FROM guild_folders WHERE guild_id=$1 ORDER BY sort_order,id', [gid])).rows.filter(vis);
  for (const f of folders) f.topics = (await db.query('SELECT t.id,t.title,t.visible_ranks,ch.pseudo author FROM guild_topics t LEFT JOIN characters ch ON ch.id=t.author_id WHERE t.folder_id=$1 ORDER BY t.sort_order,t.id', [f.id])).rows.filter(vis);
  return { guild: g, me: { rank: m.rank.name, leader: m.leader, permissions: m.leader ? ALL : m.rank.permissions },
    ranks: (await db.query('SELECT id,name,is_leader,permissions FROM guild_ranks WHERE guild_id=$1 ORDER BY id', [gid])).rows,
    members: (await db.query('SELECT c.id,c.pseudo,c.race,r.name rank,r.id rank_id FROM characters c LEFT JOIN guild_ranks r ON r.id=c.guild_rank_id WHERE c.guild_id=$1 ORDER BY r.id,c.pseudo', [gid])).rows,
    applicants: m.can('accept_applicants') ? (await db.query('SELECT a.id,c.pseudo,c.race FROM guild_applications a JOIN characters c ON c.id=a.character_id WHERE a.guild_id=$1', [gid])).rows : [], folders };
}));
def(guilds, 'post', '/guilds/presentation', z.object({ characterId: z.number(), logo: z.string().max(2_800_000).optional(), mantra: z.string().max(120, '120 caractères maximum').optional(), description: z.string().optional() }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); if (!m.leader) fail(403, 'Réservé au Chef');
  if (b.description !== undefined && words(b.description) > 1000) fail(400, 'Description : 1000 mots maximum');
  await db.query('UPDATE guilds SET logo=COALESCE($2,logo), mantra=COALESCE($3,mantra), description=COALESCE($4,description) WHERE id=$1', [m.me.guild_id, b.logo ?? null, b.mantra ?? null, b.description ?? null]); return { ok: true };
}));
def(guilds, 'post', '/guilds/invite', z.object({ characterId: z.number(), pseudo: z.string() }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); need(m, 'send_invites'); const { rows: [t] } = await db.query('SELECT id,guild_id FROM characters WHERE pseudo=$1', [b.pseudo]); if (!t) fail(404, 'Joueur introuvable'); if (t.guild_id) fail(409, 'Ce joueur est déjà dans une guilde');
  await db.query('INSERT INTO guild_invitations(guild_id,character_id,from_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [m.me.guild_id, t.id, m.me.id]); return { ok: true };
}));
def(guilds, 'post', '/guilds/applicants/{id}/answer', z.object({ characterId: z.number(), accept: z.boolean() }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); need(m, 'accept_applicants'); const { rows: [a] } = await db.query('DELETE FROM guild_applications WHERE id=$1 AND guild_id=$2 RETURNING character_id', [P(c, 'id'), m.me.guild_id]); if (!a) fail(404, 'Postulant introuvable');
  if (b.accept) await db.query('UPDATE characters SET guild_id=$2, guild_rank_id=$3 WHERE id=$1 AND guild_id IS NULL', [a.character_id, m.me.guild_id, await lowestRank(db, m.me.guild_id)]); return { ok: true };
}));
def(guilds, 'post', '/guilds/members/rank', z.object({ characterId: z.number(), memberId: z.number(), rankId: z.number() }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); need(m, 'assign_ranks'); const { rows: [rk] } = await db.query('SELECT * FROM guild_ranks WHERE id=$1 AND guild_id=$2', [b.rankId, m.me.guild_id]); if (!rk) fail(404, 'Rang introuvable');
  if (rk.is_leader && !m.leader) fail(403, 'Seul le Chef peut nommer un Chef');
  const { rows: [tgt] } = await db.query('SELECT c.guild_rank_id, r.is_leader chef FROM characters c LEFT JOIN guild_ranks r ON r.id = c.guild_rank_id WHERE c.id = $1 AND c.guild_id = $2', [b.memberId, m.me.guild_id]); if (!tgt) fail(404, 'Membre introuvable');
  if (tgt.chef && !rk.is_leader && await lastChef(db, m.me.guild_id, b.memberId)) fail(409, 'Le dernier Chef ne peut pas changer de rang');
  await db.query('UPDATE characters SET guild_rank_id=$3 WHERE id=$1 AND guild_id=$2', [b.memberId, m.me.guild_id, b.rankId]); return { ok: true };
}));
def(guilds, 'post', '/guilds/ranks', z.object({ characterId: z.number(), name: z.string().min(2).max(24), permissions: z.record(z.boolean()).default({}) }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); if (!m.leader) fail(403, 'Réservé au Chef'); const perms = Object.fromEntries(PERMS.map(p => [p, !!b.permissions[p]]));
  return (await db.query('INSERT INTO guild_ranks(guild_id,name,permissions) VALUES ($1,$2,$3) RETURNING id', [m.me.guild_id, b.name, JSON.stringify(perms)])).rows[0];
}));
def(guilds, 'post', '/guilds/ranks/{id}/permission', z.object({ characterId: z.number(), permission: z.enum(PERMS), value: z.boolean() }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); if (!m.leader) fail(403, 'Réservé au Chef');
  const r = await db.query('UPDATE guild_ranks SET permissions=jsonb_set(permissions,$3,to_jsonb($4::boolean)) WHERE id=$1 AND guild_id=$2 AND NOT is_leader', [P(c, 'id'), m.me.guild_id, `{${b.permission}}`, b.value]); if (!r.rowCount) fail(404, 'Rang introuvable ou non modifiable'); return { ok: true };
}));
def(guilds, 'post', '/guilds/ranks/{id}/rename', z.object({ characterId: z.number(), name: z.string().min(2).max(24) }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); if (!m.leader) fail(403, 'Réservé au Chef');
  const nm = b.name.trim(); if (nm.length < 2) fail(400, 'Nom de 2 caractères minimum');
  const { rows: [rk] } = await db.query('SELECT * FROM guild_ranks WHERE id=$1 AND guild_id=$2', [P(c, 'id'), m.me.guild_id]); if (!rk) fail(404, 'Rang introuvable');
  if (rk.is_leader) fail(403, 'Le rang Chef ne peut pas être renommé');
  if ((await db.query('SELECT 1 FROM guild_ranks WHERE guild_id=$1 AND name=$2 AND id<>$3', [m.me.guild_id, nm, P(c, 'id')])).rowCount) fail(409, 'Ce nom est déjà utilisé');
  await db.query('UPDATE guild_ranks SET name=$3 WHERE id=$1 AND guild_id=$2', [P(c, 'id'), m.me.guild_id, nm]);
  // La visibilité du forum se fait par nom de rang : on porte l'ancien nom vers le nouveau dans catégories et sujets.
  // `visible_ranks` est un text[] : on repasse un tableau JS (pg l'encode en littéral array).
  const swap = (arr: string[]) => arr.map(x => (x === rk.name ? nm : x));
  for (const f of (await db.query('SELECT id, visible_ranks FROM guild_folders WHERE guild_id=$1', [m.me.guild_id])).rows)
    if ((f.visible_ranks ?? []).includes(rk.name))
      await db.query('UPDATE guild_folders SET visible_ranks=$2 WHERE id=$1', [f.id, swap(f.visible_ranks ?? [])]);
  for (const t of (await db.query('SELECT t.id, t.visible_ranks FROM guild_topics t JOIN guild_folders f ON f.id = t.folder_id WHERE f.guild_id=$1', [m.me.guild_id])).rows)
    if ((t.visible_ranks ?? []).includes(rk.name))
      await db.query('UPDATE guild_topics SET visible_ranks=$2 WHERE id=$1', [t.id, swap(t.visible_ranks ?? [])]);
  return { ok: true }; }));
def(guilds, 'post', '/guilds/reorder', z.object({ characterId: z.number(), kind: z.enum(['folders', 'topics']), folderId: z.number().optional(), ids: z.array(z.number()).max(200) }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); need(m, 'create_topics');
  if (b.kind === 'folders') { for (let i = 0; i < b.ids.length; i++) await db.query('UPDATE guild_folders SET sort_order=$3 WHERE id=$1 AND guild_id=$2', [b.ids[i], m.me.guild_id, i]); return { ok: true }; }
  if (!(await db.query('SELECT 1 FROM guild_folders WHERE id=$1 AND guild_id=$2', [b.folderId ?? 0, m.me.guild_id])).rowCount) fail(404, 'Catégorie introuvable');
  for (let i = 0; i < b.ids.length; i++) await db.query('UPDATE guild_topics SET sort_order=$3 WHERE id=$1 AND folder_id=$2', [b.ids[i], b.folderId, i]); return { ok: true }; }));
// ----- Forum : catégories et sujets visibles par rang -----
const Ranks = z.array(z.string()).default([]);
def(guilds, 'post', '/guilds/folders', z.object({ characterId: z.number(), name: z.string().min(1).max(60), visibleRanks: Ranks }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); need(m, 'create_topics'); return (await db.query('INSERT INTO guild_folders(guild_id,name,visible_ranks) VALUES ($1,$2,$3) RETURNING id', [m.me.guild_id, b.name, b.visibleRanks.length ? b.visibleRanks : ['Chef']])).rows[0];
}));
def(guilds, 'post', '/guilds/topics', z.object({ characterId: z.number(), folderId: z.number(), title: z.string().min(1).max(100), body: z.string().min(1), visibleRanks: Ranks }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); need(m, 'create_topics'); if (!(await db.query('SELECT 1 FROM guild_folders WHERE id=$1 AND guild_id=$2', [b.folderId, m.me.guild_id])).rowCount) fail(404, 'Catégorie introuvable');
  const { rows: [t] } = await db.query('INSERT INTO guild_topics(folder_id,title,author_id,visible_ranks) VALUES ($1,$2,$3,$4) RETURNING id', [b.folderId, b.title, m.me.id, b.visibleRanks.length ? b.visibleRanks : ['Chef']]);
  await db.query('INSERT INTO guild_posts(topic_id,author_id,body) VALUES ($1,$2,$3)', [t.id, m.me.id, b.body]); return t;
}));
const topicOf = async (db: any, m: any, tid: number) => { const { rows: [t] } = await db.query('SELECT t.* FROM guild_topics t JOIN guild_folders f ON f.id=t.folder_id WHERE t.id=$1 AND f.guild_id=$2', [tid, m.me.guild_id]);
  if (!t || !(m.leader || (t.visible_ranks ?? []).includes(m.rank.name))) fail(404, 'Sujet introuvable'); return t; };
def(guilds, 'post', '/guilds/posts', z.object({ characterId: z.number(), topicId: z.number(), body: z.string().min(1) }), (c, b) => tx(async db => {
  const m = await member(db, c, b.characterId); await topicOf(db, m, b.topicId); await db.query('INSERT INTO guild_posts(topic_id,author_id,body) VALUES ($1,$2,$3)', [b.topicId, m.me.id, b.body]); return { ok: true };
}));
def(guilds, 'get', '/guilds/topics/{characterId}/{topicId}', null, c => tx(async db => { const m = await member(db, c, P(c, 'characterId')); await topicOf(db, m, P(c, 'topicId'));
  return (await db.query('SELECT p.body,p.created_at,ch.pseudo FROM guild_posts p JOIN characters ch ON ch.id=p.author_id WHERE p.topic_id=$1 ORDER BY p.id', [P(c, 'topicId')])).rows; }));

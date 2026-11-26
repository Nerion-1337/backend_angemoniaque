import { def, router, z, P } from '../lib/route.js'; import { pool, tx, fail } from '../lib/db.js'; import { audit } from '../lib/audit.js';
import { ANON, isStaff, readDenied, postDenied, type Viewer } from '../game/forumAccess.js';
/**
 * Annonces, forum public et pages légales (migration 40). Lecture sans compte (jeton facultatif : middleware) ; écrire exige un
 * compte, les CGU en vigueur acceptées et pas de sourdine. Modération (rôles mod / admin) : /forum/mod/* ; réglages réservés à
 * l'admin (catégories et leurs accès, pages légales, rôle modérateur) : /admin/forum/*, /admin/legal/*.
 * Le contenu est du texte brut (affiché comme texte par le front). Auteur affiché : pseudo du premier personnage du compte,
 * sinon « Voyageur #id » ; jamais l'email.
 */
export const forum = router();
const PAGE = 20, Title = z.string().trim().min(3, '3 caractères minimum').max(120), Body = z.string().trim().min(1, 'message vide').max(10000);
const AUTHOR = `COALESCE((SELECT ch.pseudo FROM characters ch WHERE ch.account_id=a.id ORDER BY ch.id LIMIT 1), 'Voyageur #' || a.id)`;
export const tosVersion = async (db: any = pool) => Number((await db.query("SELECT version FROM legal_pages WHERE key='cgu'")).rows[0]?.version ?? 1);
export async function viewerOf(c: any): Promise<Viewer & { id?: number; tosVersion: number }> {
  const sub = c.get('acc')?.sub, tosV = await tosVersion(); if (!sub) return { ...ANON, tosVersion: tosV };
  const { rows: [a] } = await pool.query(`SELECT a.id, a.role, a.tos_version, COALESCE(a.forum_muted_until > now(), false) muted,
    COALESCE((SELECT jsonb_agg(DISTINCT ch.race) FROM characters ch WHERE ch.account_id=a.id), '[]') races,
    COALESCE((SELECT max(s.current_rank) FROM characters ch JOIN specializations s ON s.id=ch.specialization_id WHERE ch.account_id=a.id), 0) rank
    FROM accounts a WHERE a.id=$1`, [sub]);
  if (!a) return { ...ANON, tosVersion: tosV };
  return { id: a.id, logged: true, role: a.role, races: a.races, rank: Number(a.rank), tos: a.tos_version != null && a.tos_version >= tosV, muted: a.muted, tosVersion: tosV };
}
const me = (v: any) => ({ logged: v.logged, role: v.role, staff: isStaff(v), admin: v.role === 'admin', tos: v.tos, tosVersion: v.tosVersion, muted: v.muted });
const needLogin = (v: any) => { if (!v.logged) fail(401, 'Connectez-vous pour continuer'); return v as Viewer & { id: number }; };
const needStaff = (v: any) => { if (!isStaff(v)) fail(403, 'Réservé aux modérateurs'); return v as Viewer & { id: number }; };
const catRow = async (id: number) => { const { rows: [k] } = await pool.query('SELECT * FROM forum_categories WHERE id=$1', [id]); if (!k) fail(404, 'Catégorie introuvable'); return k; };
async function topicRow(id: number, v: Viewer) {
  const { rows: [t] } = await pool.query('SELECT * FROM forum_topics WHERE id=$1', [id]); if (!t || (t.hidden && !isStaff(v))) fail(404, 'Sujet introuvable');
  const cat = await catRow(t.category_id); const no = readDenied(cat, v); if (no) fail(403, no); return { t, cat };
}
const pageOf = (c: any) => Math.max(1, Math.trunc(Number(c.req.query('page')) || 1));

// ---- Pages légales
def(forum, 'get', '/legal', null, async () => (await pool.query('SELECT key, title, version, updated_at FROM legal_pages ORDER BY position, key')).rows);
def(forum, 'get', '/legal/{key}', null, async c => { const { rows: [p] } = await pool.query('SELECT key, title, body, version, updated_at FROM legal_pages WHERE key=$1', [c.req.param('key')]); if (!p) fail(404, 'Page introuvable'); return p; });
def(forum, 'post', '/legal/accept', null, async c => { const v = needLogin(await viewerOf(c));
  await pool.query('UPDATE accounts SET tos_version=$2, tos_accepted_at=now() WHERE id=$1', [v.id, await tosVersion()]); return { ok: true, tosVersion: await tosVersion() }; });

// ---- Lecture
def(forum, 'get', '/forum', null, async c => {
  const v = await viewerOf(c);
  const { rows } = await pool.query(`SELECT k.*, (SELECT count(*) FROM forum_topics t WHERE t.category_id=k.id AND (NOT t.hidden OR $1))::int topics,
    (SELECT count(*) FROM forum_posts p JOIN forum_topics t ON t.id=p.topic_id WHERE t.category_id=k.id AND (NOT t.hidden OR $1) AND (NOT p.hidden OR $1))::int posts,
    (SELECT jsonb_build_object('topic_id', t.id, 'title', t.title, 'at', t.last_post_at) FROM forum_topics t WHERE t.category_id=k.id AND (NOT t.hidden OR $1) ORDER BY t.last_post_at DESC LIMIT 1) last
    FROM forum_categories k ORDER BY k.position, k.id`, [isStaff(v)]);
  const categories = rows.filter(k => isStaff(v) || (!k.hidden && k.read_access !== 'staff')).map(k => { const denied = readDenied(k, v);
    return { ...k, denied, canPost: !denied && !postDenied(k, v), postReason: denied ? null : postDenied(k, v), ...(denied ? { last: null } : {}) }; });
  return { me: me(v), categories };
});
def(forum, 'get', '/forum/categories/{id}', null, async c => {
  const v = await viewerOf(c), cat = await catRow(P(c, 'id')), no = readDenied(cat, v); if (no) fail(403, no);
  if (cat.hidden && !isStaff(v)) fail(404, 'Catégorie introuvable');
  const page = pageOf(c), staff = isStaff(v);
  const total = Number((await pool.query('SELECT count(*) n FROM forum_topics WHERE category_id=$1 AND (NOT hidden OR $2)', [cat.id, staff])).rows[0].n);
  const { rows: topics } = await pool.query(`SELECT t.id, t.title, t.pinned, t.locked, t.hidden, t.created_at, t.last_post_at, ${AUTHOR} author, a.role author_role,
    (SELECT count(*) FROM forum_posts p WHERE p.topic_id=t.id AND (NOT p.hidden OR $2))::int - 1 replies
    FROM forum_topics t LEFT JOIN accounts a ON a.id=t.account_id WHERE t.category_id=$1 AND (NOT t.hidden OR $2)
    ORDER BY t.pinned DESC, t.last_post_at DESC, t.id DESC LIMIT ${PAGE} OFFSET $3`, [cat.id, staff, (page - 1) * PAGE]);
  return { me: me(v), category: cat, canPost: !postDenied(cat, v), postReason: postDenied(cat, v), topics, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
});
def(forum, 'get', '/forum/topics/{id}', null, async c => {
  const v = await viewerOf(c), { t, cat } = await topicRow(P(c, 'id'), v), staff = isStaff(v), page = pageOf(c);
  const total = Number((await pool.query('SELECT count(*) n FROM forum_posts WHERE topic_id=$1 AND (NOT hidden OR $2)', [t.id, staff])).rows[0].n);
  const { rows: posts } = await pool.query(`SELECT p.id, p.body, p.hidden, p.created_at, p.edited_at, ${AUTHOR} author, a.role author_role,
    (p.account_id = $3) mine, CASE WHEN $2 THEN p.account_id END author_id, CASE WHEN $2 THEN a.forum_muted_until END author_muted_until,
    CASE WHEN $2 THEN (SELECT count(*) FROM forum_reports r WHERE r.post_id=p.id AND r.resolved_at IS NULL)::int END reports,
    (p.id = (SELECT min(id) FROM forum_posts WHERE topic_id=p.topic_id)) first
    FROM forum_posts p LEFT JOIN accounts a ON a.id=p.account_id WHERE p.topic_id=$1 AND (NOT p.hidden OR $2) ORDER BY p.id LIMIT ${PAGE} OFFSET $4`, [t.id, staff, v.id ?? null, (page - 1) * PAGE]);
  const reason = postDenied(cat, v, t);
  return { me: me(v), topic: t, category: { id: cat.id, name: cat.name, kind: cat.kind }, posts, canReply: !reason, replyReason: reason, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
});

// ---- Écriture (membres)
def(forum, 'post', '/forum/categories/{id}/topics', z.object({ title: Title, body: Body }), async (c, b) => {
  const v = needLogin(await viewerOf(c)), cat = await catRow(P(c, 'id')), no = postDenied(cat, v); if (no) fail(403, no);
  return tx(async db => {
    const { rows: [t] } = await db.query('INSERT INTO forum_topics(category_id, account_id, title) VALUES ($1,$2,$3) RETURNING id', [cat.id, v.id, b.title]);
    await db.query('INSERT INTO forum_posts(topic_id, account_id, body) VALUES ($1,$2,$3)', [t.id, v.id, b.body]); return { id: t.id };
  });
});
def(forum, 'post', '/forum/topics/{id}/posts', z.object({ body: Body }), async (c, b) => {
  const v = needLogin(await viewerOf(c)), { t, cat } = await topicRow(P(c, 'id'), v), no = postDenied(cat, v, t); if (no) fail(403, no);
  return tx(async db => { const { rows: [p] } = await db.query('INSERT INTO forum_posts(topic_id, account_id, body) VALUES ($1,$2,$3) RETURNING id', [t.id, v.id, b.body]);
    await db.query('UPDATE forum_topics SET last_post_at=now() WHERE id=$1', [t.id]); return { id: p.id }; });
});
async function postRow(id: number, v: Viewer) {
  const { rows: [p] } = await pool.query('SELECT * FROM forum_posts WHERE id=$1', [id]); if (!p || (p.hidden && !isStaff(v))) fail(404, 'Message introuvable');
  const { t, cat } = await topicRow(p.topic_id, v); return { p, t, cat, first: Number((await pool.query('SELECT min(id) m FROM forum_posts WHERE topic_id=$1', [t.id])).rows[0].m) === p.id };
}
def(forum, 'put', '/forum/posts/{id}', z.object({ body: Body, title: Title.optional() }), async (c, b) => {
  const v = needLogin(await viewerOf(c)), { p, t, cat, first } = await postRow(P(c, 'id'), v), staff = isStaff(v);
  if (!staff) { if (p.account_id !== v.id) fail(403, 'Vous ne pouvez modifier que vos messages'); const no = postDenied(cat, v, t); if (no) fail(403, no); }
  await pool.query('UPDATE forum_posts SET body=$2, edited_at=now(), edited_by=$3 WHERE id=$1', [p.id, b.body, v.id]);
  if (first && b.title) await pool.query('UPDATE forum_topics SET title=$2 WHERE id=$1', [t.id, b.title]);   // titre modifiable avec le 1er message
  if (staff && p.account_id !== v.id) await audit(c, 'forum.post.edit', 'forum_post', p.id, { body: p.body }, { body: b.body });
  return { ok: true };
});
def(forum, 'delete', '/forum/posts/{id}', null, async c => {
  const v = needLogin(await viewerOf(c)), { p, t, first } = await postRow(P(c, 'id'), v), staff = isStaff(v);
  if (!staff && p.account_id !== v.id) fail(403, 'Vous ne pouvez supprimer que vos messages');
  if (first) {   // 1er message = le sujet : l'auteur ne le supprime que sans réponse ; le staff toujours
    const replies = Number((await pool.query('SELECT count(*) n FROM forum_posts WHERE topic_id=$1', [t.id])).rows[0].n) - 1;
    if (!staff && replies > 0) fail(409, 'Ce sujet a des réponses : demandez à l\'équipe de le retirer');
    await pool.query('DELETE FROM forum_topics WHERE id=$1', [t.id]); if (staff) await audit(c, 'forum.topic.delete', 'forum_topic', t.id, { title: t.title }, null);
    return { ok: true, topicDeleted: true };
  }
  await pool.query('DELETE FROM forum_posts WHERE id=$1', [p.id]); if (staff && p.account_id !== v.id) await audit(c, 'forum.post.delete', 'forum_post', p.id, { body: p.body }, null);
  return { ok: true };
});
def(forum, 'post', '/forum/posts/{id}/report', z.object({ reason: z.string().trim().min(3, 'précisez le motif').max(500) }), async (c, b) => {
  const v = needLogin(await viewerOf(c)), { p } = await postRow(P(c, 'id'), v);
  await pool.query('INSERT INTO forum_reports(post_id, account_id, reason) VALUES ($1,$2,$3) ON CONFLICT (post_id, account_id) DO UPDATE SET reason=EXCLUDED.reason, resolved_at=NULL', [p.id, v.id, b.reason]);
  return { ok: true };
});

// ---- Modération (mod / admin)
def(forum, 'put', '/forum/mod/topics/{id}', z.object({ title: Title.optional(), pinned: z.boolean().optional(), locked: z.boolean().optional(), hidden: z.boolean().optional(), category_id: z.number().int().optional() }), async (c, b) => {
  needStaff(await viewerOf(c)); const id = P(c, 'id'), { rows: [before] } = await pool.query('SELECT * FROM forum_topics WHERE id=$1', [id]); if (!before) fail(404, 'Sujet introuvable');
  if (b.category_id !== undefined) await catRow(b.category_id);
  const cols = (['title', 'pinned', 'locked', 'hidden', 'category_id'] as const).filter(k => b[k] !== undefined); if (!cols.length) fail(400, 'Aucun changement');
  const { rows: [t] } = await pool.query(`UPDATE forum_topics SET ${cols.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`, [id, ...cols.map(k => b[k])]);
  await audit(c, 'forum.topic.update', 'forum_topic', id, Object.fromEntries(cols.map(k => [k, before[k]])), b); return t;
});
def(forum, 'delete', '/forum/mod/topics/{id}', null, async c => { needStaff(await viewerOf(c)); const id = P(c, 'id');
  const { rows: [t] } = await pool.query('DELETE FROM forum_topics WHERE id=$1 RETURNING title', [id]); if (!t) fail(404, 'Sujet introuvable');
  await audit(c, 'forum.topic.delete', 'forum_topic', id, t, null); return { ok: true }; });
def(forum, 'put', '/forum/mod/posts/{id}', z.object({ hidden: z.boolean() }), async (c, b) => { needStaff(await viewerOf(c)); const id = P(c, 'id');
  if (!(await pool.query('UPDATE forum_posts SET hidden=$2 WHERE id=$1', [id, b.hidden])).rowCount) fail(404, 'Message introuvable');
  if (b.hidden) await pool.query('UPDATE forum_reports SET resolved_at=now(), resolved_by=$2 WHERE post_id=$1 AND resolved_at IS NULL', [id, c.get('acc').sub]);
  await audit(c, b.hidden ? 'forum.post.hide' : 'forum.post.show', 'forum_post', id); return { ok: true }; });
def(forum, 'get', '/forum/mod/reports', null, async c => { needStaff(await viewerOf(c));
  return (await pool.query(`SELECT r.id, r.reason, r.created_at, p.id post_id, left(p.body, 300) excerpt, p.hidden, t.id topic_id, t.title,
    ${AUTHOR} author, p.account_id author_id, (SELECT COALESCE((SELECT ch.pseudo FROM characters ch WHERE ch.account_id=r.account_id ORDER BY ch.id LIMIT 1), 'Voyageur #' || r.account_id)) reporter
    FROM forum_reports r JOIN forum_posts p ON p.id=r.post_id JOIN forum_topics t ON t.id=p.topic_id LEFT JOIN accounts a ON a.id=p.account_id
    WHERE r.resolved_at IS NULL ORDER BY r.created_at`)).rows; });
def(forum, 'put', '/forum/mod/reports/{id}', null, async c => { needStaff(await viewerOf(c));
  if (!(await pool.query('UPDATE forum_reports SET resolved_at=now(), resolved_by=$2 WHERE id=$1', [P(c, 'id'), c.get('acc').sub])).rowCount) fail(404, 'Signalement introuvable');
  return { ok: true }; });
def(forum, 'put', '/forum/mod/accounts/{id}/mute', z.object({ hours: z.number().int().min(0).max(8760) }), async (c, b) => {
  const v = needStaff(await viewerOf(c)), id = P(c, 'id'); if (id === v.id) fail(400, 'Impossible sur votre propre compte');
  const { rows: [a] } = await pool.query('SELECT role FROM accounts WHERE id=$1', [id]); if (!a) fail(404, 'Compte inconnu');
  if (a.role !== 'player') fail(403, 'Un membre de l\'équipe ne se met pas en sourdine');
  const { rows: [r] } = await pool.query(`UPDATE accounts SET forum_muted_until = CASE WHEN $2 > 0 THEN now() + make_interval(hours => $2) END WHERE id=$1 RETURNING forum_muted_until`, [id, b.hours]);
  await audit(c, 'forum.account.mute', 'account', id, null, b); return { ok: true, until: r.forum_muted_until };
});

// ---- Réglages (admin : middleware /admin/*)
const CatBody = z.object({ name: z.string().trim().min(2).max(80), description: z.string().max(400).default(''), kind: z.enum(['announce', 'forum']).default('forum'),
  position: z.number().int().min(0).max(999).default(0), read_access: z.enum(['public', 'members', 'staff']).default('public'), post_access: z.enum(['members', 'staff']).default('members'),
  races: z.array(z.string().max(30)).max(10).default([]), min_rank: z.number().int().min(1).max(10).default(1), locked: z.boolean().default(false), hidden: z.boolean().default(false) });
const CAT_COLS = ['name', 'description', 'kind', 'position', 'read_access', 'post_access', 'races', 'min_rank', 'locked', 'hidden'] as const;
const catVal = (b: any, k: string) => (k === 'races' ? JSON.stringify(b[k]) : b[k]);
def(forum, 'get', '/admin/forum/categories', null, async () => (await pool.query('SELECT * FROM forum_categories ORDER BY position, id')).rows);
def(forum, 'post', '/admin/forum/categories', CatBody, async (c, b) => {
  const { rows: [k] } = await pool.query(`INSERT INTO forum_categories(${CAT_COLS.join(',')}) VALUES (${CAT_COLS.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, CAT_COLS.map(k => catVal(b, k)));
  await audit(c, 'forum.category.create', 'forum_category', k.id, null, b); return k;
});
def(forum, 'put', '/admin/forum/categories/{id}', CatBody.partial(), async (c, b) => {
  const id = P(c, 'id'), before = await catRow(id), cols = CAT_COLS.filter(k => (b as any)[k] !== undefined); if (!cols.length) fail(400, 'Aucun changement');
  const { rows: [k] } = await pool.query(`UPDATE forum_categories SET ${cols.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`, [id, ...cols.map(k => catVal(b, k))]);
  await audit(c, 'forum.category.update', 'forum_category', id, Object.fromEntries(cols.map(k => [k, before[k]])), b); return k;
});
def(forum, 'delete', '/admin/forum/categories/{id}', null, async c => { const id = P(c, 'id'), before = await catRow(id);
  await pool.query('DELETE FROM forum_categories WHERE id=$1', [id]); await audit(c, 'forum.category.delete', 'forum_category', id, { name: before.name }, null); return { ok: true }; });
def(forum, 'put', '/admin/legal/{key}', z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(1).max(60000), bump: z.boolean().default(false) }), async (c, b) => {
  const key = c.req.param('key'); if (!/^[a-z][a-z0-9_-]{1,30}$/.test(key)) fail(400, 'Clé de page invalide');
  const { rows: [p] } = await pool.query(`INSERT INTO legal_pages(key, title, body, position) VALUES ($1,$2,$3,(SELECT COALESCE(max(position),0)+1 FROM legal_pages))
    ON CONFLICT (key) DO UPDATE SET title=EXCLUDED.title, body=EXCLUDED.body, version=legal_pages.version + CASE WHEN $4 THEN 1 ELSE 0 END, updated_at=now() RETURNING key, title, version, updated_at`, [key, b.title, b.body, b.bump]);
  await audit(c, 'legal.update', 'legal_page', undefined, null, { key, bump: b.bump, version: p.version }); return p;
});
def(forum, 'put', '/admin/forum/accounts/{id}/role', z.object({ role: z.enum(['player', 'mod']) }), async (c, b) => {
  const id = P(c, 'id'); if (id === c.get('acc').sub) fail(400, 'Impossible sur votre propre compte');
  const { rows: [a] } = await pool.query('SELECT role FROM accounts WHERE id=$1', [id]); if (!a) fail(404, 'Compte inconnu'); if (a.role === 'admin') fail(403, 'Le rôle d\'un administrateur ne se change pas ici');
  await pool.query('UPDATE accounts SET role=$2 WHERE id=$1', [id, b.role]); await audit(c, 'account.role', 'account', id, { role: a.role }, b); return { ok: true };
});

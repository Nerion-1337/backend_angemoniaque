import { describe, test, expect, beforeAll } from 'vitest';
// Annonces, forum public, pages légales, modération (migration 40) ; connexion Google simulée et redirections (migration 39).
describe.skipIf(!process.env.DATABASE_URL)('Forum public et pages légales', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string, extra: any = {}) => { let r = await call('/auth/register', { email, password: 'password1', ...extra }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' }); return r.j.token; };
  const cat = async (name: string, tk?: string) => (await call('/forum', undefined, tk)).j.categories.find((k: any) => k.name === name);
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.p1 = await login(`fo1${s}@x.fr`); await call('/characters', { pseudo: `fo1${s}`, race: 'human' }, T.p1);
    T.p2 = await login(`fo2${s}@x.fr`, { acceptTos: true }); await call('/characters', { pseudo: `fo2${s}`, race: 'demon' }, T.p2);
    T.pub = (await cat('Place publique')).id; T.ann = (await cat('Annonces')).id;
  });

  test('lecture sans compte : catégories publiques ; réservées signalées ; pages légales', async () => {
    const r = await call('/forum'); expect(r.status).toBe(200); expect(r.j.me.logged).toBe(false);
    expect(r.j.categories.find((k: any) => k.name === 'Annonces')).toMatchObject({ kind: 'announce', denied: null, canPost: false });
    expect(r.j.categories.find((k: any) => k.name === 'Taverne des Hommes').denied).toMatch(/Connectez-vous/);
    expect((await call(`/forum/categories/${T.pub}`)).status).toBe(200);
    const legal = (await call('/legal')).j.map((p: any) => p.key); for (const k of ['cgu', 'privacy', 'legal', 'rules', 'cookies']) expect(legal).toContain(k);
    expect((await call('/legal/cgu')).j).toMatchObject({ title: 'Conditions générales d\'utilisation', version: 1 });
  });
  test('écrire : CGU à accepter ; sujet, réponse, lecture publique ; annonces réservées à l’équipe', async () => {
    expect((await call(`/forum/categories/${T.pub}/topics`, { title: 'Bonjour', body: 'Salut' })).status).toBe(401);
    const no = await call(`/forum/categories/${T.pub}/topics`, { title: 'Bonjour', body: 'Salut' }, T.p1); expect(no.status).toBe(403); expect(no.j.error).toMatch(/conditions générales/);
    expect((await call('/legal/accept', undefined, T.p1, 'POST')).status).toBe(200);
    const t = await call(`/forum/categories/${T.pub}/topics`, { title: `Sujet ${s}`, body: 'Premier message' }, T.p1); expect(t.status, JSON.stringify(t.j)).toBe(200); T.topic = t.j.id;
    expect((await call(`/forum/topics/${T.topic}/posts`, { body: 'Réponse' }, T.p2)).status).toBe(200);   // CGU acceptées à l'inscription
    const v = (await call(`/forum/topics/${T.topic}`)).j; expect(v.posts.map((p: any) => p.body)).toEqual(['Premier message', 'Réponse']);
    expect(v.posts[0].author).toBe(`fo1${s}`); expect(v.posts[0].author_id).toBeNull(); expect(JSON.stringify(v)).not.toContain('@x.fr');   // jamais l'email
    expect((await call(`/forum/categories/${T.ann}/topics`, { title: 'Annonce', body: 'x' }, T.p1)).status).toBe(403);
    expect((await call(`/forum/categories/${T.ann}/topics`, { title: `Maintenance ${s}`, body: 'Ce soir' }, T.adm)).status).toBe(200);
  });
  test('auteur : modifie et supprime ses messages, pas ceux des autres ; sujet avec réponses → équipe', async () => {
    const posts = (await call(`/forum/topics/${T.topic}`, undefined, T.p1)).j.posts, [first, reply] = posts;
    expect((await call(`/forum/posts/${first.id}`, { body: 'Premier message modifié', title: `Sujet ${s} (modifié)` }, T.p1, 'PUT')).status).toBe(200);
    expect((await call(`/forum/posts/${reply.id}`, { body: 'piraté' }, T.p1, 'PUT')).status).toBe(403);
    expect((await call(`/forum/posts/${first.id}`, undefined, T.p1, 'DELETE')).status).toBe(409);
    const v = (await call(`/forum/topics/${T.topic}`)).j; expect(v.topic.title).toBe(`Sujet ${s} (modifié)`); expect(v.posts[0].edited_at).toBeTruthy();
  });
  test('modération : signalement, masquage, verrou, épingle ; sourdine ; joueur refusé', async () => {
    const reply = (await call(`/forum/topics/${T.topic}`)).j.posts[1];
    expect((await call(`/forum/posts/${reply.id}/report`, { reason: 'Propos insultants' }, T.p1)).status).toBe(200);
    expect((await call('/forum/mod/reports', undefined, T.p1)).status).toBe(403);
    const reps = (await call('/forum/mod/reports', undefined, T.adm)).j; expect(reps.find((r: any) => r.post_id === reply.id)).toMatchObject({ reason: 'Propos insultants', reporter: `fo1${s}` });
    expect((await call(`/forum/mod/posts/${reply.id}`, { hidden: true }, T.adm, 'PUT')).status).toBe(200);
    expect((await call(`/forum/topics/${T.topic}`)).j.posts).toHaveLength(1);
    const staffView = (await call(`/forum/topics/${T.topic}`, undefined, T.adm)).j.posts; expect(staffView[1]).toMatchObject({ hidden: true }); expect(staffView[1].author_id).toBeTruthy();
    expect((await call('/forum/mod/reports', undefined, T.adm)).j.find((r: any) => r.post_id === reply.id)).toBeUndefined();   // traité en masquant
    expect((await call(`/forum/mod/topics/${T.topic}`, { locked: true, pinned: true }, T.adm, 'PUT')).j).toMatchObject({ locked: true, pinned: true });
    expect((await call(`/forum/topics/${T.topic}/posts`, { body: 'encore' }, T.p2)).j.error).toMatch(/verrouillé/);
    expect((await call(`/forum/categories/${T.pub}`)).j.topics[0].id).toBe(T.topic);   // épinglé en tête
    await call(`/forum/mod/topics/${T.topic}`, { locked: false }, T.adm, 'PUT');
    const p2 = staffView[1].author_id; expect((await call(`/forum/mod/accounts/${p2}/mute`, { hours: 2 }, T.adm, 'PUT')).status).toBe(200);
    expect((await call(`/forum/topics/${T.topic}/posts`, { body: 'encore' }, T.p2)).j.error).toMatch(/sourdine/);
    await call(`/forum/mod/accounts/${p2}/mute`, { hours: 0 }, T.adm, 'PUT');
    expect((await call(`/forum/topics/${T.topic}/posts`, { body: 'encore' }, T.p2)).status).toBe(200);
    // rôle modérateur donné par l'admin
    expect((await call(`/admin/forum/accounts/${p2}/role`, { role: 'mod' }, T.adm, 'PUT')).status).toBe(200);
    expect((await call('/forum/mod/reports', undefined, T.p2)).status).toBe(200);
    await call(`/admin/forum/accounts/${p2}/role`, { role: 'player' }, T.adm, 'PUT');
  });
  test('admin : accès des catégories (membres, race, rang, masquée) ; nouvelle version des CGU à réaccepter', async () => {
    expect((await call('/forum/categories/' + (await cat('Taverne des Hommes', T.p1)).id, undefined, T.p1)).status).toBe(200);
    const inf = await cat('Cercle infernal', T.p1); expect(inf.denied).toMatch(/races/);
    const k = (await call('/admin/forum/categories', { name: `Privée ${s}`, read_access: 'members', races: ['demon'], min_rank: 1 }, T.adm)).j;
    expect((await call(`/forum/categories/${k.id}`)).status).toBe(403); expect((await call(`/forum/categories/${k.id}`, undefined, T.p1)).status).toBe(403);
    expect((await call(`/forum/categories/${k.id}`, undefined, T.p2)).status).toBe(200);
    await call(`/admin/forum/categories/${k.id}`, { hidden: true }, T.adm, 'PUT');
    expect((await cat(`Privée ${s}`, T.p2))).toBeUndefined(); expect((await cat(`Privée ${s}`, T.adm))).toBeTruthy();
    expect((await call(`/admin/forum/categories/${k.id}`, undefined, T.p1, 'DELETE')).status).toBe(403);
    expect((await call(`/admin/forum/categories/${k.id}`, undefined, T.adm, 'DELETE')).status).toBe(200);
    const before = (await call('/legal/cgu')).j;
    expect((await call('/admin/legal/cgu', { title: before.title, body: before.body, bump: true }, T.adm, 'PUT')).j.version).toBe(before.version + 1);
    expect((await call(`/forum/topics/${T.topic}/posts`, { body: 'x' }, T.p1)).j.error).toMatch(/conditions générales/);
    await call('/legal/accept', undefined, T.p1, 'POST'); expect((await call(`/forum/topics/${T.topic}/posts`, { body: 'x' }, T.p1)).status).toBe(200);
  });
  test('connexion Google simulée : compte créé puis retrouvé ; jamais un compte à mot de passe ni l’admin', async () => {
    expect((await call('/auth/google/config')).j.mode).toBe('mock');
    const em = `goo${s}@gmail.com`, a = await call('/auth/google/mock', { email: em }); expect(a.status, JSON.stringify(a.j)).toBe(200);
    const me = (await call('/auth/me', undefined, a.j.token)).j; expect(me.email).toBe(em);
    expect((await call('/auth/me', undefined, (await call('/auth/google/mock', { email: em })).j.token)).j.id).toBe(me.id);
    expect((await call('/auth/login', { email: em, password: 'password1' })).j.error).toMatch(/Google/);
    expect((await call('/auth/google/mock', { email: `fo1${s}@x.fr` })).status).toBe(409);
    expect((await call('/auth/google/mock', { email: process.env.ADMIN_EMAIL ?? 'admin@ange.local' })).status).toBe(403);
  });
  test('vraie connexion Google (clés présentes) : redirection vers Google avec état en cookie ; retour sans état refusé', async () => {
    Object.assign(process.env, { GOOGLE_CLIENT_ID: 'cid-test', GOOGLE_CLIENT_SECRET: 'sec', PUBLIC_URL: 'https://jeu.exemple.fr/' });
    try {
      const r = await app.request('/auth/google/start'); expect(r.status).toBe(302);
      const loc = new URL(r.headers.get('location')); expect(loc.host).toBe('accounts.google.com');
      expect(loc.searchParams.get('redirect_uri')).toBe('https://jeu.exemple.fr/api/auth/google/callback');
      expect(r.headers.get('set-cookie')).toMatch(new RegExp(`g_state=${loc.searchParams.get('state')}.*HttpOnly`, 'i'));
      const cb = await app.request('/auth/google/callback?code=x&state=faux'); expect(cb.headers.get('location')).toMatch(/^https:\/\/jeu\.exemple\.fr\/#google-error=/);
      expect((await call('/auth/google/mock', { email: `x${s}@gmail.com` })).status).toBe(404);   // simulation coupée quand les clés existent
    } finally { for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'PUBLIC_URL']) delete process.env[k]; }
  });
});

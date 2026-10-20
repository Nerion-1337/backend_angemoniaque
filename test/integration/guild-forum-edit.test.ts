import { describe, test, expect, beforeAll } from 'vitest';
// Droits d'édition forum : catégorie = create_topics ; sujet = auteur, create_topics ou droit
// d'écriture de la catégorie parente (le Chef passe toujours). 403 si non autorisé, 404 si inconnu.
// Nécessite Postgres (schéma du dépôt infra, migrations 02 → 07).
describe.skipIf(!process.env.DATABASE_URL)('guilde : droits d’édition des catégories et sujets', () => {
  let app: any; const u = `gfe${Date.now()}`;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string) => { const r = await app.request(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const mk = async (n: string) => { const e = `${n}${u}@x.fr`, r = await call('/auth/register', { email: e, password: 'password1' }); const c = await call('/characters', { pseudo: `${n}${u}`, race: 'human' }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j)); return { tk: r.j.token, id: c.j.id, pseudo: `${n}${u}` }; };
  const st = async (id: number, tk: string) => (await call(`/guilds/${id}`, undefined, tk)).j;
  let a: any, b: any, c: any, d: any, e: any; let F1: number, F2: number, T1: number, T2: number, T3: number, SECR: number, GARD: number;
  const inviteJoin = async (j: any) => {
    expect((await call('/guilds/invite', { characterId: a.id, pseudo: j.pseudo }, a.tk)).status).toBe(200);
    const invs = await call(`/guilds/invitations/${j.id}`, undefined, j.tk);
    expect((await call(`/guilds/invitations/${invs.j[0].id}/accept`, { characterId: j.id, accept: true }, j.tk)).status).toBe(200);
  };
  beforeAll(async () => {
    [a, b, c, d, e] = [await mk('gfeA'), await mk('gfeB'), await mk('gfeC'), await mk('gfeD'), await mk('gfeE')];
    expect((await call('/guilds', { characterId: a.id, name: `F${u}` }, a.tk)).status).toBe(200);
    await inviteJoin(b); await inviteJoin(c); await inviteJoin(d); await inviteJoin(e);
    const s0 = await st(a.id, a.tk);
    const off = s0.ranks.find((r: any) => r.name === 'Officier');
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: c.id, rankId: off.id }, a.tk)).status).toBe(200); // c → Officier (tous droits)
    // Rang sans permission, payload complet : name + permissions (objet de booleans, schéma du POST /guilds/ranks).
    SECR = (await call('/guilds/ranks', { characterId: a.id, name: 'Secrétariat', permissions: { create_topics: false } }, a.tk)).j.id;
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: d.id, rankId: SECR }, a.tk)).status).toBe(200);
    GARD = (await call('/guilds/ranks', { characterId: a.id, name: 'Gardien', permissions: {} }, a.tk)).j.id;
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: e.id, rankId: GARD }, a.tk)).status).toBe(200);
    F1 = (await call('/guilds/folders', { characterId: a.id, name: 'Atelier', visibleRanks: ['Chef', 'Officier', 'Membre'], writeRanks: ['Officier'] }, a.tk)).j.id;
    T1 = (await call('/guilds/topics', { characterId: c.id, folderId: F1, title: 'Métier', body: 'Premier message' }, c.tk)).j.id;
    expect((await call('/guilds/topics', { characterId: b.id, folderId: F1, title: 'X', body: 'X' }, b.tk)).status).toBe(403); // garde-fou : Membre n'écrit pas ici
    F2 = (await call('/guilds/folders', { characterId: a.id, name: 'Secret', visibleRanks: ['Chef'], writeRanks: ['Secrétariat'] }, a.tk)).j.id;
    T2 = (await call('/guilds/topics', { characterId: d.id, folderId: F2, title: 'Ressource', body: 'Stockage' }, d.tk)).j.id; // auteur = d (Secrétariat)
    T3 = (await call('/guilds/topics', { characterId: a.id, folderId: F2, title: 'Coffre', body: 'Or' }, a.tk)).j.id; // auteur = a
  });
  test('catégorie : réservée aux détenteurs de create_topics', async () => {
    expect((await call(`/guilds/folders/${F1}/edit`, { characterId: b.id, description: 'Atelier rénové' }, b.tk)).status).toBe(200); // Membre = create_topics
    expect((await st(b.id, b.tk)).folders.find((f: any) => f.id === F1).description).toBe('Atelier rénové');
    expect((await call(`/guilds/folders/${F1}/edit`, { characterId: d.id, description: 'Hors de portée' }, d.tk)).status).toBe(403); // Secrétariat : sans create_topics
    expect((await call(`/guilds/folders/${F1}/edit`, { characterId: e.id, name: 'Atelier ?' }, e.tk)).status).toBe(403); // Gardien : sans permission
    expect((await call(`/guilds/folders/${F1}/edit`, { characterId: a.id, description: 'Chef override' }, a.tk)).status).toBe(200); // Chef passe toujours
  });
  test('sujet : l’auteur peut éditer sans autre droit', async () => {
    expect((await call(`/guilds/topics/${T2}/edit`, { characterId: d.id, title: 'Ressource v2', description: 'Stockage sécurisé' }, d.tk)).status).toBe(200);
    const s = await st(a.id, a.tk); const t = s.folders.find((f: any) => f.id === F2).topics.find((x: any) => x.id === T2);
    expect(t.title).toBe('Ressource v2'); expect(t.description).toBe('Stockage sécurisé'); expect(t.author_id).toBe(d.id);
  });
  test('sujet : create_topics ouvre l’édition (même sujet d’un autre)', async () => {
    expect((await call(`/guilds/topics/${T1}/edit`, { characterId: b.id, title: 'Métier (b)' }, b.tk)).status).toBe(200); // Membre : create_topics
    expect((await call(`/guilds/topics/${T1}/edit`, { characterId: c.id, title: 'Métier (c)' }, c.tk)).status).toBe(200); // Officier : tous droits
    expect((await st(a.id, a.tk)).folders.find((f: any) => f.id === F1).topics.find((x: any) => x.id === T1).title).toBe('Métier (c)');
  });
  test('sujet : le seul droit d’écriture de la catégorie parente ouvre l’édition', async () => {
    // d (Secrétariat) : sans create_topics, non auteur de T3, mais Secrétariat ∈ write_ranks(F2) → édition ouverte.
    expect((await st(a.id, a.tk)).folders.find((f: any) => f.id === F1).topics.find((x: any) => x.id === T1).write_ranks).toBeNull(); // héritage
    expect((await call(`/guilds/topics/${T3}/edit`, { characterId: d.id, title: 'Coffre double' }, d.tk)).status).toBe(200);
    expect((await st(a.id, a.tk)).folders.find((f: any) => f.id === F2).topics.find((x: any) => x.id === T3).title).toBe('Coffre double');
    expect((await call(`/guilds/topics/${T1}/edit`, { characterId: a.id, title: 'Métier (chef)' }, a.tk)).status).toBe(200);
  });
  test('sujet : sans aucun des trois droits → 403, inconnu → 404', async () => {
    expect((await call(`/guilds/topics/${T2}/edit`, { characterId: e.id, title: 'Vol' }, e.tk)).status).toBe(403); // e : ni auteur, ni create_topics, ni écriture de F2
    expect((await call(`/guilds/topics/${T1}/edit`, { characterId: e.id, description: 'Vol' }, e.tk)).status).toBe(403);
    expect((await call('/guilds/topics/999999/edit', { characterId: e.id, title: 'X' }, e.tk)).status).toBe(404);
    const s = await st(a.id, a.tk); expect(s.folders.find((f: any) => f.id === F2).topics.find((x: any) => x.id === T2).title).toBe('Ressource v2'); // rien n'a été volé
  });
  test('le payload de liste expose author_id sur chaque sujet', async () => {
    const s = await st(a.id, a.tk);
    expect(s.folders.find((f: any) => f.id === F1).topics.find((x: any) => x.id === T1).author_id).toBe(c.id);
    expect(s.folders.find((f: any) => f.id === F2).topics.find((x: any) => x.id === T3).author_id).toBe(a.id);
  });
});

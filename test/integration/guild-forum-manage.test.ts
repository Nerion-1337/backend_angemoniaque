import { describe, test, expect, beforeAll } from 'vitest';
// Gestion du forum : suppression en cascade (catégorie → sujets → messages → lectures ;
// sujet → messages → lectures) réservée au Chef, et transfert de sujet entre catégories
// (détenteurs de create_topics, le sujet va en fin de liste cible). Nécessite Postgres
// (schéma du dépôt infra, migrations 02 → 07).
describe.skipIf(!process.env.DATABASE_URL)('guilde : suppression et transfert du forum', () => {
  let app: any; const u = `gfm${Date.now()}`;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string) => { const r = await app.request(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const mk = async (n: string) => { const e = `${n}${u}@x.fr`, r = await call('/auth/register', { email: e, password: 'password1' }); const c = await call('/characters', { pseudo: `${n}${u}`, race: 'human' }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j)); return { tk: r.j.token, id: c.j.id, pseudo: `${n}${u}` }; };
  const st = async (id: number, tk: string) => (await call(`/guilds/${id}`, undefined, tk)).j;
  let a: any, b: any, c: any, d: any, e: any; let F1: number, F2: number, F3: number, T1: number, T2: number, T3: number, T4: number, SECR: number, GARD: number;
  const inviteJoin = async (j: any) => {
    expect((await call('/guilds/invite', { characterId: a.id, pseudo: j.pseudo }, a.tk)).status).toBe(200);
    const invs = await call(`/guilds/invitations/${j.id}`, undefined, j.tk);
    expect((await call(`/guilds/invitations/${invs.j[0].id}/accept`, { characterId: j.id, accept: true }, j.tk)).status).toBe(200);
  };
  beforeAll(async () => {
    [a, b, c, d, e] = [await mk('gfmA'), await mk('gfmB'), await mk('gfmC'), await mk('gfmD'), await mk('gfmE')];
    expect((await call('/guilds', { characterId: a.id, name: `M${u}` }, a.tk)).status).toBe(200);
    await inviteJoin(b); await inviteJoin(c); await inviteJoin(d); await inviteJoin(e);
    const s0 = await st(a.id, a.tk);
    const off = s0.ranks.find((r: any) => r.name === 'Officier');
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: c.id, rankId: off.id }, a.tk)).status).toBe(200); // c → Officier (tous droits, pas Chef)
    SECR = (await call('/guilds/ranks', { characterId: a.id, name: 'Secrétariat', permissions: { create_topics: false } }, a.tk)).j.id;
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: d.id, rankId: SECR }, a.tk)).status).toBe(200);
    GARD = (await call('/guilds/ranks', { characterId: a.id, name: 'Gardien', permissions: {} }, a.tk)).j.id;
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: e.id, rankId: GARD }, a.tk)).status).toBe(200);
    F1 = (await call('/guilds/folders', { characterId: a.id, name: 'Atelier', visibleRanks: ['Chef', 'Officier', 'Membre'], writeRanks: ['Officier', 'Membre'] }, a.tk)).j.id;
    F2 = (await call('/guilds/folders', { characterId: a.id, name: 'Secret', visibleRanks: ['Chef'], writeRanks: ['Secrétariat'] }, a.tk)).j.id;
    F3 = (await call('/guilds/folders', { characterId: a.id, name: 'Caveau', visibleRanks: ['Chef', 'Officier', 'Membre'], writeRanks: ['Membre'] }, a.tk)).j.id;
    T1 = (await call('/guilds/topics', { characterId: c.id, folderId: F1, title: 'Métier', body: 'Premier message' }, c.tk)).j.id;
    expect((await call('/guilds/posts', { characterId: c.id, topicId: T1, body: 'Deuxième message' }, c.tk)).status).toBe(200);
    T2 = (await call('/guilds/topics', { characterId: d.id, folderId: F2, title: 'Ressource', body: 'Stockage' }, d.tk)).j.id;
    T3 = (await call('/guilds/topics', { characterId: a.id, folderId: F2, title: 'Coffre', body: 'Or' }, a.tk)).j.id;
    T4 = (await call('/guilds/topics', { characterId: b.id, folderId: F3, title: 'Échos', body: 'Murailles' }, b.tk)).j.id;
    expect((await call(`/guilds/topics/${b.id}/${T1}`, undefined, b.tk)).status).toBe(200); // b acquitte T1 (état de lecture créé)
  });
  test('suppression de catégorie : réservée au Chef, cascade complète', async () => {
    expect((await call(`/guilds/folders/${F1}/delete`, { characterId: c.id }, c.tk)).j.error).toMatch(/Chef/); // Officier (tous droits, non-Chef) refusé
    expect((await call(`/guilds/folders/${F1}/delete`, { characterId: c.id }, c.tk)).status).toBe(403);
    expect((await call(`/guilds/folders/${F1}/delete`, { characterId: b.id }, b.tk)).status).toBe(403);
    expect((await call(`/guilds/folders/${F1}/delete`, { characterId: d.id }, d.tk)).status).toBe(403);
    expect((await call(`/guilds/folders/${F1}/delete`, { characterId: e.id }, e.tk)).status).toBe(403);
    expect((await call(`/guilds/folders/${F1}/delete`, { characterId: a.id }, a.tk)).status).toBe(200);
    const s1 = await st(a.id, a.tk);
    expect(s1.folders.map((f: any) => f.id)).not.toContain(F1); // la catégorie est partie
    expect((s1.folders.find((f: any) => f.id === F2)?.topics ?? []).map((t: any) => t.id)).toEqual([T2, T3]); // les autres catégories intactes
    // Cascade : le sujet T1 de la catégorie supprimée n'est plus accessible (404 côté back)
    expect((await call(`/guilds/topics/${b.id}/${T1}`, undefined, b.tk)).status).toBe(404);
    expect((await call(`/guilds/topics/${T1}/edit`, { characterId: a.id, title: 'Résurrection' }, a.tk)).status).toBe(404);
  });
  test('suppression de sujet : réservée au Chef, messages et lectures emportés', async () => {
    expect((await call(`/guilds/topics/${T2}/delete`, { characterId: c.id }, c.tk)).status).toBe(403);
    expect((await call(`/guilds/topics/${T2}/delete`, { characterId: b.id }, b.tk)).status).toBe(403);
    expect((await call(`/guilds/topics/${T2}/delete`, { characterId: a.id }, a.tk)).status).toBe(200);
    const s1 = await st(a.id, a.tk);
    expect(s1.folders.find((f: any) => f.id === F2)?.topics.map((t: any) => t.id)).toEqual([T3]); // T2 parti, T3 intact
    expect((await call(`/guilds/topics/${d.id}/${T2}`, undefined, d.tk)).status).toBe(404); // plus de messages à ouvrir
  });
  test('transfert de sujet : create_topics, fin de liste de la cible, messages conservés', async () => {
    expect((await call(`/guilds/topics/${T3}/move`, { characterId: d.id, folderId: F3 }, d.tk)).status).toBe(403); // Secrétariat : sans create_topics
    expect((await call(`/guilds/topics/${T3}/move`, { characterId: e.id, folderId: F3 }, e.tk)).status).toBe(403); // Gardien : idem
    expect((await call(`/guilds/topics/${T3}/move`, { characterId: b.id, folderId: F3 }, b.tk)).status).toBe(200); // Membre : create_topics
    const s1 = await st(a.id, a.tk);
    expect(s1.folders.find((f: any) => f.id === F2)?.topics.map((t: any) => t.id)).toEqual([]); // F2 vidée
    expect(s1.folders.find((f: any) => f.id === F3)?.topics.map((t: any) => t.id)).toEqual([T4, T3]); // T3 rangée APRÈS T4 (fin de liste)
    // Le message d'origine du sujet a voyagé avec lui
    expect((await call(`/guilds/topics/${b.id}/${T3}`, undefined, b.tk)).j[0]?.body).toBe('Or');
  });
  test('transfert : cible absente ou déjà à sa place', async () => {
    expect((await call(`/guilds/topics/${T3}/move`, { characterId: a.id, folderId: 99999999 }, a.tk)).status).toBe(404); // catégorie cible inconnue
    expect((await call(`/guilds/topics/${99999998}/move`, { characterId: a.id, folderId: F3 }, a.tk)).status).toBe(404); // sujet inconnu
    expect((await call(`/guilds/topics/${T3}/move`, { characterId: b.id, folderId: F3 }, b.tk)).status).toBe(200); // déjà dans F3 : no-op accepté
  });
  test('suppression : inconnus / hors guilde', async () => {
    expect((await call(`/guilds/folders/${99999999}/delete`, { characterId: a.id }, a.tk)).status).toBe(404);
    expect((await call(`/guilds/topics/${99999998}/delete`, { characterId: a.id }, a.tk)).status).toBe(404);
  });
});

import { describe, test, expect, beforeAll } from 'vitest';
// Forum de guilde : ordre d'affichage des catégories et sujets — réorganisation par liste
// complète (`POST /guilds/reorder`), droit `create_topics`, ordre restitué par GET.
// Nécessite Postgres (schéma du dépôt infra).
describe.skipIf(!process.env.DATABASE_URL)('guilde : forum — ordre et réorganisation', () => {
  let app: any; const u = `gf${Date.now()}`;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string) => { const r = await app.request(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const mk = async (n: string) => { const e = `${n}${u}@x.fr`, r = await call('/auth/register', { email: e, password: 'password1' }); const c = await call('/characters', { pseudo: `${n}${u}`, race: 'human' }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j)); return { tk: r.j.token, id: c.j.id, pseudo: `${n}${u}` }; };
  const st = async (id: number, tk: string) => (await call(`/guilds/${id}`, undefined, tk)).j;
  const names = (s: any, k: string) => s.folders.map((f: any) => f[k]);
  let a: any, b: any; const F: any[] = [], T: any[] = [];
  beforeAll(async () => {
    [a, b] = [await mk('gfa'), await mk('gfb')];
    expect((await call('/guilds', { characterId: a.id, name: `F${u}` }, a.tk)).status).toBe(200);
    expect((await call('/guilds/apply', { characterId: b.id, name: `F${u}` }, b.tk)).status).toBe(200);
    let s = await st(a.id, a.tk);
    expect((await call(`/guilds/applicants/${s.applicants[0].id}/answer`, { characterId: a.id, accept: true }, a.tk)).status).toBe(200);
    for (const n of ['Conseil', 'Brigade', 'Veille']) F.push((await call('/guilds/folders', { characterId: a.id, name: n }, a.tk)).j);
    s = await st(a.id, a.tk);
    for (const t of ['Premier ordre du jour', 'Second']) T.push((await call('/guilds/topics', { characterId: a.id, folderId: s.folders[0].id, title: t, body: t }, a.tk)).j);
  });
  test('les catégories et sujets suivent l’ordre demandé ; un créateur autorisé peut réorganiser', async () => {
    let s = await st(a.id, a.tk);
    expect(names(s, 'name')).toEqual(['Conseil', 'Brigade', 'Veille']);
    expect(s.folders[0].topics.map((t: any) => t.title)).toEqual(['Premier ordre du jour', 'Second']);
    expect((await call('/guilds/reorder', { characterId: a.id, kind: 'folders', ids: [F[2].id, F[0].id, F[1].id] }, a.tk)).status).toBe(200);
    expect((await call('/guilds/reorder', { characterId: a.id, kind: 'topics', folderId: F[0].id, ids: [T[1].id, T[0].id] }, a.tk)).status).toBe(200);
    s = await st(a.id, a.tk);
    expect(names(s, 'name')).toEqual(['Veille', 'Conseil', 'Brigade']);
    expect(s.folders.find((f: any) => f.name === 'Conseil').topics.map((t: any) => t.title)).toEqual(['Second', 'Premier ordre du jour']);
    // b est « Membre » (détient create_topics) : le droit ne se limite pas au Chef
    expect((await call('/guilds/reorder', { characterId: b.id, kind: 'folders', ids: [F[0].id, F[1].id, F[2].id] }, b.tk)).status).toBe(200);
  });
  test('la réorganisation exige le droit create_topics ; les ids étrangers n’ont aucun effet', async () => {
    const rk = (await call('/guilds/ranks', { characterId: a.id, name: 'Ritourne' }, a.tk)).j; // aucun privilège
    const s0 = await st(a.id, a.tk);
    const bid = s0.members.find((m: any) => m.pseudo === b.pseudo).id;
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: bid, rankId: rk.id }, a.tk)).status).toBe(200);
    expect((await call('/guilds/reorder', { characterId: b.id, kind: 'folders', ids: [F[0].id, F[1].id, F[2].id] }, b.tk)).status).toBe(403);
    const s1 = await st(a.id, a.tk); const f0 = s1.folders.find((f: any) => f.name === 'Conseil');
    expect((await call('/guilds/reorder', { characterId: a.id, kind: 'topics', folderId: 999999, ids: [T[0].id] }, a.tk)).status).toBe(404); // catégorie inconnue
    expect((await call('/guilds/reorder', { characterId: a.id, kind: 'topics', folderId: f0.id, ids: [T[0].id, T[1].id, 424242] }, a.tk)).status).toBe(200);
    const s2 = await st(a.id, a.tk);
    expect(s2.folders.find((f: any) => f.name === 'Conseil').topics.map((t: any) => t.title)).toEqual(['Premier ordre du jour', 'Second']);
  });
});

import { describe, test, expect, beforeAll } from 'vitest';
// Parcours complet des rangs de guilde : le dernier Chef ne peut ni quitter ni changer de rang
// (un second Chef le libère), et le renommage d'un rang (Chef protégé, nom unique) porte la
// visibilité du forum. Nécessite Postgres (schéma du dépôt infra).
describe.skipIf(!process.env.DATABASE_URL)('guilde : dernier Chef & renommage des rangs', () => {
  let app: any; const u = `gr${Date.now()}`;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string) => { const r = await app.request(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const mk = async (n: string) => { const e = `${n}${u}@x.fr`, r = await call('/auth/register', { email: e, password: 'password1' }); const c = await call('/characters', { pseudo: `${n}${u}`, race: 'human' }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j)); return { tk: r.j.token, id: c.j.id, pseudo: `${n}${u}` }; };
  const state = async (id: number, tk: string) => (await call(`/guilds/${id}`, undefined, tk)).j;
  const rankId = (st: any, name: string) => st.ranks.find((r: any) => r.name === name).id;
  let a: any, b: any, c: any;
  beforeAll(async () => {
    [a, b, c] = [await mk('ga'), await mk('gb'), await mk('gc')];
    expect((await call('/guilds', { characterId: a.id, name: `G${u}` }, a.tk)).status).toBe(200);
    expect((await call('/guilds/apply', { characterId: b.id, name: `G${u}` }, b.tk)).status).toBe(200);
    const st = await state(a.id, a.tk);
    expect((await call(`/guilds/applicants/${st.applicants[0].id}/answer`, { characterId: a.id, accept: true }, a.tk)).status).toBe(200);
  });
  test('le dernier Chef ne peut pas quitter (même seul dans la guilde)', async () => {
    const r = await call('/guilds/leave', { characterId: a.id }, a.tk);
    expect(r.status).toBe(409); expect(r.j.error).toContain('Chef');
    const st = await state(a.id, a.tk); expect(st.members.map((m: any) => m.rank)).toContain('Chef');
  });
  test('le dernier Chef ne peut pas changer de rang (se démettre)', async () => {
    const st = await state(a.id, a.tk);
    const r = await call('/guilds/members/rank', { characterId: a.id, memberId: a.id, rankId: rankId(st, 'Membre') }, a.tk);
    expect(r.status).toBe(409); expect(r.j.error).toContain('Chef');
  });
  test('un second Chef libère le premier : nomination puis sortie', async () => {
    const st = await state(a.id, a.tk);
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: b.id, rankId: rankId(st, 'Officier') }, a.tk)).status).toBe(200); // non-Chef : autorisé
    const s2 = await state(a.id, a.tk);
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: b.id, rankId: rankId(s2, 'Chef') }, a.tk)).status).toBe(200);
    expect((await call('/guilds/leave', { characterId: a.id }, a.tk)).status).toBe(200);
    expect((await call(`/guilds/${a.id}`, undefined, a.tk)).status).toBe(403); // plus dans de guilde
  });
  test('le second Chef devient lui-même le dernier Chef et reste bloqué', async () => {
    const inv = await call('/guilds/invite', { characterId: b.id, pseudo: c.pseudo }, b.tk); expect(inv.status).toBe(200);
    const lst = await call(`/guilds/invitations/${c.id}`, undefined, c.tk); const iid = lst.j[0].id;
    expect((await call(`/guilds/invitations/${iid}/accept`, { characterId: c.id, accept: true }, c.tk)).status).toBe(200);
    let st = await state(b.id, b.tk);
    expect((await call('/guilds/members/rank', { characterId: b.id, memberId: b.id, rankId: rankId(st, 'Membre') }, b.tk)).status).toBe(409);
    st = await state(b.id, b.tk);
    expect((await call('/guilds/members/rank', { characterId: b.id, memberId: c.id, rankId: rankId(st, 'Chef') }, b.tk)).status).toBe(200);
    expect((await call('/guilds/leave', { characterId: b.id }, b.tk)).status).toBe(200);
    expect((await call('/guilds/leave', { characterId: c.id }, c.tk)).status).toBe(409); // c est le dernier Chef
  });
  test('renommage : le Chef est protégé, le nom est unique, la visibilité du forum suit', async () => {
    expect((await call('/guilds/folders', { characterId: c.id, name: 'Conseil', visibleRanks: ['Officier'] }, c.tk)).status).toBe(200);
    let st = await state(c.id, c.tk); const fid = st.folders.find((f: any) => f.name === 'Conseil').id;
    expect((await call('/guilds/topics', { characterId: c.id, folderId: fid, title: 'Ordre du jour', body: 'Premier point', visibleRanks: ['Officier'] }, c.tk)).status).toBe(200);
    expect((await call(`/guilds/ranks/${rankId(st, 'Chef')}/rename`, { characterId: c.id, name: 'Grand Chef' }, c.tk)).status).toBe(403); // rang Chef protégé
    expect((await call(`/guilds/ranks/${rankId(st, 'Officier')}/rename`, { characterId: c.id, name: 'Officier' }, c.tk)).status).toBe(200); // nom inchangé : non-op
    const r = await call(`/guilds/ranks/${rankId(st, 'Officier')}/rename`, { characterId: c.id, name: 'Sergent' }, c.tk);
    expect(r.status).toBe(200);
    st = await state(c.id, c.tk);
    expect(st.ranks.map((x: any) => x.name)).toContain('Sergent'); expect(st.ranks.map((x: any) => x.name)).not.toContain('Officier');
    const f = st.folders.find((x: any) => x.name === 'Conseil');
    expect(f.visible_ranks).toEqual(['Sergent']); expect(f.topics[0].visible_ranks).toEqual(['Sergent']);
  });
  test('renommage : non-Chef refusé, doublon refusé, le porteur est suivi', async () => {
    const inv = await call('/guilds/invite', { characterId: c.id, pseudo: a.pseudo }, c.tk); expect(inv.status).toBe(200);
    const lst = await call(`/guilds/invitations/${a.id}`, undefined, a.tk); const iid = lst.j[0].id;
    expect((await call(`/guilds/invitations/${iid}/accept`, { characterId: a.id, accept: true }, a.tk)).status).toBe(200);
    let st = await state(c.id, c.tk);
    expect((await call(`/guilds/ranks/${rankId(st, 'Membre')}/rename`, { characterId: a.id, name: 'Gardien' }, a.tk)).status).toBe(403); // réservé au Chef
    expect((await call(`/guilds/ranks/${rankId(st, 'Membre')}/rename`, { characterId: c.id, name: 'Sergent' }, c.tk)).status).toBe(409); // doublon
    expect((await call(`/guilds/ranks/${rankId(st, 'Membre')}/rename`, { characterId: c.id, name: 'Recrue' }, c.tk)).status).toBe(200);
    const sa = await state(a.id, a.tk); expect(sa.me.rank).toBe('Recrue'); // le porteur est renommé avec le rang
  });
});

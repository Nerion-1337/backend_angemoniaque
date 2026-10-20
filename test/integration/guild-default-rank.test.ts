import { describe, test, expect, beforeAll } from 'vitest';
// Rang par défaut de guilde (option unique `default_rank_id`) : définit le rang attribué aux
// nouveaux arrivants (candidats acceptés, invitations). NULL = automatique (rang non-Chef le plus bas).
// Nécessite Postgres (schéma du dépôt infra).
describe.skipIf(!process.env.DATABASE_URL)('guilde : rang par défaut des nouveaux arrivants', () => {
  let app: any; const u = `gdr${Date.now()}`;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string) => { const r = await app.request(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const mk = async (n: string) => { const e = `${n}${u}@x.fr`, r = await call('/auth/register', { email: e, password: 'password1' }); const c = await call('/characters', { pseudo: `${n}${u}`, race: 'human' }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j)); return { tk: r.j.token, id: c.j.id, pseudo: `${n}${u}` }; };
  const st = async (id: number, tk: string) => (await call(`/guilds/${id}`, undefined, tk)).j;
  let a: any, b: any;
  const inviteJoin = async (j: any) => {
    expect((await call('/guilds/invite', { characterId: a.id, pseudo: j.pseudo }, a.tk)).status).toBe(200);
    const invs = await call(`/guilds/invitations/${j.id}`, undefined, j.tk);
    const id = invs.j[0].id;
    expect((await call(`/guilds/invitations/${id}/accept`, { characterId: j.id, accept: true }, j.tk)).status).toBe(200);
    return st(j.id, j.tk).then((s: any) => s); };
  beforeAll(async () => {
    [a, b] = [await mk('gdra'), await mk('gdrb')];
    expect((await call('/guilds', { characterId: a.id, name: `G${u}` }, a.tk)).status).toBe(200);
    await inviteJoin(b); // b rejoint comme Membre
  });
  test('par défaut (aucune option) : le nouvel arrivant reçoit le rang le plus bas', async () => {
    const c = await mk('gdrd'); const s = await inviteJoin(c);
    expect(s.me.rank).toBe('Membre');
    expect(s.guild.default_rank_id).toBeNull(); // GET expose l'option (ici : automatique)
  });
  test("l'option est réservée au Chef (un Membre est refusé)", async () => {
    const s = await st(a.id, a.tk); const mem = s.ranks.find((r: any) => r.name === 'Membre');
    expect((await call('/guilds/default-rank', { characterId: b.id, rankId: mem.id }, b.tk)).status).toBe(403);
  });
  test("le Chef fixe l'option : le prochain arrivant reçoit ce rang", async () => {
    const s = await st(a.id, a.tk); const off = s.ranks.find((r: any) => r.name === 'Officier');
    expect((await call('/guilds/default-rank', { characterId: a.id, rankId: off.id }, a.tk)).status).toBe(200);
    expect((await st(a.id, a.tk)).guild.default_rank_id).toBe(off.id); // GET reflète l'option
    const d = await mk('gdre'); const sd = await inviteJoin(d);
    expect(sd.me.rank).toBe('Officier'); // parcours complet : invitation acceptée → rang par défaut
  });
  test('le rang Chef ne peut pas être le par défaut (400), rang étranger introuvable (404)', async () => {
    const s = await st(a.id, a.tk); const chef = s.ranks.find((r: any) => r.is_leader);
    expect((await call('/guilds/default-rank', { characterId: a.id, rankId: chef.id }, a.tk)).status).toBe(400);
    expect((await call('/guilds/default-rank', { characterId: a.id, rankId: 424242 }, a.tk)).status).toBe(404);
  });
  test("retour à l'automatique (rankId null) : le plus bas revient", async () => {
    expect((await call('/guilds/default-rank', { characterId: a.id, rankId: null }, a.tk)).status).toBe(200);
    expect((await st(a.id, a.tk)).guild.default_rank_id).toBeNull();
    const e = await mk('gdrf'); const se = await inviteJoin(e);
    expect(se.me.rank).toBe('Membre');
  });
});

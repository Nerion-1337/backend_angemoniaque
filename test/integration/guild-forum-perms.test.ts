import { describe, test, expect, beforeAll } from 'vitest';
// Forum v2 : permissions granulaires Voir (visible_ranks) / Écrire (write_ranks) par rang,
// héritage sujet←catégorie, 403 à l'écriture, non-lus (sujet + cumul catégorie), édition titre/description.
// Nécessite Postgres (schéma du dépôt infra, migration 07).
describe.skipIf(!process.env.DATABASE_URL)('guilde : forum v2 (permissions par rang + non-lus)', () => {
  let app: any; const u = `gfp${Date.now()}`;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string) => { const r = await app.request(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const mk = async (n: string) => { const e = `${n}${u}@x.fr`, r = await call('/auth/register', { email: e, password: 'password1' }); const c = await call('/characters', { pseudo: `${n}${u}`, race: 'human' }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j)); return { tk: r.j.token, id: c.j.id, pseudo: `${n}${u}` }; };
  const st = async (id: number, tk: string) => (await call(`/guilds/${id}`, undefined, tk)).j;
  let a: any, b: any, c: any, d: any; let F1: number, T1: number;
  const inviteJoin = async (j: any) => {
    expect((await call('/guilds/invite', { characterId: a.id, pseudo: j.pseudo }, a.tk)).status).toBe(200);
    const invs = await call(`/guilds/invitations/${j.id}`, undefined, j.tk);
    expect((await call(`/guilds/invitations/${invs.j[0].id}/accept`, { characterId: j.id, accept: true }, j.tk)).status).toBe(200);
  };
  beforeAll(async () => {
    [a, b, c, d] = [await mk('gfpa'), await mk('gfpb'), await mk('gfpd'), await mk('gfpe')];
    expect((await call('/guilds', { characterId: a.id, name: `F${u}` }, a.tk)).status).toBe(200);
    await inviteJoin(b); await inviteJoin(c); await inviteJoin(d); // Membre
    const s = await st(a.id, a.tk); const off = s.ranks.find((r: any) => r.name === 'Officier');
    expect((await call('/guilds/members/rank', { characterId: a.id, memberId: c.id, rankId: off.id }, a.tk)).status).toBe(200); // c → Officier
    const f = await call('/guilds/folders', { characterId: a.id, name: 'Conseil', visibleRanks: ['Chef', 'Officier', 'Membre'], writeRanks: ['Officier'] }, a.tk);
    F1 = f.j.id;
    T1 = (await call('/guilds/topics', { characterId: c.id, folderId: F1, title: 'Débat', body: 'Premier message' }, c.tk)).j.id;
  });
  test("créer un sujet exige le droit d'écriture de la catégorie (403 sinon)", async () => {
    expect((await call('/guilds/topics', { characterId: b.id, folderId: F1, title: 'X', body: 'X' }, b.tk)).status).toBe(403); // b = Membre, write ['Officier']
    expect((await call('/guilds/topics', { characterId: c.id, folderId: F1, title: 'Deux', body: 'Corps' }, c.tk)).status).toBe(200); // c = Officier
  });
  test('un sujet sans choix de rangs hérite de la lecture de sa catégorie', async () => {
    const T2 = (await call('/guilds/topics', { characterId: c.id, folderId: F1, title: 'Hérité', body: 'Corps' }, c.tk)).j.id;
    expect((await st(b.id, b.tk)).folders.find((f: any) => f.id === F1).topics.map((t: any) => t.id)).toContain(T2); // lecture héritée [Chef,Officier,Membre]
    const F2 = (await call('/guilds/folders', { characterId: a.id, name: 'Secret', visibleRanks: ['Chef', 'Officier'], writeRanks: ['Officier'] }, a.tk)).j.id;
    const T3 = (await call('/guilds/topics', { characterId: c.id, folderId: F2, title: 'Caché', body: 'Corps' }, c.tk)).j.id;
    expect((await st(b.id, b.tk)).folders.map((f: any) => f.id)).not.toContain(F2); // b ne voit pas la catégorie
    const sc = await st(c.id, c.tk);
    expect(sc.folders.find((f: any) => f.id === F2).topics.map((t: any) => t.id)).toContain(T3); // Officier voit
    expect(sc.folders.find((f: any) => f.id === F2).topics.find((t: any) => t.id === T3).visible_ranks).toEqual([]); // vide = héritage
  });
  test("surcharge locale d'un sujet : écrire est une restriction de voir", async () => {
    expect((await call(`/guilds/topics/${T1}/perms`, { characterId: a.id, readRanks: null, writeRanks: ['Membre'] }, a.tk)).status).toBe(200); // write ⊂ lecture héritée
    expect((await call(`/guilds/topics/${T1}/perms`, { characterId: a.id, readRanks: ['Membre'], writeRanks: ['Officier'] }, a.tk)).status).toBe(400); // écrire ⊄ voir
    expect((await call(`/guilds/topics/${T1}/perms`, { characterId: b.id, readRanks: null, writeRanks: null }, b.tk)).status).toBe(403); // réservé au Chef
    expect((await call('/guilds/posts', { characterId: c.id, topicId: T1, body: 'Réplique' }, c.tk)).status).toBe(403); // plus le droit d'écrire
    expect((await call('/guilds/posts', { characterId: b.id, topicId: T1, body: 'Oui, moi je peux' }, b.tk)).status).toBe(200);
  });
  test("non-lus : badge sujet + cumul catégorie, acquittement automatique à l'ouverture", async () => {
    let sd = await st(d.id, d.tk);
    // T1 = 2 posts (c puis b) ; les deux autres sujets de F1 ('Deux', 'Hérité') ont chacun 1 post par c.
    expect(sd.unread.topics[T1]).toBe(2);
    expect(sd.unread.folders[F1]).toBe(4); // cumul des 3 sujets de F1 : 2 + 1 + 1
    expect((await call(`/guilds/topics/${d.id}/${T1}`, undefined, d.tk)).status).toBe(200); // ouverture → acquittement
    sd = await st(d.id, d.tk);
    expect(sd.unread.topics[T1] ?? 0).toBe(0); expect(sd.unread.folders[F1]).toBe(2); // T1 acquitté (clé absente), 2 sujets restent non lus
    expect((await call('/guilds/posts', { characterId: b.id, topicId: T1, body: 'Un mot de plus' }, b.tk)).status).toBe(200);
    sd = await st(d.id, d.tk);
    expect(sd.unread.topics[T1]).toBe(1); expect(sd.unread.folders[F1]).toBe(3); // cumul catégorie = somme des sujets
  });
  test("édition titre/description (sans rechargement, via API) et catégories/sujets en fin de liste", async () => {
    expect((await call(`/guilds/folders/${F1}/edit`, { characterId: a.id, description: 'Réunion hebdomadaire' }, a.tk)).status).toBe(200);
    expect((await call(`/guilds/topics/${T1}/edit`, { characterId: a.id, title: 'Débat v2', description: 'Tout ce qui concerne le débat' }, a.tk)).status).toBe(200);
    let s = await st(a.id, a.tk);
    expect(s.folders.find((f: any) => f.id === F1).description).toBe('Réunion hebdomadaire');
    const t1 = s.folders.find((f: any) => f.id === F1).topics.find((x: any) => x.id === T1);
    expect(t1.title).toBe('Débat v2'); expect(t1.description).toBe('Tout ce qui concerne le débat');
    const F3 = (await call('/guilds/folders', { characterId: a.id, name: 'Dernière' }, a.tk)).j.id;
    s = await st(a.id, a.tk);
    expect(s.folders.map((f: any) => f.id)).toEqual(expect.arrayContaining([F3]));
    expect(s.folders[s.folders.length - 1].id).toBe(F3); // création en fin de liste (sort_order = max+1)
  });
  test("renommage d'un rang : les droits d'écriture suivent le nom (cascade)", async () => {
    const s = await st(a.id, a.tk); const ser = s.ranks.find((r: any) => r.name === 'Officier');
    expect((await call(`/guilds/ranks/${ser.id}/rename`, { characterId: a.id, name: 'Sergent' }, a.tk)).status).toBe(200);
    const s2 = await st(a.id, a.tk);
    expect(s2.folders.find((f: any) => f.id === F1).write_ranks).toEqual(['Sergent']);
    expect(s2.folders.find((f: any) => f.id === F1).visible_ranks).toEqual(['Chef', 'Sergent', 'Membre']);
    // le sujet T1 (write_ranks ['Membre'] explicite) n'est pas touché par le renommage Officier→Sergent
    expect(s2.folders.find((f: any) => f.id === F1).topics.find((x: any) => x.id === T1).write_ranks).toEqual(['Membre']);
  });
});

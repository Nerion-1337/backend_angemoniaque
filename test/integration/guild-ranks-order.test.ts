import { describe, test, expect, beforeAll } from 'vitest';
// Rangs de guilde : ordre persisté (sort_order) et refonte Gestion — réorganisation réservée au Chef,
// création en fin de liste, label Chef renommable et visibilités par défaut qui le suivent.
// Nécessite Postgres (schéma du dépôt infra).
describe.skipIf(!process.env.DATABASE_URL)('guilde : ordre des rangs', () => {
  let app: any; const u = `gro${Date.now()}`;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string) => { const r = await app.request(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const mk = async (n: string) => { const e = `${n}${u}@x.fr`, r = await call('/auth/register', { email: e, password: 'password1' }); const c = await call('/characters', { pseudo: `${n}${u}`, race: 'human' }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j)); return { tk: r.j.token, id: c.j.id, pseudo: `${n}${u}` }; };
  const st = async (id: number, tk: string) => (await call(`/guilds/${id}`, undefined, tk)).j;
  let a: any, b: any; const R: any[] = [];
  beforeAll(async () => {
    [a, b] = [await mk('groa'), await mk('grob')];
    expect((await call('/guilds', { characterId: a.id, name: `O${u}` }, a.tk)).status).toBe(200);
    expect((await call('/guilds/apply', { characterId: b.id, name: `O${u}` }, b.tk)).status).toBe(200);
    const s0 = await st(a.id, a.tk);
    expect((await call(`/guilds/applicants/${s0.applicants[0].id}/answer`, { characterId: a.id, accept: true }, a.tk)).status).toBe(200);
    R.push(...(await st(a.id, a.tk)).ranks); // [Chef, Officier, Membre]
  });
  test('un nouveau rang arrive en fin de liste (sort_order = max+1)', async () => {
    const r = await call('/guilds/ranks', { characterId: a.id, name: 'Éclaireur' }, a.tk);
    expect(r.status).toBe(200); R.push(r.j);
    expect((await st(a.id, a.tk)).ranks.map((x: any) => x.name)).toEqual(['Chef', 'Officier', 'Membre', 'Éclaireur']);
  });
  test('la réorganisation des rangs est persistée, réservée au Chef ; ids étrangers sans effet', async () => {
    expect((await call('/guilds/reorder', { characterId: b.id, kind: 'ranks', ids: R.map((r: any) => r.id) }, b.tk)).status).toBe(403); // b est « Membre »
    expect((await call('/guilds/reorder', { characterId: a.id, kind: 'ranks', ids: [R[3].id, R[1].id, R[0].id, R[2].id] }, a.tk)).status).toBe(200);
    expect((await st(a.id, a.tk)).ranks.map((x: any) => x.name)).toEqual(['Éclaireur', 'Officier', 'Chef', 'Membre']);
    expect((await call('/guilds/reorder', { characterId: a.id, kind: 'ranks', ids: [R[3].id, 424242, R[0].id, R[1].id] }, a.tk)).status).toBe(200); // 424242 ignoré
    expect((await st(a.id, a.tk)).ranks.map((x: any) => x.name)).toEqual(['Éclaireur', 'Chef', 'Officier', 'Membre']);
  });
  test('le label Chef est renommable ; les visibilités par défaut suivent le nom', async () => {
    expect((await call(`/guilds/ranks/${R[0].id}/rename`, { characterId: a.id, name: 'Commandant' }, a.tk)).status).toBe(200);
    expect((await st(a.id, a.tk)).me.rank).toBe('Commandant'); // le porteur suit le renommage
    expect((await call('/guilds/folders', { characterId: a.id, name: 'Salle' }, a.tk)).status).toBe(200); // aucun rang choisi
    let s = await st(a.id, a.tk); const f = s.folders.find((x: any) => x.name === 'Salle');
    expect(f.visible_ranks).toEqual(['Commandant']); // plus le « Chef » hardcodé
    expect((await call('/guilds/topics', { characterId: a.id, folderId: f.id, title: 'Ordre du jour', body: 'x' }, a.tk)).status).toBe(200);
    s = await st(a.id, a.tk);
    // Forum v2 : un sujet sans choix de rangs hérite de la lecture de sa catégorie (liste vide),
    // plus le défaut « rang Chef » — la lecture effective est donc celle de la catégorie renommée.
    expect(s.folders.find((x: any) => x.id === f.id).topics[0].visible_ranks).toEqual([]);
    expect((await st(b.id, b.tk)).me.rank).toBe('Membre'); // les autres porteurs ne sont pas concernés
  });
  test('séquence front (toggle) : création + réorganisation = insertion au milieu', async () => {
    // Le front crée le rang (sort_order max+1 → fin de liste) puis persiste l'ordre cible
    // via /guilds/reorder : ici la carte d'ajout est affichée en 2e position → insertion « au-dessus ».
    let s = await st(a.id, a.tk); const names0 = s.ranks.map((x: any) => x.name);
    expect(names0).toEqual(['Éclaireur', 'Commandant', 'Officier', 'Membre']);
    const r = await call('/guilds/ranks', { characterId: a.id, name: 'Gardien' }, a.tk);
    expect(r.status).toBe(200);
    s = await st(a.id, a.tk);
    expect(s.ranks.map((x: any) => x.name)).toEqual(['Éclaireur', 'Commandant', 'Officier', 'Membre', 'Gardien']); // création en fin de liste
    const prev = s.ranks.slice(0, -1).map((x: any) => x.id), target = [...prev]; target.splice(2, 0, r.j.id); // Gardien juste après Commandant
    expect((await call('/guilds/reorder', { characterId: a.id, kind: 'ranks', ids: target }, a.tk)).status).toBe(200);
    s = await st(a.id, a.tk);
    expect(s.ranks.map((x: any) => x.name)).toEqual(['Éclaireur', 'Commandant', 'Gardien', 'Officier', 'Membre']);
    // un rang créé ensuite repart de la fin (max+1) malgré l'ordre réorganisé
    expect((await call('/guilds/ranks', { characterId: a.id, name: 'Sentinelle' }, a.tk)).status).toBe(200);
    s = await st(a.id, a.tk);
    expect(s.ranks.map((x: any) => x.name)).toEqual(['Éclaireur', 'Commandant', 'Gardien', 'Officier', 'Membre', 'Sentinelle']);
  });
});

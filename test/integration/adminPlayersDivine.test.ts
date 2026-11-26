import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Objets divins (familles libres + objets du catalogue + exemplaires) et section admin « Joueurs ».
describe.skipIf(!process.env.DATABASE_URL)('Admin : familles divines et fiche joueur', () => {
  let app: any, pool: any; const s = Date.now(); const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const fam = `sceau${s % 100000}`;
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local'); T.p = await login(`pl${s}@x.fr`);
    T.cid = (await call('/characters', { pseudo: `pl${s}`.slice(0, 20), race: 'human' }, T.p)).j.id;
  });
  afterAll(async () => {
    if (T.copies) for (const id of T.copies) await call(`/admin/content/divine/${id}`, undefined, T.adm, 'DELETE');
    if (T.item) await call(`/admin/content/items/${T.item}`, undefined, T.adm, 'DELETE');
    await call(`/admin/content/divine-families/${fam}`, undefined, T.adm, 'DELETE');
  });

  test('reprise : chaque exemplaire historique est rattaché à un objet divin de sa famille', async () => {
    const { rows: [r] } = await pool.query('SELECT count(*)::int n FROM divine_items WHERE item_id IS NULL');
    expect(r.n).toBe(0);
    const fams = (await call('/admin/content/divine-families', undefined, T.adm)).j.map((f: any) => f.key);
    expect(fams).toEqual(expect.arrayContaining(['relique', 'arcane', 'artefact']));
    const divin = (await call('/admin/content/items?rarity=divin', undefined, T.adm)).j;
    expect(divin.some((i: any) => i.divine_family === 'relique' && i.copies > 0)).toBe(true);
  });

  test('nouvelle famille, objet divin au même format que les autres, exemplaires plafonnés', async () => {
    expect((await call('/admin/content/divine-families', { key: fam, name: 'Sceaux', cap: 2 }, T.adm)).status).toBe(200);
    expect((await call('/admin/content/divine-families', { key: 'Bad Key', name: 'x' }, T.adm)).status).toBe(400);
    expect((await call('/admin/content/items', { name: `Sceau ${s}`, rarity: 'rare', divine_family: fam }, T.adm)).status).toBe(400);
    const it = await call('/admin/content/items', { name: `Sceau ${s}`, rarity: 'divin', divine_family: fam, slot: 'amulette', armor: 3, usable_by: ['ange'] }, T.adm);
    expect(it.status, JSON.stringify(it.j)).toBe(200); T.item = it.j.id;
    expect((await call('/admin/content/divine', { itemId: T.item, n: 3 }, T.adm)).status).toBe(409);
    expect((await call('/admin/content/divine', { itemId: T.item, n: 2 }, T.adm)).status).toBe(200);
    const row = (await call('/admin/content/items?rarity=divin', undefined, T.adm)).j.find((i: any) => i.id === T.item);
    expect(row).toMatchObject({ divine_family: fam, family_name: 'Sceaux', copies: 2, family_cap: 2, armor: 3 });
    T.copies = (await call(`/admin/content/divine?itemId=${T.item}`, undefined, T.adm)).j.map((d: any) => d.id);
    expect(T.copies).toHaveLength(2);
    expect((await call(`/admin/content/divine-families/${fam}`, undefined, T.adm, 'DELETE')).status).toBe(409);   // encore utilisée
    expect((await call('/admin/content/divine-families/relique', undefined, T.adm, 'DELETE')).status).toBe(409); // famille du jeu
    expect((await call(`/admin/content/divine-families/${fam}`, { name: 'Sceaux', cap: 1 }, T.adm, 'PUT')).status).toBe(409); // < exemplaires
  });

  test('joueurs : liste paginée par race, réservée aux admins', async () => {
    expect((await call('/admin/players', undefined, T.p)).status).toBe(403);
    const r = await call('/admin/players?per=2&page=1', undefined, T.adm);
    expect(r.status).toBe(200); expect(r.j.rows.length).toBeLessThanOrEqual(2); expect(r.j.total).toBeGreaterThanOrEqual(1);
    expect(r.j.races.find((x: any) => x.race === 'human').n).toBeGreaterThanOrEqual(1);
    const h = await call(`/admin/players?race=human&q=pl${s}`, undefined, T.adm);
    expect(h.j.rows).toHaveLength(1); expect(h.j.rows[0]).toMatchObject({ pseudo: `pl${s}`.slice(0, 20), race: 'human' });
    expect(h.j.rows[0].rank_name).toBeTruthy(); expect(h.j.rows[0].map_id).toBe(1);
  });

  test('fiche joueur : caractéristiques, XP, or, objets (sac / coffre), sorts, montures, divins', async () => {
    const id = T.cid, adm = T.adm;
    const up = await call(`/admin/players/${id}`, { xp: 1234, gold: 999, strength: 42 }, adm, 'PUT');
    expect(up.status, JSON.stringify(up.j)).toBe(200); expect(up.j).toMatchObject({ xp: 1234, gold: 999, strength: 42 });
    expect((await call(`/admin/players/${id}`, { xp: -1 }, adm, 'PUT')).status).toBe(400);
    const items = (await call('/admin/catalog', undefined, adm)).j.items, spells = (await call('/admin/catalog', undefined, adm)).j.spells, mounts = (await call('/admin/catalog', undefined, adm)).j.mounts;
    const bag0 = (await call(`/admin/players/${id}`, undefined, adm)).j.items.find((i: any) => i.place === 'bag' && i.item_id === items[0].id)?.qty ?? 0;   // objets de départ
    expect((await call(`/admin/players/${id}/items`, { itemId: items[0].id, qty: 2, place: 'bag' }, adm)).status).toBe(200);
    expect((await call(`/admin/players/${id}/items`, { itemId: items[0].id, qty: 3, place: 'bag' }, adm)).status).toBe(200);   // empilé
    expect((await call(`/admin/players/${id}/items`, { itemId: items[0].id, place: 'chest' }, adm)).status).toBe(200);
    expect((await call(`/admin/players/${id}/grant`, { kind: 'spell', refId: spells[0].id }, adm)).status).toBe(200);
    expect((await call(`/admin/players/${id}/grant`, { kind: 'mount', refId: mounts[0].id }, adm)).status).toBe(200);
    expect((await call(`/admin/players/${id}/grant`, { kind: 'divine', refId: T.copies[0] }, adm)).status).toBe(200);
    let p = (await call(`/admin/players/${id}`, undefined, adm)).j;
    expect(p.character).toMatchObject({ xp: 1234, gold: 999 });
    expect(p.items.find((i: any) => i.place === 'bag' && i.item_id === items[0].id).qty).toBe(bag0 + 5);
    expect(p.items.some((i: any) => i.place === 'chest' && i.item_id === items[0].id)).toBe(true);
    expect(p.spells.some((x: any) => x.spell_id === spells[0].id)).toBe(true);
    expect(p.mounts.some((x: any) => x.mount_id === mounts[0].id)).toBe(true);
    expect(p.divine.map((x: any) => x.id)).toContain(T.copies[0]);
    expect(p.ranks.length).toBeGreaterThan(0);
    expect((await call(`/admin/players/${id}/items/${items[0].id}?place=chest`, undefined, adm, 'DELETE')).status).toBe(200);
    expect((await call(`/admin/players/${id}/items/${items[0].id}?place=chest`, undefined, adm, 'DELETE')).status).toBe(404);
    expect((await call(`/admin/players/${id}/spells/${spells[0].id}`, undefined, adm, 'DELETE')).status).toBe(200);
    expect((await call(`/admin/players/${id}/mounts/${mounts[0].id}`, undefined, adm, 'DELETE')).status).toBe(200);
    expect((await call(`/admin/content/divine/${T.copies[0]}`, undefined, adm, 'DELETE')).status).toBe(409);   // détenu
    expect((await call(`/admin/players/${id}/divine/${T.copies[0]}/release`, undefined, adm, 'POST')).status).toBe(200);
    p = (await call(`/admin/players/${id}`, undefined, adm)).j;
    expect(p.items.some((i: any) => i.place === 'chest')).toBe(false); expect(p.spells).toHaveLength(0); expect(p.divine).toHaveLength(0);
  });
});

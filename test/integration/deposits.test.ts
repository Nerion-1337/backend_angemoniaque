import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Secteurs de ressources (zone, ressources à parts %, type de case, stock, rendement par récolte, épuisement, régénération).
describe.skipIf(!process.env.DATABASE_URL)('Gisements de ressources', () => {
  let app: any, pool: any, regenDeposits: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' }); return r.j.token; };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; regenDeposits = (await import('../../src/game/deposits')).regenDeposits;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`dp${s}@x.fr`); T.c = (await call('/characters', { pseudo: `dp${s}`, race: 'human' }, T.tk)).j.id;
    await call(`/admin/players/${T.c}/teleport`, { map: 3, x: 20, y: 80 }, T.adm);
    T.p = (await pool.query('SELECT coord_x x, coord_y y FROM positions WHERE character_id=$1', [T.c])).rows[0];
    const cat = (await call('/admin/catalog', undefined, T.adm)).j.resources; T.res = cat[0].id; T.res2 = cat[1].id;
    await pool.query('UPDATE characters SET energy_current=100, energy_max=100, resources=$2 WHERE id=$1', [T.c, '{}']);
  });
  afterAll(async () => { await pool.query("DELETE FROM resource_deposits WHERE name=$1", [`Filon${s}`]); });

  test('admin : validations (hors monde, zone inversée, ressource inconnue, doublon, parts > 100 % par type de case)', async () => {
    const sh = { resource: T.res, percent: 100, stockMax: 5, regenPerH: 3, yieldPerHarvest: 2 };
    const base = { mapId: 3, name: `Filon${s}`, xMin: T.p.x - 1, yMin: T.p.y - 1, xMax: T.p.x + 1, yMax: T.p.y + 1, resources: [sh] };
    expect((await call('/admin/content/deposits', { ...base, xMax: 5000 }, T.adm)).status).toBe(400);
    expect((await call('/admin/content/deposits', { ...base, xMin: T.p.x + 2, xMax: T.p.x }, T.adm)).status).toBe(400);
    expect((await call('/admin/content/deposits', { ...base, resources: [{ ...sh, resource: 'inexistante' }] }, T.adm)).status).toBe(404);
    expect((await call('/admin/content/deposits', { ...base, resources: [sh, sh] }, T.adm)).status).toBe(400);
    const over = await call('/admin/content/deposits', { ...base, resources: [{ ...sh, percent: 60, kind: 'forest' }, { ...sh, resource: T.res2, percent: 50 }] }, T.adm);
    expect(over.status).toBe(400); expect(over.j.error).toMatch(/forêt 110 %/);
    expect((await call('/admin/content/deposits', { ...base, resources: [{ ...sh, percent: 100, kind: 'forest' }, { ...sh, resource: T.res2, percent: 100, kind: 'plain' }] }, T.adm)).status).toBe(200);
    const r = await call('/admin/content/deposits', base, T.adm); expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j).toMatchObject({ name: `Filon${s}`, resources: [{ resource: T.res, percent: 100, kind: null, stock: 5, stock_max: 5, yield_per_harvest: 2 }] }); T.dep = r.j.id;
    expect((await call('/admin/content/deposits?mapId=3', undefined, T.adm)).j.some((d: any) => d.id === T.dep)).toBe(true);
  });

  test('récoltes : ×2, ×2, ×1 (stock restant), puis épuisé (409) ; la case affiche le gisement ; régénération au tick', async () => {
    const cell = (await call(`/map/3/cell?x=${T.p.x}&y=${T.p.y}`, undefined, T.tk)).j;
    expect(cell.deposit).toMatchObject({ resourceId: T.res, stock: 5, stockMax: 5 });
    const got = [];
    for (let i = 0; i < 3; i++) { const r = await call('/actions/gather', { characterId: T.c }, T.tk); expect(r.status, JSON.stringify(r.j)).toBe(200); got.push(r.j.qty); }
    expect(got).toEqual([2, 2, 1]);
    const ko = await call('/actions/gather', { characterId: T.c }, T.tk); expect(ko.status).toBe(409); expect(ko.j.error).toMatch(/épuisé/);
    const ch = (await pool.query('SELECT resources FROM characters WHERE id=$1', [T.c])).rows[0];
    expect(ch.resources[T.res]).toBe(5);
    await regenDeposits();
    expect((await call(`/map/3/cell?x=${T.p.x}&y=${T.p.y}`, undefined, T.tk)).j.deposit.stock).toBe(3);
  });

  test('secteur à deux ressources (60 / 40 %) : chaque case reçoit une seule ressource, selon sa part ; stock propre à chaque ressource', async () => {
    const r = await call('/admin/content/deposits', { mapId: 3, name: `Filon${s}`, xMin: 0, yMin: 0, xMax: 19, yMax: 19,
      resources: [{ resource: T.res, percent: 60, stockMax: 9 }, { resource: T.res2, percent: 40, stockMax: 7 }] }, T.adm);
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const { depositAt } = await import('../../src/game/deposits');
    const n: any = {}; for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) { const d = await depositAt(pool, 3, x, y); n[d.resource] = (n[d.resource] ?? 0) + 1; }
    expect(n[T.res] + n[T.res2]).toBe(400); expect(n[T.res] / 400).toBeGreaterThan(0.5); expect(n[T.res] / 400).toBeLessThan(0.7);
    const d = await depositAt(pool, 3, 0, 0); expect(d.stock_max).toBe(d.resource === T.res ? 9 : 7);
  });

  test('conditions de récolte : objet (sac ou équipé) OU sort ; refus 403 détaillé AVANT récolte ; consommation ; retrait = libre', async () => {
    await call('/admin/content/deposits', { mapId: 3, name: `Filon${s}`, xMin: T.p.x, yMin: T.p.y, xMax: T.p.x, yMax: T.p.y, resources: [{ resource: T.res2, percent: 100, stockMax: 100 }] }, T.adm);
    const axe = (await call('/admin/content/items', { name: `Hache${s}`, slot: 'special' }, T.adm)).j.id;
    const sp = (await call('/admin/content/spells', { name: `Sève${s}`, shop: false }, T.adm)).j.id;
    expect((await call('/admin/content/resource-rules/inexistante', { groups: [] }, T.adm, 'PUT')).status).toBe(404);
    expect((await call(`/admin/content/resource-rules/${T.res2}`, { groups: [{ items: [{ itemId: 999999 }] }] }, T.adm, 'PUT')).status).toBe(404);
    const rule = { groups: [{ items: [{ itemId: axe, qty: 1 }] }, { spellId: sp }] };
    expect((await call(`/admin/content/resource-rules/${T.res2}`, rule, T.adm, 'PUT')).status).toBe(200);
    expect((await call('/admin/content/resource-rules', undefined, T.adm)).j.find((r: any) => r.resource === T.res2).needs).toMatch(/Hache\d+ ×1 — ou — sort/);
    expect((await call(`/map/3/cell?x=${T.p.x}&y=${T.p.y}`, undefined, T.tk)).j.harvestNeeds).toMatch(new RegExp(`Hache${s} ×1 — ou — sort « Sève${s} »`));
    const e0 = (await pool.query('SELECT energy_current FROM characters WHERE id=$1', [T.c])).rows[0].energy_current;
    const ko = await call('/actions/gather', { characterId: T.c }, T.tk); expect(ko.status).toBe(403);
    expect(ko.j.error).toMatch(/Récolte de .+ impossible — option 1 : Hache\d+ ×1 ; option 2 : sort/);
    expect((await pool.query('SELECT energy_current FROM characters WHERE id=$1', [T.c])).rows[0].energy_current).toBe(e0);
    await call(`/admin/players/${T.c}/items`, { itemId: axe, qty: 1, place: 'bag' }, T.adm);
    expect((await call('/actions/gather', { characterId: T.c }, T.tk)).status).toBe(200);
    await pool.query("UPDATE character_items SET equipped_slot='special_1' WHERE character_id=$1 AND item_id=$2", [T.c, axe]);   // outil en main : compte aussi
    expect((await call('/actions/gather', { characterId: T.c }, T.tk)).status).toBe(200);
    await call(`/admin/content/resource-rules/${T.res2}`, { groups: [{ items: [{ itemId: axe, qty: 1 }], consume: true }] }, T.adm, 'PUT');
    expect((await call('/actions/gather', { characterId: T.c }, T.tk)).status).toBe(200);
    expect((await pool.query('SELECT 1 FROM character_items WHERE character_id=$1 AND item_id=$2', [T.c, axe])).rowCount).toBe(0);
    expect((await call('/actions/gather', { characterId: T.c }, T.tk)).status).toBe(403);
    await call(`/admin/content/resource-rules/${T.res2}`, { groups: [] }, T.adm, 'PUT');
    expect((await call('/actions/gather', { characterId: T.c }, T.tk)).status).toBe(200);
    expect((await call(`/map/3/cell?x=${T.p.x}&y=${T.p.y}`, undefined, T.tk)).j.harvestNeeds).toBeNull();
    await call(`/admin/content/spells/${sp}`, undefined, T.adm, 'DELETE');   // features.test compte les sorts
  });
});

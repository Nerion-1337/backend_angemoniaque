import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Lot 5 : gisements de ressources (zone, stock, rendement par récolte, épuisement, régénération).
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
    T.res = (await call('/admin/catalog', undefined, T.adm)).j.resources.find((r: any) => r.id).id;
    await pool.query('UPDATE characters SET energy_current=100, energy_max=100, resources=$2 WHERE id=$1', [T.c, '{}']);
  });
  afterAll(async () => { if (T.dep) await call(`/admin/content/deposits/${T.dep}`, undefined, T.adm, 'DELETE'); });

  test('admin : validations (hors monde, zone inversée, ressource inconnue)', async () => {
    const base = { mapId: 3, xMin: T.p.x - 1, yMin: T.p.y - 1, xMax: T.p.x + 1, yMax: T.p.y + 1, resource: T.res, stockMax: 5, regenPerH: 3, yieldPerHarvest: 2 };
    expect((await call('/admin/content/deposits', { ...base, xMax: 5000 }, T.adm)).status).toBe(400);
    expect((await call('/admin/content/deposits', { ...base, xMin: T.p.x + 2, xMax: T.p.x }, T.adm)).status).toBe(400);
    expect((await call('/admin/content/deposits', { ...base, resource: 'inexistante' }, T.adm)).status).toBe(404);
    const r = await call('/admin/content/deposits', base, T.adm); expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j).toMatchObject({ stock: 5, stock_max: 5, yield_per_harvest: 2 }); T.dep = r.j.id;
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
});

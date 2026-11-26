import { describe, test, expect, beforeAll } from 'vitest';
// Coût en énergie divine réglable en admin (migration 42) : 0 par défaut, exigé et débité au personnage quand il est fixé.
describe.skipIf(!process.env.DATABASE_URL)('Coût en énergie divine', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const me = async () => (await pool.query('SELECT * FROM characters WHERE id=$1', [T.c])).rows[0];
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    const key = `dv${s}`; await call('/admin/content/races', { key, name: 'Divins', base_stats: {} }, T.adm);
    T.r1 = (await call('/admin/content/ranks', { race: key, name: 'Fidèle', current_rank: 1, hp_max: 100, energy_max: 50, divine_energy_max: 20 }, T.adm)).j.id;
    T.r2 = (await call('/admin/content/ranks', { race: key, name: 'Élu', current_rank: 2, hp_max: 150, energy_max: 50, divine_energy_max: 20, max_population_percent: 100 }, T.adm)).j.id;
    T.tk = await login(`dv${s}@x.fr`); T.c = (await call('/characters', { pseudo: `dv${s}`, race: key }, T.tk)).j.id;
  });

  test('sort : 0 par défaut ; coût fixé → refusé sans énergie divine, sinon débité', async () => {
    const free = await call('/admin/content/spells', { name: `Ferveur ${s}`, kind: 'summon_cap', energyCost: 0 }, T.adm);
    expect(free.j.divine_energy_cost).toBe(0);
    const sp = await call('/admin/content/spells', { name: `Grâce ${s}`, kind: 'summon_cap', energyCost: 0, divineEnergyCost: 5 }, T.adm);
    expect(sp.status, JSON.stringify(sp.j)).toBe(200); expect(sp.j.divine_energy_cost).toBe(5);
    await call(`/admin/players/${T.c}/grant`, { kind: 'spell', refId: sp.j.id }, T.adm);
    await pool.query('UPDATE characters SET divine_energy_current=3 WHERE id=$1', [T.c]);
    const ko = await call('/spells/cast', { characterId: T.c, spellId: sp.j.id }, T.tk);
    expect(ko.status).toBe(409); expect(ko.j.error).toMatch(/divine/);
    const cap = (await me()).summon_cap;
    await pool.query('UPDATE characters SET divine_energy_current=12 WHERE id=$1', [T.c]);
    const ok = await call('/spells/cast', { characterId: T.c, spellId: sp.j.id }, T.tk); expect(ok.status, JSON.stringify(ok.j)).toBe(200);
    expect(await me()).toMatchObject({ divine_energy_current: 7, summon_cap: cap + 1 });
    expect((await call(`/admin/content/spells/${sp.j.id}`, { divineEnergyCost: 0 }, T.adm, 'PUT')).j.divine_energy_cost).toBe(0);
  });

  test('passage de rang : énergie divine exigée puis débitée', async () => {
    expect((await call(`/admin/content/ranks/${T.r2}/requirements`, { permanent: { divineEnergyCost: 6, consume: false } }, T.adm, 'PUT')).status).toBe(200);
    await pool.query('UPDATE characters SET divine_energy_current=4 WHERE id=$1', [T.c]);
    const pre = (await call(`/characters/${T.c}/rank-up`, undefined, T.tk)).j; expect(pre.missing.permanent).toContain('énergie divine 6');
    await pool.query('UPDATE characters SET divine_energy_current=10 WHERE id=$1', [T.c]);
    expect((await call(`/characters/${T.c}/rank-up`, { mode: 'permanent' }, T.tk)).status).toBe(200);
    expect(await me()).toMatchObject({ specialization_id: T.r2, divine_energy_current: 4 });
  });

  test('admin : coût divin des cases et des recettes accepté (0 par défaut)', async () => {
    const tiles = (await call('/admin/content/tiles', undefined, T.adm)).j; expect(tiles[0].divine_energy_cost).toBe(0);
    const recipes = (await call('/admin/content/recipes', undefined, T.adm)).j; for (const r of recipes) expect(r.divine_energy_cost).toBeGreaterThanOrEqual(0);
  });
});

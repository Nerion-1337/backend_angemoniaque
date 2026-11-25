import { describe, test, expect, beforeAll } from 'vitest';
// Lot 3 : passage de rang par conditions (objets, ressources, énergie, définitif / temporaire, consommation).
describe.skipIf(!process.env.DATABASE_URL)('Passage de rang par conditions', () => {
  let app: any, pool: any, revertTempRanks: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' }); return r.j.token; };
  const ch = async () => (await pool.query('SELECT c.*, s.name rank_name FROM characters c JOIN specializations s ON s.id=c.specialization_id WHERE c.id=$1', [T.c])).rows[0];
  const key = `rk${s}`;
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; revertTempRanks = (await import('../../src/game/rankUp')).revertTempRanks;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    await call('/admin/content/races', { key, name: 'Rangeur', base_stats: {} }, T.adm);
    T.r = {};
    for (const [n, name, hp] of [[1, 'Recrue', 100], [2, 'Vétéran', 200], [3, 'Champion', 400]] as const) {
      const r = await call('/admin/content/ranks', { race: key, name, current_rank: n, hp_max: hp, recovery: 5, see: 5, strength: 5 * n, agility: 5, energy_max: 60 }, T.adm);
      expect(r.status, JSON.stringify(r.j)).toBe(200); T.r[n] = r.j.id;
    }
    T.cat = (await call('/admin/catalog', undefined, T.adm)).j; T.item = T.cat.items[0].id; T.res = T.cat.resources[0].id;
    T.tk = await login(`rk${s}@x.fr`); T.c = (await call('/characters', { pseudo: `rk${s}`, race: key }, T.tk)).j.id;
  });

  test('admin : conditions validées (objet inconnu 404, ancien format 400), deux voies à la fois', async () => {
    expect((await call(`/admin/content/ranks/${T.r[2]}/requirements`, { permanent: { items: [{ itemId: 999999, qty: 1 }] } }, T.adm, 'PUT')).status).toBe(404);
    expect((await call(`/admin/content/ranks/${T.r[2]}/requirements`, { temporary: { resources: { inexistante: 1 } } }, T.adm, 'PUT')).status).toBe(404);
    expect((await call(`/admin/content/ranks/${T.r[2]}/requirements`, { items: [], mode: 'permanent' }, T.adm, 'PUT')).status).toBe(400);
    expect((await call(`/characters/${T.c}/rank-up`, undefined, T.tk, 'POST')).status).toBe(409);   // aucune condition définie
    const ok = await call(`/admin/content/ranks/${T.r[2]}/requirements`, { permanent: { items: [{ itemId: T.item, qty: 2 }], resources: { [T.res]: 3 }, energyCost: 5, consume: true }, temporary: { items: [], resources: { [T.res]: 999 }, durationH: 1 } }, T.adm, 'PUT');
    expect(ok.status, JSON.stringify(ok.j)).toBe(200);
    expect((await call(`/admin/content/ranks/${T.r[3]}/requirements`, { temporary: { resources: { [T.res]: 1 }, durationH: 2, consume: false } }, T.adm, 'PUT')).status).toBe(200);
  });

  test('passage définitif : conditions manquantes → 409, puis objets/ressources/énergie consommés', async () => {
    const pre = (await call(`/characters/${T.c}/rank-up`, undefined, T.tk)).j;
    expect(pre.next).toMatchObject({ name: 'Vétéran', rank: 2 }); expect(pre.missing.permanent.length).toBeGreaterThan(0); expect(pre.missing.temporary.length).toBeGreaterThan(0);
    expect((await call(`/characters/${T.c}/rank-up`, undefined, T.tk, 'POST')).status).toBe(409);
    await call(`/admin/players/${T.c}/items`, { itemId: T.item, qty: 3, place: 'bag' }, T.adm);
    await pool.query('UPDATE characters SET resources=$2, energy_current=50 WHERE id=$1', [T.c, JSON.stringify({ [T.res]: 5 })]);
    const r = await call(`/characters/${T.c}/rank-up`, undefined, T.tk, 'POST'); expect(r.status, JSON.stringify(r.j)).toBe(200);
    const c = await ch();
    expect(c).toMatchObject({ rank_name: 'Vétéran', hp_max: 200, energy_current: 45, strength: 10 });
    expect(c.resources[T.res]).toBe(2);
    const left = (await pool.query('SELECT COALESCE(sum(qty),0)::int n FROM character_items WHERE character_id=$1 AND item_id=$2 AND NOT in_chest AND equipped_slot IS NULL', [T.c, T.item])).rows[0].n;
    expect(left).toBe(1);
  });

  test('passage temporaire sans consommation, puis retour au rang précédent à l’échéance', async () => {
    expect((await call(`/characters/${T.c}/rank-up`, { mode: 'permanent' }, T.tk)).status).toBe(409);   // pas de voie définitive vers Champion
    const r = await call(`/characters/${T.c}/rank-up`, { mode: 'temporary' }, T.tk); expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j).toMatchObject({ rank: 'Champion', temporary: true, hours: 2 });
    let c = await ch(); expect(c).toMatchObject({ rank_name: 'Champion', hp_max: 400 }); expect(c.resources[T.res]).toBe(2);
    expect((await call(`/characters/${T.c}/rank-up`, { mode: 'temporary' }, T.tk)).status).toBe(409);   // rang temporaire en cours
    await pool.query("UPDATE characters SET temp_rank=jsonb_set(temp_rank, '{until}', to_jsonb(now() - interval '1 minute')) WHERE id=$1", [T.c]);
    await revertTempRanks(pool);
    c = await ch(); expect(c).toMatchObject({ rank_name: 'Vétéran', hp_max: 200, strength: 10, temp_rank: null }); expect(c.hp_current).toBeLessThanOrEqual(200);
  });
});

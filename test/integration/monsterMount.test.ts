import { describe, test, expect, beforeAll } from 'vitest';
// Lot B : fusion monstres / montures — un type montable a sa ligne `mounts` synchronisée (trigger, migration 25).
describe.skipIf(!process.env.DATABASE_URL)('Monstres servant de monture', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const mount = async (monsterId: number) => (await pool.query('SELECT * FROM mounts WHERE monster_id=$1', [monsterId])).rows[0];
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`mm${s}@x.fr`); T.c = (await call('/characters', { pseudo: `mm${s}`, race: 'human' }, T.tk)).j.id;
  });

  test('reprise : chaque monture historique a son type de monstre montable', async () => {
    expect((await pool.query('SELECT count(*)::int n FROM mounts WHERE monster_id IS NULL')).rows[0].n).toBe(0);
    const { rows } = await pool.query("SELECT mo.aquatic, mo.terrestrial, m.locomotion FROM mounts mo JOIN monsters m ON m.id=mo.monster_id WHERE mo.name='Navire'");
    if (rows.length) expect(rows[0]).toMatchObject({ aquatic: true, terrestrial: false, locomotion: ['water'] });
  });

  test('validations : déplacement vide ou inconnu, rareté inconnue → 400', async () => {
    expect((await call('/admin/content/monsters', { name: `Bad${s}`, locomotion: [] }, T.adm)).status).toBe(400);
    expect((await call('/admin/content/monsters', { name: `Bad${s}`, locomotion: ['lava'] }, T.adm)).status).toBe(400);
    expect((await call('/admin/content/monsters', { name: `Bad${s}`, rarity: 'mythique' }, T.adm)).status).toBe(400);
  });

  test('type montable amphibie → ligne mounts synchronisée ; modification suivie ; décocher garde la monture hors catalogue', async () => {
    const r = await call('/admin/content/monsters', { name: `Kelpie${s}`, hp_max: 80, armor: 3, energy_max: 40, mountable: true, locomotion: ['land', 'water'], rarity: 'rare', bonus_see: 2, bonus_range: 1, speed: 2, carry: 30 }, T.adm);
    expect(r.status, JSON.stringify(r.j)).toBe(200); T.m = r.j.id;
    expect(r.j).toMatchObject({ rarity: 'rare', locomotion: ['land', 'water'], mountable: true });
    expect(await mount(T.m)).toMatchObject({ name: `Kelpie${s}`, hp_max: 80, armor: 3, aquatic: true, terrestrial: true, flying: false, bonus_see: 2, bonus_range: 1, carry: 30 });
    expect((await call(`/admin/content/monsters/${T.m}`, { name: `Griffon${s}`, locomotion: ['air'] }, T.adm, 'PUT')).status).toBe(200);
    expect(await mount(T.m)).toMatchObject({ name: `Griffon${s}`, flying: true, aquatic: false, terrestrial: false });
    const cat = async () => (await call('/admin/catalog', undefined, T.adm)).j.mounts.some((x: any) => x.monster_id === T.m);
    expect(await cat()).toBe(true);
    await call(`/admin/content/monsters/${T.m}`, { mountable: false }, T.adm, 'PUT');
    expect(await cat()).toBe(false); expect(await mount(T.m)).toBeTruthy();
    await call(`/admin/content/monsters/${T.m}`, { mountable: true }, T.adm, 'PUT');
  });

  test('suppression refusée tant qu\'un joueur le possède comme monture', async () => {
    expect((await call(`/admin/players/${T.c}/grant`, { kind: 'mount', refId: (await mount(T.m)).id }, T.adm)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${T.m}`, undefined, T.adm, 'DELETE')).status).toBe(409);
    await pool.query('DELETE FROM character_mounts WHERE character_id=$1', [T.c]);
    expect((await call(`/admin/content/monsters/${T.m}`, undefined, T.adm, 'DELETE')).status).toBe(200);
    expect(await mount(T.m)).toBeUndefined();
  });
});

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Races : zone d'apparition et limites (par compte, population) ; compte admin sans limite ; horloge persistante.
describe.skipIf(!process.env.DATABASE_URL)('Races (apparition, limites) et horloge du monde', () => {
  let app: any, pool: any, catchUp: any; const s = Date.now(); const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' }); return r.j.token; };
  const pseudo = (p: string) => `${p}${s % 1e7}`.slice(0, 20);
  const raceRow = async (key: string) => (await pool.query('SELECT * FROM races WHERE key=$1', [key])).rows[0];
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; ({ catchUp } = await import('../../src/game/clock'));
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.demon = await raceRow('demon'); T.angel = await raceRow('angel');
  });
  afterAll(async () => {   // remet les réglages des races comme avant le test
    for (const r of [T.demon, T.angel]) if (r) await call(`/admin/content/races/${r.id}`, { name: r.name, spawn_map_id: r.spawn_map_id, spawn_x: r.spawn_x, spawn_y: r.spawn_y, spawn_radius: r.spawn_radius, max_per_account: r.max_per_account, max_total: r.max_total }, T.adm, 'PUT');
  });

  test('zone d’apparition réglée en admin : le nouveau personnage naît dans le carré centre ± rayon du monde choisi', async () => {
    const bad = await call(`/admin/content/races/${T.demon.id}`, { name: T.demon.name, spawn_map_id: 3, spawn_x: 5000, spawn_y: 1 }, T.adm, 'PUT');
    expect(bad.status).toBe(400);   // centre hors du monde
    const up = await call(`/admin/content/races/${T.demon.id}`, { name: T.demon.name, spawn_map_id: 3, spawn_x: 40, spawn_y: 60, spawn_radius: 3 }, T.adm, 'PUT');
    expect(up.status, JSON.stringify(up.j)).toBe(200); expect(up.j).toMatchObject({ spawn_map_id: 3, spawn_x: 40, spawn_y: 60, spawn_radius: 3 });
    const tk = await login(`sp${s}@x.fr`);
    const c = await call('/characters', { pseudo: pseudo('sp'), race: 'demon' }, tk); expect(c.status, JSON.stringify(c.j)).toBe(200);
    const { rows: [p] } = await pool.query('SELECT map_id, coord_x x, coord_y y FROM positions WHERE character_id=$1', [c.j.id]);
    expect(p.map_id).toBe(3);
    expect(Math.max(Math.abs(p.x - 40), Math.abs(p.y - 60))).toBeLessThanOrEqual(9);   // rayon 3, élargi par pas de 2 si la zone est saturée
  });

  test('limites joueur (serveur) : une seule race, max par compte, population max ; le compte admin est exempté', async () => {
    await call(`/admin/content/races/${T.angel.id}`, { name: T.angel.name, max_per_account: 1, max_total: null }, T.adm, 'PUT');
    const tk = await login(`lim${s}@x.fr`);
    expect((await call('/characters', { pseudo: pseudo('la'), race: 'angel' }, tk)).status).toBe(200);
    const two = await call('/characters', { pseudo: pseudo('lb'), race: 'angel' }, tk);
    expect(two.status).toBe(409); expect(two.j.error).toMatch(/maximum/);
    expect((await call('/characters', { pseudo: pseudo('lc'), race: 'human' }, tk)).status).toBe(400);       // une seule race par compte (même code que le trigger)
    expect((await call('/characters', { pseudo: pseudo('ld'), race: 'inexistante' }, tk)).status).toBe(400);
    const pop = (await pool.query("SELECT count(*)::int n FROM characters WHERE race='angel'")).rows[0].n;
    await call(`/admin/content/races/${T.angel.id}`, { name: T.angel.name, max_per_account: null, max_total: pop }, T.adm, 'PUT');
    const tk2 = await login(`pop${s}@x.fr`);
    const full = await call('/characters', { pseudo: pseudo('le'), race: 'angel' }, tk2);
    expect(full.status).toBe(409); expect(full.j.error).toMatch(/Population/);
    const races = (await call('/characters/races', undefined, tk2)).j;
    expect(races.races.find((r: any) => r.key === 'angel')).toMatchObject({ allowed: false });
    // admin : plusieurs races, au-delà des limites
    for (const race of ['angel', 'demon', 'human']) {
      const r = await call('/characters', { pseudo: pseudo(`ad${race.slice(0, 2)}`), race }, T.adm);
      expect(r.status, `${race} ${JSON.stringify(r.j)}`).toBe(200);
    }
    const ar = (await call('/characters/races', undefined, T.adm)).j;
    expect(ar.admin).toBe(true); expect(ar.races.filter((r: any) => r.allowed).length).toBeGreaterThanOrEqual(3);
  });

  test('horloge : 3 h écoulées (serveur arrêté) → 3 ticks rattrapés, énergie régénérée de 3 × récupération', async () => {
    const tk = await login(`clk${s}@x.fr`);
    const c = await call('/characters', { pseudo: pseudo('ck'), race: 'human' }, tk);
    await catchUp();   // aligne l'horloge (rattrape ce qui serait dû avant le test)
    await pool.query('UPDATE characters SET energy_current=0, recovery=5, energy_max=100 WHERE id=$1', [c.j.id]);
    await pool.query("UPDATE game_clock SET last_tick_at=now()-interval '3 hours 20 minutes' WHERE id=1");
    const n = await catchUp();
    const { rows: [ch] } = await pool.query('SELECT energy_current FROM characters WHERE id=$1', [c.j.id]);
    const { rows: [k] } = await pool.query('SELECT extract(epoch from now()-last_tick_at)/60 mins FROM game_clock WHERE id=1');
    expect([0, 3]).toContain(n);   // 0 si le serveur de la stack (horloge chaque minute) a rattrapé juste avant : le verrou évite tout double comptage
    expect(ch.energy_current).toBe(15);
    expect(Number(k.mins)).toBeGreaterThanOrEqual(19); expect(Number(k.mins)).toBeLessThan(60);   // les 20 min restantes sont conservées
    const dash = (await call('/admin/dashboard', undefined, T.adm)).j;
    expect(dash.clock.last_tick_at).toBeTruthy();
  });
});

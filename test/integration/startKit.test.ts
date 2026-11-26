import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Race créée en admin jouable de bout en bout + équipement de départ par race (races.start_kit).
describe.skipIf(!process.env.DATABASE_URL)('Race libre et équipement de départ', () => {
  let app: any, pool: any; const s = Date.now(); const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const key = `orc${s % 1e7}`;
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.cat = (await call('/admin/catalog', undefined, T.adm)).j;
    T.human = (await pool.query("SELECT * FROM races WHERE key='human'")).rows[0];
  });
  afterAll(async () => {
    if (T.human) await call(`/admin/content/races/${T.human.id}/start-kit`, T.human.start_kit, T.adm, 'PUT');
  });

  test('kit historique repris par la migration : 150 or, 6 objets au sac, le Destrier', async () => {
    const k = T.human.start_kit;
    expect(k.gold).toBe(150); expect(k.items).toHaveLength(6); expect(k.items.every((i: any) => i.place === 'bag')).toBe(true);
    expect(k.mounts).toHaveLength(1);
  });

  test('une race créée en admin, avec un rang, est jouable par un joueur', async () => {
    const r = await call('/admin/content/races', { key, name: 'Orque', base_stats: {} }, T.adm); expect(r.status, JSON.stringify(r.j)).toBe(200); T.race = r.j;
    expect((await call('/admin/content/ranks', { race: key, name: 'Grunt', current_rank: 1, hp_max: 120, recovery: 6, see: 5, strength: 9, agility: 4, energy_max: 55 }, T.adm)).status).toBe(200);
    expect((await call('/admin/content/ranks', { race: key, name: 'Chef', current_rank: 2, hp_max: 300, recovery: 9, see: 7, strength: 20, agility: 8, energy_max: 80 }, T.adm)).status).toBe(200);
    const tk = await login(`orc${s}@x.fr`);
    expect((await call('/characters/races', undefined, tk)).j.races.find((x: any) => x.key === key)).toMatchObject({ allowed: true });
    const c = await call('/characters', { pseudo: `orc${s % 1e7}`, race: key }, tk);
    expect(c.status, JSON.stringify(c.j)).toBe(200);
    const { rows: [ch] } = await pool.query('SELECT c.gold, c.hp_max, s.name FROM characters c JOIN specializations s ON s.id=c.specialization_id WHERE c.id=$1', [c.j.id]);
    expect(ch).toMatchObject({ name: 'Grunt', hp_max: 120, gold: 0 });   // kit vide : premier palier, 0 or
  });

  test('kit réglé en admin : rang, or, XP, ressources, objets sac/coffre, sort, monture active', async () => {
    const it = T.cat.items[0].id, it2 = T.cat.items[1].id, sp = T.cat.spells[0].id, mo = T.cat.mounts[0].id, res = T.cat.resources[0].id;
    const bad = [
      { rank: 9 }, { items: [{ itemId: 999999 }] }, { resources: { inexistante: 2 } },
      { mounts: [{ mountId: mo, active: true }, { mountId: mo, active: true }] },
    ];
    for (const b of bad) expect((await call(`/admin/content/races/${T.race.id}/start-kit`, b, T.adm, 'PUT')).status, JSON.stringify(b)).toBeGreaterThanOrEqual(400);
    const kit = { rank: 2, gold: 500, xp: 42, resources: { [res]: 3 }, items: [{ itemId: it, qty: 2, place: 'bag' }, { itemId: it2, qty: 1, place: 'chest' }], spells: [sp], mounts: [{ mountId: mo, active: true }] };
    const up = await call(`/admin/content/races/${T.race.id}/start-kit`, kit, T.adm, 'PUT');
    expect(up.status, JSON.stringify(up.j)).toBe(200); expect(up.j.start_kit).toMatchObject({ rank: 2, gold: 500 });
    const tk = await login(`orc2${s}@x.fr`);
    const c = await call('/characters', { pseudo: `orb${s % 1e7}`, race: key }, tk); expect(c.status, JSON.stringify(c.j)).toBe(200);
    const p = (await call(`/admin/players/${c.j.id}`, undefined, T.adm)).j;
    expect(p.character).toMatchObject({ gold: 500, xp: 42, rank_name: 'Chef', hp_max: 300 });
    expect(p.character.resources).toMatchObject({ [res]: 3 });
    expect(p.items.find((i: any) => i.item_id === it && i.place === 'bag').qty).toBe(2);
    expect(p.items.some((i: any) => i.item_id === it2 && i.place === 'chest')).toBe(true);
    expect(p.spells.map((x: any) => x.spell_id)).toContain(sp);
    expect(p.mounts).toEqual([expect.objectContaining({ mount_id: mo, active: true })]);
  });
});

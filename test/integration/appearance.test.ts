import { describe, test, expect, beforeAll } from 'vitest';
// Design 3D et icône d'un type de monstre (migration 41) : réglés en admin, recopiés au monstre posé, transmis à la carte,
// à la liste des montures et à la monture montée (HUD).
describe.skipIf(!process.env.DATABASE_URL)('Apparence des monstres (design, icône)', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  beforeAll(async () => { app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local'); });
  test('admin : design et icône validés, null = automatique ; recopiés au monstre posé et visibles sur la carte', async () => {
    expect((await call('/admin/content/monsters', { name: `Bad${s}`, hp_max: 10, model: 'Pas Bon!' }, T.adm)).status).toBe(400);
    const id = (await call('/admin/content/monsters', { name: `Look${s}`, hp_max: 10, model: 'kraken', icon: 'kraken', locomotion: ['water'] }, T.adm)).j.id;
    expect((await call(`/admin/content/monsters/${id}`, undefined, T.adm)).j).toMatchObject({ model: 'kraken', icon: 'kraken' });
    const x = 30 + (s % 100), y = 30 + ((s >> 3) % 100);
    const pl = await call('/admin/bestiary/place', { monsterId: id, mapId: 3, x, y }, T.adm); expect(pl.status, JSON.stringify(pl.j)).toBe(200);
    const area = (await call(`/map/3/area?x=${x}&y=${y}&r=1`, undefined, T.adm)).j, e = area.find((a: any) => a.kind === 'monster' && a.x === x && a.y === y);
    expect(e).toMatchObject({ model: 'kraken', icon: 'kraken' });
    expect((await call(`/admin/content/monsters/${id}`, { model: null, icon: null }, T.adm, 'PUT')).status).toBe(200);
    expect((await call(`/admin/content/monsters/${id}`, undefined, T.adm)).j).toMatchObject({ model: null, icon: null });
  });
  test('monture : design et icône de son type dans la liste des montures et sur le personnage monté', async () => {
    const tk = await login(`look${s}@x.fr`), ch = (await call('/characters', { pseudo: `look${s}`, race: 'human' }, tk)).j.id;
    const type = (await call('/admin/content/monsters', { name: `Griffon${s}`, hp_max: 40, energy_max: 40, mountable: true, locomotion: ['land'], model: 'griffon', icon: 'griffin' }, T.adm)).j.id;
    const mid = (await call(`/admin/content/monsters/${type}`, undefined, T.adm)).j.mount_id; await call(`/admin/players/${ch}/grant`, { kind: 'mount', refId: mid }, T.adm);
    const cm = (await call(`/mounts/${ch}`, undefined, tk)).j.find((m: any) => m.name === `Griffon${s}`); expect(cm).toMatchObject({ model: 'griffon', icon: 'griffin' });
    expect((await call('/mounts/summon', { characterId: ch, cmId: cm.cm_id }, tk)).status).toBe(200);
    expect((await call(`/characters/${ch}`, undefined, tk)).j.mount).toMatchObject({ model: 'griffon', icon: 'griffin' });
  });
});

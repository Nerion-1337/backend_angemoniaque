import { describe, test, expect, beforeAll } from 'vitest';
// Portée des armes et hauteur (migration 36) : un cavalier (hauteur 1) collé n'est pas touché par une arme de portée 1,
// l'est avec une arme de portée 2 ; arme à distance : pleine puissance jusqu'à N cases (aperçu) ; réglages validés en admin.
describe.skipIf(!process.env.DATABASE_URL)('Portée des armes et hauteur', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' }); return r.j.token; };
  const equip = async (reach: number, full?: number) => {
    await pool.query("DELETE FROM character_items WHERE character_id=$1 AND equipped_slot IN ('weapon_main','weapon_off')", [T.a]);
    const it = (await call('/admin/content/items', { name: `Arme${reach}-${s}-${Math.random()}`, slot: 'weapon', weapon_damage: 1, reach, ...(full ? { full_power_at: full } : {}) }, T.adm)).j.id;
    await pool.query("INSERT INTO character_items(character_id,item_id,equipped_slot) VALUES ($1,$2,'weapon_main')", [T.a, it]);
  };
  const attack = () => call('/combat/attack', { characterId: T.a, targetCharacterId: T.b }, T.tka);
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    const { terrain, inSafeZone } = await import('../../src/game/terrain');
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tka = await login(`ra${s}@x.fr`); T.a = (await call('/characters', { pseudo: `ra${s}`, race: 'human' }, T.tka)).j.id;
    T.tkb = await login(`rb${s}@x.fr`); T.b = (await call('/characters', { pseudo: `rb${s}`, race: 'demon' }, T.tkb)).j.id;
    const free = async (x: number, y: number) => terrain(x, y, 1).kind === 'plain' && !inSafeZone(1, x, y) && !(await pool.query('SELECT 1 FROM positions WHERE map_id=1 AND coord_x=$1 AND coord_y=$2', [x, y])).rowCount;
    for (let i = 0; i < 600 && !T.xy; i++) { const x = 20 + (s + i * 7) % 150, y = 20 + (s + i * 13) % 150;   // trois cases de plaine libres en ligne, hors zone sacrée
      if (await free(x, y) && await free(x + 1, y) && await free(x + 2, y)) T.xy = [x, y]; }
    await pool.query('UPDATE positions SET map_id=1, coord_x=$2, coord_y=$3 WHERE character_id=$1', [T.a, T.xy[0], T.xy[1]]);
    await pool.query('UPDATE positions SET map_id=1, coord_x=$2, coord_y=$3 WHERE character_id=$1', [T.b, T.xy[0] + 1, T.xy[1]]);
    await pool.query('UPDATE characters SET energy_current=1000, energy_max=1000, hp_current=100000, hp_max=100000 WHERE id=ANY($1)', [[T.a, T.b]]);
    // B monte une monture terrestre de taille 1 (hauteur 1).
    const type = (await call('/admin/content/monsters', { name: `Cheval${s}`, hp_max: 50, energy_max: 50, mountable: true, locomotion: ['land'], size: 1 }, T.adm)).j.id;
    const mid = (await call(`/admin/content/monsters/${type}`, undefined, T.adm)).j.mount_id;
    await call(`/admin/players/${T.b}/grant`, { kind: 'mount', refId: mid }, T.adm);
    const cm = (await call(`/mounts/${T.b}`, undefined, T.tkb)).j.find((x: any) => x.name === `Cheval${s}`);
    expect((await call('/mounts/summon', { characterId: T.b, cmId: cm.cm_id }, T.tkb)).status).toBe(200);
  });

  test('cavalier collé : arme de portée 1 → hors d\'atteinte ; portée 2 → attaque possible', async () => {
    await equip(1);
    const p = (await call(`/combat/preview/${T.a}/${T.xy[0] + 1}/${T.xy[1]}`, undefined, T.tka)).j;
    expect(p).toMatchObject({ range: 1, height: 1, inRange: false, reachable: false }); expect(p.distance).toBeCloseTo(1.41, 2);
    const r = await attack(); expect(r.status).toBe(409); expect(r.j.error).toContain('hors d\'atteinte');
    await equip(2);
    expect((await call(`/combat/preview/${T.a}/${T.xy[0] + 1}/${T.xy[1]}`, undefined, T.tka)).j).toMatchObject({ range: 2, inRange: true });
    expect((await attack()).status).toBe(200);
  });

  test('portée 2 à deux cases d\'un cavalier : √5 > 2, le héros s\'approche ; arme à distance : puissance selon la distance', async () => {
    await pool.query('UPDATE positions SET coord_x=$2 WHERE character_id=$1', [T.b, T.xy[0] + 2]);
    expect((await call(`/combat/preview/${T.a}/${T.xy[0] + 2}/${T.xy[1]}`, undefined, T.tka)).j).toMatchObject({ inRange: false, reachable: true });
    expect((await attack()).status).toBe(200);
    expect((await pool.query('SELECT coord_x FROM positions WHERE character_id=$1', [T.a])).rows[0].coord_x).toBe(T.xy[0] + 1);   // rapproché d'une case
    await pool.query('UPDATE positions SET coord_x=$2 WHERE character_id=$1', [T.a, T.xy[0]]);
    await equip(6, 1);   // arc : pleine puissance jusqu'à 1 case, portée 6
    const p = (await call(`/combat/preview/${T.a}/${T.xy[0] + 2}/${T.xy[1]}`, undefined, T.tka)).j;
    expect(p.inRange).toBe(true); expect(p.power).toBeLessThan(100); expect(p.power).toBeGreaterThanOrEqual(50);
  });

  test('admin : pleine puissance doit rester sous la portée', async () => {
    expect((await call('/admin/content/items', { name: `Arc bad${s}`, slot: 'weapon', reach: 3, full_power_at: 3 }, T.adm)).status).toBe(400);
    const it = (await call('/admin/content/items', { name: `Arc ok${s}`, slot: 'weapon', reach: 5, full_power_at: 3 }, T.adm)).j;
    expect(it).toMatchObject({ reach: 5, full_power_at: 3 });
    expect((await call(`/admin/content/items/${it.id}`, { reach: 2 }, T.adm, 'PUT')).status).toBe(400);
    expect((await call(`/admin/content/items/${it.id}`, { reach: 2, full_power_at: null }, T.adm, 'PUT')).status).toBe(200);
  });
});

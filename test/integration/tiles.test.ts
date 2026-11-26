import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Section admin « Cases » : types de case par monde (nom, description, coût d'énergie, sort passif).
describe.skipIf(!process.env.DATABASE_URL)('Admin « Cases » (types de case)', () => {
  let app: any, pool: any, terrain: any, applyTileSpells: any, invalidateTiles: any; const s = Date.now(); const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const tile = (mapId: number, kind: string) => T.rows.find((r: any) => r.map_id === mapId && r.kind === kind);
  const put = (mapId: number, kind: string, b: any) => call(`/admin/content/tiles/${mapId}/${kind}`, b, T.adm, 'PUT');
  const restore = (r: any) => put(r.map_id, r.kind, { name: r.name, description: r.description, energyCost: r.energy_cost, spellId: r.spell_id, spellMode: r.spell_mode });
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; terrain = (await import('../../src/game/terrain')).terrain;
    ({ applyTileSpells, invalidateTiles } = await import('../../src/game/tileTypes'));
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local'); T.p = await login(`tile${s}@x.fr`);
    const c = await call('/characters', { pseudo: `tile${s}`.slice(0, 20), race: 'human' }, T.p); T.cid = c.j.id;
    T.rows = (await call('/admin/content/tiles', undefined, T.adm)).j;
  });
  afterAll(async () => { for (const k of T.touched ?? []) await restore(k); if (T.spell) await call(`/admin/content/spells/${T.spell}`, undefined, T.adm, 'DELETE'); });   // base partagée : features.test compte les sorts

  test('liste par monde : 9 types (Hommes, Anges & Démons), 5 (Morts) ; réservé aux admins', async () => {
    for (const [m, n] of [[1, 9], [2, 9], [3, 5]]) expect(T.rows.filter((r: any) => r.map_id === m).length).toBe(n);
    expect(tile(1, 'forest')).toMatchObject({ name: 'Forêt', energy_cost: 2, spell_id: null });
    expect((await call('/admin/content/tiles', undefined, T.p)).status).toBe(403);
  });

  test('validation : type inconnu 400, sort sans bonus/malus 400, sort inexistant 404', async () => {
    expect((await put(1, 'lava', { name: 'x', energyCost: 1 })).status).toBe(400);
    expect((await put(1, 'plain', { name: 'x', energyCost: 1, spellId: 1 })).status).toBe(400);
    expect((await put(1, 'plain', { name: 'x', energyCost: 1, spellId: 999999, spellMode: 'bonus' })).status).toBe(404);
    expect((await put(1, 'plain', { name: 'x', energyCost: 120 })).status).toBe(400);
  });

  test('le coût et le nom édités s’appliquent au déplacement et à la carte de case', async () => {
    const { rows: [p] } = await pool.query('SELECT coord_x x, coord_y y FROM positions WHERE character_id=$1', [T.cid]);
    const kind = terrain(p.x, p.y, 1).kind;
    // case voisine libre de même type que l'origine… on cherche un voisin et on règle SON type
    let dst: any = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const q = { x: p.x + dx, y: p.y + dy }, k = terrain(q.x, q.y, 1).kind;
      if (['shallow', 'deep', 'volcano'].includes(k)) continue;
      if ((await pool.query('SELECT 1 FROM positions WHERE map_id=1 AND coord_x=$1 AND coord_y=$2', [q.x, q.y])).rowCount) continue;
      dst = { ...q, kind: k }; break;
    }
    expect(dst, `aucune case voisine libre autour de ${p.x},${p.y} (${kind})`).toBeTruthy();
    const before = tile(1, dst.kind); T.touched = [before];
    expect((await put(1, dst.kind, { name: `Test ${s}`, description: 'Décrit par le test', energyCost: 7 })).status).toBe(200);
    const cell = await call(`/map/1/cell?x=${dst.x}&y=${dst.y}`, undefined, T.p);
    expect(cell.j.tile).toMatchObject({ name: `Test ${s}`, description: 'Décrit par le test', cost: 7 });
    expect((await call('/map/1/tile-types', undefined, T.p)).j.find((t: any) => t.kind === dst.kind).cost).toBe(7);
    const mv = await call('/actions/move', { characterId: T.cid, x: dst.x, y: dst.y }, T.p);
    expect(mv.status, JSON.stringify(mv.j)).toBe(200); expect(mv.j.cost).toBe(7);
  });

  test('sort passif : malus retire ses dégâts en PV à chaque tick (min. 1), bonus les rend (max. PV max)', async () => {
    const sp = await call('/admin/content/spells', { name: `Givre ${s}`, kind: 'malus', damage: 7, rarity: 'commun' }, T.adm); expect(sp.status, JSON.stringify(sp.j)).toBe(200); T.spell = sp.j.id;
    const { rows: [p] } = await pool.query('SELECT coord_x x, coord_y y FROM positions WHERE character_id=$1', [T.cid]);
    const kind = terrain(p.x, p.y, 1).kind, before = tile(1, kind); T.touched = [...(T.touched ?? []), before];
    await pool.query('UPDATE characters SET hp_current=50, hp_max=GREATEST(hp_max,100) WHERE id=$1', [T.cid]);
    expect((await put(1, kind, { name: before.name, energyCost: before.energy_cost, spellId: sp.j.id, spellMode: 'malus' })).status).toBe(200);
    expect((await call(`/map/1/cell?x=${p.x}&y=${p.y}`, undefined, T.p)).j.tile.spell).toMatchObject({ mode: 'malus', hpPerHour: -7 });
    await applyTileSpells();
    const hp = async () => (await pool.query('SELECT hp_current FROM characters WHERE id=$1', [T.cid])).rows[0].hp_current;
    expect(await hp()).toBe(43);
    await put(1, kind, { name: before.name, energyCost: before.energy_cost, spellId: sp.j.id, spellMode: 'bonus' }); invalidateTiles();
    await applyTileSpells(); expect(await hp()).toBe(50);
    await pool.query('UPDATE characters SET hp_current=3 WHERE id=$1', [T.cid]);
    await put(1, kind, { name: before.name, energyCost: before.energy_cost, spellId: sp.j.id, spellMode: 'malus' });
    await applyTileSpells(); expect(await hp()).toBe(1);   // jamais mortel
  });
});

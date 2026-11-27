import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Lot 4 : bâtiments occupables (bonus, règles d'attaque de l'occupant), armure, sorts passifs / actifs de la structure.
describe.skipIf(!process.env.DATABASE_URL)('Bâtiments paramétrables', () => {
  let app: any, pool: any, terrain: any, hourlySpellEffects: any; const s = Date.now() % 1e7; const T: any = { names: [], spells: [] };
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const pos = async (id: number) => (await pool.query('SELECT coord_x x, coord_y y, map_id m FROM positions WHERE character_id=$1', [id])).rows[0];
  const free = async (m: number, x: number, y: number) => !['shallow', 'deep', 'volcano'].includes(terrain(x, y, m).kind) && !(await pool.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3', [m, x, y])).rowCount;
  const freeNear = async (m: number, x: number, y: number) => { for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (await free(m, x + dx, y + dy)) return { x: x + dx, y: y + dy }; throw new Error('aucune case libre'); };
  const place = async (name: string, owner: number, at: any, extra: any) => {
    const b = await call('/admin/content/buildings', { name, kind: 'tower', structure: 500, ...extra }, T.adm); expect(b.status, JSON.stringify(b.j)).toBe(200); T.names.push(name);
    await pool.query('UPDATE buildings SET owner_id=$2 WHERE id=$1', [b.j.id, owner]);
    await pool.query('INSERT INTO positions(map_id,coord_x,coord_y,building_id) VALUES ($1,$2,$3,$4)', [at.m, at.x, at.y, b.j.id]);
    return b.j;
  };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; terrain = (await import('../../src/game/terrain')).terrain;
    hourlySpellEffects = (await import('../../src/game/spellTick')).hourlySpellEffects;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.atk = await login(`bd${s}a@x.fr`); T.a = (await call('/characters', { pseudo: `bda${s}`, race: 'human' }, T.atk)).j.id;
    T.btk = await login(`bd${s}b@x.fr`); T.b = (await call('/characters', { pseudo: `bdb${s}`, race: 'human' }, T.btk)).j.id;
    await call(`/admin/players/${T.a}/teleport`, { map: 3, x: 70, y: 70 }, T.adm);
    await pool.query('UPDATE characters SET energy_current=100, energy_max=100, hp_current=100, hp_max=300 WHERE id = ANY($1)', [[T.a, T.b]]);
  });
  afterAll(async () => {
    for (const n of T.names) { await pool.query('DELETE FROM entity_spells WHERE kind=$2 AND ref_id IN (SELECT id FROM buildings WHERE name=$1)', [n, 'building']); await pool.query('DELETE FROM positions WHERE building_id IN (SELECT id FROM buildings WHERE name=$1)', [n]); await pool.query('DELETE FROM buildings WHERE name=$1', [n]); }
    for (const id of T.spells) { await pool.query('DELETE FROM character_spells WHERE spell_id=$1', [id]); await call(`/admin/content/spells/${id}`, undefined, T.adm, 'DELETE'); }
  });

  test('case occupable : on y entre (bonus vue / portée / armure) ; un bâtiment non occupable bloque', async () => {
    const pa = await pos(T.a);
    const wallAt = await freeNear(3, pa.x, pa.y); await place(`Mur ${s}`, T.a, { m: 3, ...wallAt }, {});
    expect((await call('/actions/move', { characterId: T.a, ...wallAt }, T.atk)).status).toBe(409);
    const towerAt = await freeNear(3, pa.x, pa.y);
    const tw = await place(`Tour ${s}`, T.a, { m: 3, ...towerAt }, { armor: 4, occupiable: true, bonus_see: 3, bonus_range: 2, bonus_armor: 5, occupant_attack: { melee: false, ranged: true, spell: false } });
    expect(tw).toMatchObject({ armor: 4, occupiable: true, bonus_see: 3 });
    const before = (await call(`/characters/${T.a}`, undefined, T.atk)).j;
    const mv = await call('/actions/move', { characterId: T.a, ...towerAt }, T.atk); expect(mv.status, JSON.stringify(mv.j)).toBe(200);
    const after = (await call(`/characters/${T.a}`, undefined, T.atk)).j;
    expect(after.see_eff).toBe(before.see_eff + 3); expect(after.range_eff).toBe(before.range_eff + 2);
    T.tower = towerAt;
  });

  test('occupant protégé : corps à corps et sorts refusés (403), distance autorisée', async () => {
    const put = async (c: any) => pool.query('UPDATE positions SET map_id=3, coord_x=$2, coord_y=$3 WHERE character_id=$1', [T.b, c.x, c.y]);
    const at = async (d: number) => { for (let dx = -d; dx <= d; dx++) for (let dy = -d; dy <= d; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === d && await free(3, T.tower.x + dx, T.tower.y + dy)) return { x: T.tower.x + dx, y: T.tower.y + dy }; throw new Error(`aucune case libre à ${d}`); };
    await put(await at(1)); await pool.query('UPDATE characters SET range=1, energy_current=100 WHERE id=$1', [T.b]);
    expect((await call('/combat/attack', { characterId: T.b, targetCharacterId: T.a }, T.btk)).status).toBe(403);   // corps à corps
    const sp = await call('/admin/content/spells', { name: `Dard ${s}`, kind: 'engine', energyCost: 1, shop: false, effects: { target: 'single', range: 5, damage: 5, affects: 'all' } }, T.adm); T.spells.push(sp.j.id);
    await pool.query('INSERT INTO character_spells(character_id,spell_id) VALUES ($1,$2)', [T.b, sp.j.id]);
    expect((await call('/spells/cast', { characterId: T.b, spellId: sp.j.id, x: T.tower.x, y: T.tower.y }, T.btk)).status).toBe(403);   // sort
    await put(await at(2)); await pool.query('UPDATE characters SET range=4, energy_current=100 WHERE id=$1', [T.b]);
    // attaque à distance = arme à distance (migration 46) : un arc équipé
    const bow = await call('/admin/content/items', { name: `Arc ${s}`, slot: 'weapon_main', weapon_damage: 2, reach: 1, ranged: true }, T.adm); expect(bow.status, JSON.stringify(bow.j)).toBe(200);
    await pool.query("INSERT INTO character_items(character_id,item_id,equipped_slot) VALUES ($1,$2,'weapon_main')", [T.b, bow.j.id]);
    const r = await call('/combat/attack', { characterId: T.b, targetCharacterId: T.a }, T.btk);
    expect(r.status, JSON.stringify(r.j)).toBe(200);   // à distance : autorisé
  });

  test('sorts de la structure : passif (soin de zone chaque heure) et actif lançable par le propriétaire à côté', async () => {
    const heal = await call('/admin/content/spells', { name: `Halo ${s}`, kind: 'engine', energyCost: 0, shop: false, effects: { target: 'area', radius: 2, affects: 'allies', heal: 30 } }, T.adm); T.spells.push(heal.j.id);
    const { rows: [tw] } = await pool.query('SELECT id FROM buildings WHERE name=$1', [`Tour ${s}`]);
    expect((await call(`/admin/content/spells/${heal.j.id}/links`, { kind: 'building', refId: tw.id, mode: 'passive' }, T.adm)).status).toBe(200);
    await pool.query('UPDATE characters SET hp_current=100 WHERE id=$1', [T.a]);
    await hourlySpellEffects();
    expect((await pool.query('SELECT hp_current FROM characters WHERE id=$1', [T.a])).rows[0].hp_current).toBeGreaterThanOrEqual(130);
    const act = await call('/admin/content/spells', { name: `Rempart ${s}`, kind: 'engine', energyCost: 0, shop: false, effects: { target: 'self', stats: [{ stat: 'energy', value: 10 }] } }, T.adm); T.spells.push(act.j.id);
    expect((await call(`/admin/content/spells/${act.j.id}/links`, { kind: 'building', refId: tw.id, mode: 'active' }, T.adm)).status).toBe(200);
    expect((await call(`/spells/${T.a}`, undefined, T.atk)).j.spells.find((x: any) => x.id === act.j.id).source).toMatch(/bâtiment/);
    expect((await call(`/spells/${T.b}`, undefined, T.btk)).j.spells.some((x: any) => x.id === act.j.id)).toBe(false);   // pas propriétaire
    expect((await call('/spells/cast', { characterId: T.a, spellId: act.j.id }, T.atk)).status).toBe(200);
  });
});

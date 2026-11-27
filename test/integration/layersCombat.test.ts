import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Lot du 2026-11-27 (migration 46) : couches sol / airs d'une case, récolte interdite aux créatures, descente de monture,
// portée mêlée / distance, XP au coup porté (joueur, type de monstre), XP d'esquive, entraînement.
describe.skipIf(!process.env.DATABASE_URL)('Couches, portée, XP de combat, entraînement', () => {
  let app: any, pool: any, terrain: any; const s = Date.now() % 1e7; const T: any = { monsters: [], items: [] };
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const mk = async (n: string) => { const tk = await login(`${n}${s}@x.fr`), id = (await call('/characters', { pseudo: `${n}${s}`, race: 'human' }, tk)).j.id; return { tk, id }; };
  const pos = async (id: number) => (await pool.query('SELECT coord_x x, coord_y y, map_id m FROM positions WHERE character_id=$1', [id])).rows[0];
  const empty = async (m: number, x: number, y: number) => !['shallow', 'deep', 'volcano'].includes(terrain(x, y, m).kind) && !(await pool.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x BETWEEN $2-1 AND $2+1 AND coord_y BETWEEN $3-1 AND $3+1', [m, x, y])).rowCount;
  /** Zone libre (case + voisines) dans le Monde des Morts, hors zone sacrée. */
  const spot = async (seed: number) => { for (let i = 0; i < 200; i++) { const x = 8 + ((seed + i * 37) % 84), y = 8 + ((seed * 7 + i * 53) % 84); if (await empty(3, x, y)) return { x, y }; } throw new Error('aucune zone libre'); };
  const tp = (id: number, c: any) => pool.query('UPDATE positions SET map_id=3, coord_x=$2, coord_y=$3 WHERE character_id=$1', [id, c.x, c.y]);
  const monster = async (extra: any) => { const r = await call('/admin/content/monsters', { name: `M${s}-${T.monsters.length}`, hp_max: 5000, ...extra }, T.adm); expect(r.status, JSON.stringify(r.j)).toBe(200); T.monsters.push(r.j.id); return r.j; };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; terrain = (await import('../../src/game/terrain')).terrain;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.a = await mk('lca'); T.b = await mk('lcb');
    T.spec = (await pool.query('SELECT specialization_id s FROM characters WHERE id=$1', [T.a.id])).rows[0].s;
    T.spec0 = (await pool.query('SELECT xp_hit_player, xp_dodge, train_energy, train_xp FROM specializations WHERE id=$1', [T.spec])).rows[0];
  });
  afterAll(async () => {
    await call(`/admin/content/ranks/${T.spec}`, T.spec0, T.adm, 'PUT');
    for (const id of T.monsters) { await pool.query("DELETE FROM positions WHERE monsters_id IN (SELECT id FROM monsters WHERE id=$1 OR data->>'prototype'=$1::text)", [id]); await pool.query("DELETE FROM monsters WHERE data->>'prototype'=$1::text", [id]); await pool.query('DELETE FROM monsters WHERE id=$1', [id]); }
  });

  test('une case : un élément au sol ET un dans les airs, jamais deux sur la même couche', async () => {
    const c = await spot(s), ground = await monster({}), flyer = await monster({ locomotion: ['air'] }), flyer2 = await monster({ locomotion: ['land', 'air'] });
    expect((await call('/admin/bestiary/place', { monsterId: ground.id, mapId: 3, ...c }, T.adm)).status).toBe(200);
    expect((await call('/admin/bestiary/place', { monsterId: ground.id, mapId: 3, ...c }, T.adm)).status).toBe(409);   // deux au sol
    const f = await call('/admin/bestiary/place', { monsterId: flyer.id, mapId: 3, ...c }, T.adm); expect(f.status, JSON.stringify(f.j)).toBe(200);
    expect((await call('/admin/bestiary/place', { monsterId: flyer2.id, mapId: 3, ...c }, T.adm)).status).toBe(409);   // deux dans les airs
    const cell = (await call(`/map/3/cell?x=${c.x}&y=${c.y}`, undefined, T.a.tk)).j;
    expect(cell.entities.map((e: any) => e.air)).toEqual([false, true]); expect(cell.entity.air).toBe(false);
    expect((await call(`/map/3/cell?x=${c.x}&y=${c.y}&air=1`, undefined, T.a.tk)).j.entity.monster_id).toBe(f.j.id);
    T.cell = c; T.flyerInst = f.j.id; T.groundType = ground;
  });

  test('une créature contrôlée ne récolte pas', async () => {
    const c = await spot(s + 11); await tp(T.a.id, c);
    const { rows: [sm] } = await pool.query("INSERT INTO summons(owner_id,name,hp_current,hp_max,energy_current,energy_max) VALUES ($1,'Bête',10,10,50,50) RETURNING id", [T.a.id]);
    await pool.query('INSERT INTO positions(map_id,coord_x,coord_y,summon_id) VALUES (3,$1,$2,$3)', [c.x + 1, c.y, sm.id]);
    await pool.query('UPDATE characters SET controlled_summon_id=$2 WHERE id=$1', [T.a.id, sm.id]);
    const r = await call('/actions/gather', { characterId: T.a.id }, T.a.tk); expect(r.status).toBe(409); expect(r.j.error).toMatch(/créature ne peut pas récolter/);
    await pool.query('UPDATE characters SET controlled_summon_id=NULL WHERE id=$1', [T.a.id]); await pool.query('DELETE FROM summons WHERE id=$1', [sm.id]);
  });

  test('descendre : la monture reste sur la case, le personnage se pose à côté', async () => {
    const c = await spot(s + 23); await tp(T.a.id, c);
    const mount = await monster({ mountable: true, locomotion: ['land'] });
    const { rows: [sm] } = await pool.query("INSERT INTO summons(owner_id,name,hp_current,hp_max,energy_current,energy_max,monster_id) VALUES ($1,'Destrier',10,10,50,50,$2) RETURNING id", [T.a.id, mount.id]);
    await pool.query('UPDATE characters SET riding_summon_id=$2 WHERE id=$1', [T.a.id, sm.id]);
    const r = await call('/summons/dismount', { characterId: T.a.id }, T.a.tk); expect(r.status, JSON.stringify(r.j)).toBe(200);
    const sp = (await pool.query('SELECT coord_x x, coord_y y FROM positions WHERE summon_id=$1', [sm.id])).rows[0], me = await pos(T.a.id);
    expect(sp).toEqual({ x: c.x, y: c.y }); expect(Math.max(Math.abs(me.x - c.x), Math.abs(me.y - c.y))).toBe(1);
    await pool.query('DELETE FROM summons WHERE id=$1', [sm.id]);
  });

  test('portée : mêlée = portée de l’arme seule ; à distance = portée du personnage (hauteur comprise) + arme − 1', async () => {
    await pool.query("DELETE FROM character_items WHERE character_id=$1 AND equipped_slot IS NOT NULL", [T.a.id]);
    await pool.query('UPDATE characters SET range=4 WHERE id=$1', [T.a.id]);
    const spear = await call('/admin/content/items', { name: `Lance ${s}`, slot: 'weapon_main', weapon_damage: 2, reach: 2 }, T.adm), bow = await call('/admin/content/items', { name: `Arc ${s}`, slot: 'weapon_main', weapon_damage: 2, reach: 2, ranged: true }, T.adm);
    expect(bow.j.ranged).toBe(true); expect(spear.j.ranged).toBe(false);
    await pool.query("INSERT INTO character_items(character_id,item_id,equipped_slot) VALUES ($1,$2,'weapon_main')", [T.a.id, spear.j.id]);
    let me = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j; expect(me.attack_range).toBe(2); expect(me.weapon).toMatchObject({ ranged: false, reach: 2 });
    await pool.query("UPDATE character_items SET item_id=$2 WHERE character_id=$1 AND equipped_slot='weapon_main'", [T.a.id, bow.j.id]);
    me = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j; expect(me.attack_range).toBe(me.range_eff + 1);
    await pool.query("DELETE FROM character_items WHERE character_id=$1 AND equipped_slot IS NOT NULL", [T.a.id]);
  });

  test('XP : coup porté contre un joueur (rang de l’attaquant), esquive du défenseur, coup contre un type de monstre', async () => {
    expect((await call(`/admin/content/ranks/${T.spec}`, { xp_hit_player: -1 }, T.adm, 'PUT')).status).toBe(400);
    expect((await call(`/admin/content/ranks/${T.spec}`, { xp_hit_player: 7, xp_dodge: 4 }, T.adm, 'PUT')).j).toMatchObject({ xp_hit_player: 7, xp_dodge: 4 });
    const c = await spot(s + 41); await tp(T.a.id, c); await tp(T.b.id, { x: c.x + 1, y: c.y });
    const xp = async (id: number) => (await pool.query('SELECT xp FROM characters WHERE id=$1', [id])).rows[0].xp;
    let hit = false, dodged = false;
    for (let i = 0; i < 40 && !(hit && dodged); i++) {
      await pool.query('UPDATE characters SET energy_current=100, hp_current=hp_max, agility=$2 WHERE id=$1', [T.a.id, hit ? 0 : 500]);
      await pool.query('UPDATE characters SET hp_current=hp_max, hp_max=5000, agility=$2 WHERE id=$1', [T.b.id, hit ? 500 : 0]);
      const a0 = await xp(T.a.id), b0 = await xp(T.b.id), r = await call('/combat/attack', { characterId: T.a.id, targetCharacterId: T.b.id }, T.a.tk);
      expect(r.status, JSON.stringify(r.j)).toBe(200);
      if (!r.j.missed) { hit = true; expect((await xp(T.a.id)) - a0).toBeGreaterThanOrEqual(7); }
      else { dodged = true; expect((await xp(T.b.id)) - b0).toBe(4); }
    }
    expect(hit && dodged).toBe(true);
    const tgt = await monster({ xp_hit: 9, rank: 1 }); expect(tgt.xp_hit).toBe(9);
    const mc = await spot(s + 59); await tp(T.a.id, mc);
    const pl = await call('/admin/bestiary/place', { monsterId: tgt.id, mapId: 3, x: mc.x + 1, y: mc.y }, T.adm); expect(pl.status).toBe(200);
    for (let i = 0; i < 20; i++) {
      await pool.query('UPDATE characters SET energy_current=100, agility=500 WHERE id=$1', [T.a.id]);
      const a0 = await xp(T.a.id), r = await call('/combat/attack', { characterId: T.a.id, targetMonsterId: pl.j.id }, T.a.tk); expect(r.status).toBe(200);
      if (!r.j.missed) { expect((await xp(T.a.id)) - a0).toBeGreaterThanOrEqual(9); break; }
    }
  });

  test('entraînement : énergie du rang dépensée, XP du rang gagnée ; XP 0 = indisponible', async () => {
    await call(`/admin/content/ranks/${T.spec}`, { train_energy: 0, train_xp: 0 }, T.adm, 'PUT');
    expect((await call(`/characters/${T.a.id}/train`, undefined, T.a.tk, 'POST')).status).toBe(409);
    await call(`/admin/content/ranks/${T.spec}`, { train_energy: 6, train_xp: 3 }, T.adm, 'PUT');
    await pool.query('UPDATE characters SET energy_current=5 WHERE id=$1', [T.a.id]);
    expect((await call(`/characters/${T.a.id}/train`, undefined, T.a.tk, 'POST')).j.error).toMatch(/Énergie insuffisante/);
    await pool.query('UPDATE characters SET energy_current=10, xp=0 WHERE id=$1', [T.a.id]);
    expect((await call(`/characters/${T.a.id}/train`, undefined, T.a.tk, 'POST')).j).toMatchObject({ ok: true, xp: 3, energy: 6 });
    expect((await pool.query('SELECT xp, energy_current e FROM characters WHERE id=$1', [T.a.id])).rows[0]).toEqual({ xp: 3, e: 4 });
    expect((await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j.rank).toMatchObject({ train_energy: 6, train_xp: 3 });
  });

  test('classement : miniature de l’avatar servie publiquement (image), 404 sans avatar', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await pool.query('UPDATE characters SET portrait=$2 WHERE id=$1', [T.a.id, `data:image/png;base64,${png}`]);
    const r = await app.request(`/ranking/portrait/lca${s}`); expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await r.arrayBuffer()).subarray(1, 4).toString()).toBe('PNG');
    expect((await app.request(`/ranking/portrait/lcb${s}`)).status).toBe(404);
    const row = (await call(`/ranking?around=lca${s}`)).j.rows.find((x: any) => x.pseudo === `lca${s}`); expect(row.has_portrait).toBe(true);
  });
});

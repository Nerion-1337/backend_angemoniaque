import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Lot 2 : moteur de sorts (zone, soin, dégâts, durée, caractéristiques) et liens sort ↔ objet / monstre / bâtiment.
describe.skipIf(!process.env.DATABASE_URL)('Moteur de sorts et liens', () => {
  let app: any, pool: any, hourlyTick: any, hourlySpellEffects: any; const s = Date.now() % 1e7; const T: any = { spells: [], items: [], pos: [] };
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const ch = async (id: number) => (await pool.query('SELECT * FROM characters WHERE id=$1', [id])).rows[0];
  const pos = async (id: number) => (await pool.query('SELECT coord_x x, coord_y y, map_id m FROM positions WHERE character_id=$1', [id])).rows[0];
  const spell = async (name: string, effects: any, extra: any = {}) => {
    const r = await call('/admin/content/spells', { name: `${name} ${s}`, kind: 'engine', energyCost: 1, shop: false, effects, ...extra }, T.adm);
    expect(r.status, JSON.stringify(r.j)).toBe(200); T.spells.push(r.j.id); return r.j.id;
  };
  const learn = (cid: number, sid: number) => pool.query('INSERT INTO character_spells(character_id,spell_id) VALUES ($1,$2)', [cid, sid]);
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    hourlyTick = (await import('../../src/routes/tick')).hourlyTick; hourlySpellEffects = (await import('../../src/game/spellTick')).hourlySpellEffects;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`se${s}@x.fr`);
    T.a = (await call('/characters', { pseudo: `sea${s}`, race: 'human' }, T.tk)).j.id;
    T.b = (await call('/characters', { pseudo: `seb${s}`, race: 'human' }, T.tk)).j.id;
    // A au Monde des Morts (hors zone sacrée), B à côté
    await call(`/admin/players/${T.a}/teleport`, { map: 3, x: 30, y: 30 }, T.adm);
    const pa = await pos(T.a); await call(`/admin/players/${T.b}/teleport`, { map: 3, x: pa.x + 1, y: pa.y }, T.adm);
    T.pa = await pos(T.a); T.pb = await pos(T.b);
    await pool.query('UPDATE characters SET energy_current=100, energy_max=100, hp_current=50, hp_max=200 WHERE id = ANY($1)', [[T.a, T.b]]);
  });
  afterAll(async () => {
    for (const id of T.spells) { await pool.query('DELETE FROM character_spells WHERE spell_id=$1', [id]); await pool.query('DELETE FROM temp_buffs WHERE source=$1', [`spell:${id}`]); await call(`/admin/content/spells/${id}`, undefined, T.adm, 'DELETE'); }
    for (const id of T.items) { await pool.query('DELETE FROM character_items WHERE item_id=$1', [id]); await call(`/admin/content/items/${id}`, undefined, T.adm, 'DELETE'); }
  });

  test('zone alliée : soin + énergie rendue (bornée au max) à A et B ; hors portée → 409', async () => {
    const id = await spell('Aura', { target: 'area', radius: 3, range: 4, affects: 'allies', heal: 20, stats: [{ stat: 'energy', value: 50 }] });
    await learn(T.a, id);
    expect((await call('/spells/cast', { characterId: T.a, spellId: id, x: T.pa.x + 9, y: T.pa.y }, T.tk)).status).toBe(409);
    const r = await call('/spells/cast', { characterId: T.a, spellId: id, x: T.pa.x, y: T.pa.y }, T.tk);
    expect(r.status, JSON.stringify(r.j)).toBe(200); expect(r.j.results.length).toBe(2);
    expect(await ch(T.a)).toMatchObject({ hp_current: 70, energy_current: 100 });   // 100 - 1 (coût) + 50 → borné à 100
    expect((await ch(T.b)).hp_current).toBe(70);
  });

  test('capacité temporaire : énergie max +30 pendant 2 h puis rétablie (réserve ramenée au max)', async () => {
    const id = await spell('Vigueur', { target: 'self', stats: [{ stat: 'energy_max', value: 30 }, { stat: 'energy', value: 30 }], durationH: 2 });
    await learn(T.a, id);
    expect((await call('/spells/cast', { characterId: T.a, spellId: id }, T.tk)).status).toBe(200);
    expect(await ch(T.a)).toMatchObject({ energy_max: 130, energy_current: 129 });
    await pool.query("UPDATE temp_buffs SET expires_at=now()-interval '1 minute' WHERE source=$1", [`spell:${id}`]);
    await hourlyTick();
    const c = await ch(T.a); expect(c.energy_max).toBe(100); expect(c.energy_current).toBeLessThanOrEqual(100);
  });

  test('cible unique hostile : dégâts instantanés + dégâts sur la durée (jamais mortels), refusé en zone de paix', async () => {
    const id = await spell('Poison', { target: 'single', range: 4, damage: 10, dot: { damage: 500, hours: 3 }, affects: 'all' });
    await learn(T.a, id);
    await pool.query('UPDATE characters SET hp_current=100, hp_max=200 WHERE id=$1', [T.b]);
    const r = await call('/spells/cast', { characterId: T.a, spellId: id, x: T.pb.x, y: T.pb.y }, T.tk);
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect((await ch(T.b)).hp_current).toBeLessThan(100);
    expect((await pool.query("SELECT count(*)::int n FROM spell_dots WHERE target_kind='character' AND target_id=$1", [T.b])).rows[0].n).toBe(1);
    await hourlySpellEffects();
    expect((await ch(T.b)).hp_current).toBe(1);   // 500/h mais plancher 1
    // zone de paix d'une structure (la zone sacrée codée en dur a disparu le 2026-11-28)
    const pa = await pos(T.a), pb = await pos(T.b);
    const bz = (await pool.query("INSERT INTO buildings(name,kind,peace_radius) VALUES ('Paix', 'totem', 3) RETURNING id")).rows[0].id;
    await pool.query('INSERT INTO positions(map_id,coord_x,coord_y,building_id) VALUES ($1,$2,$3,$4)', [pa.m, pa.x - 2, pa.y, bz]);
    await pool.query('UPDATE characters SET hp_current=100, energy_current=100 WHERE id = ANY($1)', [[T.a, T.b]]);
    const no = await call('/spells/cast', { characterId: T.a, spellId: id, x: pb.x, y: pb.y }, T.tk);
    await pool.query('DELETE FROM positions WHERE building_id=$1', [bz]); await pool.query('DELETE FROM buildings WHERE id=$1', [bz]);
    expect(no.status).toBe(403); expect(no.j?.error ?? '').toMatch(/Zone de paix/);
    await pool.query('DELETE FROM spell_dots WHERE target_id=$1', [T.b]);
  });

  test('liens : sort lancé grâce à un objet ÉQUIPÉ ; sort passif d’un objet porté au tick ; plus de lien monture ; admin des liens', async () => {
    const id = await spell('Éclat', { target: 'self', heal: 15 });
    const it = await call('/admin/content/items', { name: `Talisman ${s}`, rarity: 'rare', slot: 'collier' }, T.adm); T.items.push(it.j.id);
    const l = await call(`/admin/content/spells/${id}/links`, { kind: 'item', refId: it.j.id, mode: 'active' }, T.adm); expect(l.status).toBe(200);
    expect((await call(`/admin/content/spells/${id}/links`, { kind: 'item', refId: it.j.id, mode: 'active' }, T.adm)).status).toBe(409);
    expect((await call('/spells/cast', { characterId: T.a, spellId: id }, T.tk)).status).toBe(404);   // objet non équipé
    await pool.query("INSERT INTO character_items(character_id,item_id,equipped_slot) VALUES ($1,$2,'necklace')", [T.a, it.j.id]);
    const list = (await call(`/spells/${T.a}`, undefined, T.tk)).j.spells.find((x: any) => x.id === id);
    expect(list.source).toMatch(/objet/);
    await pool.query('UPDATE characters SET hp_current=10 WHERE id=$1', [T.a]);
    expect((await call('/spells/cast', { characterId: T.a, spellId: id }, T.tk)).status).toBe(200);
    expect((await ch(T.a)).hp_current).toBe(25);
    // objet porté + sort passif : +15 PV par heure ; plus de lien vers une monture (migration 43)
    expect((await call(`/admin/content/spells/${id}/links`, { kind: 'mount', refId: 1, mode: 'passive' }, T.adm)).status).toBe(400);
    const lp = await call(`/admin/content/spells/${id}/links`, { kind: 'item', refId: it.j.id, mode: 'passive' }, T.adm); expect(lp.status).toBe(200);
    await hourlySpellEffects();
    expect((await ch(T.a)).hp_current).toBe(40);
    const links = (await call(`/admin/content/spells/${id}/links`, undefined, T.adm)).j;
    expect(links.map((x: any) => x.kind).sort()).toEqual(['item', 'item']);
    for (const x of links) expect((await call(`/admin/content/spells/${id}/links/${x.kind}/${x.id}`, undefined, T.adm, 'DELETE')).status).toBe(200);
  });
});

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Lot du 2026-11-28 (migration 49) : éléments d'activation d'une structure (objet, sort, or, XP ; consommé ou possédé ; durée ou
// définitif ; plusieurs éléments), XP totale accumulée, structure invisible, zone de paix exposée par la carte.
describe.skipIf(!process.env.DATABASE_URL)('Activation des structures, XP totale, visibilité', () => {
  let app: any, pool: any, terrain: any; const s = Date.now() % 1e7; const T: any = { buildings: [] };
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const empty = async (x: number, y: number) => !['shallow', 'deep', 'volcano'].includes(terrain(x, y, 3).kind) && !(await pool.query('SELECT 1 FROM positions WHERE map_id=3 AND coord_x BETWEEN $1-2 AND $1+2 AND coord_y BETWEEN $2-2 AND $2+2', [x, y])).rowCount;
  const spot = async (seed: number) => { for (let i = 0; i < 400; i++) { const x = 15 + ((seed + i * 37) % 120), y = 15 + ((seed * 7 + i * 53) % 120); if (await empty(x, y)) return { x, y }; } throw new Error('aucune zone libre'); };
  const me = async () => (await pool.query('SELECT xp, xp_total, gold FROM characters WHERE id=$1', [T.c])).rows[0];
  const building = async (body: any) => {
    const c = await spot(s + T.buildings.length * 17), r = await call('/admin/content/buildings', { name: `SA${s}-${T.buildings.length}`, kind: 'totem', ...body }, T.adm);
    expect(r.status, JSON.stringify(r.j)).toBe(200); T.buildings.push(r.j.id);
    await pool.query('INSERT INTO positions(map_id,coord_x,coord_y,building_id) VALUES (3,$1,$2,$3)', [c.x, c.y, r.j.id]);
    await pool.query('UPDATE positions SET map_id=3, coord_x=$2, coord_y=$3 WHERE character_id=$1', [T.c, c.x + 1, c.y]); return { ...r.j, c };
  };
  const act = (id: number, body: any = {}) => call(`/buildings/${id}/activate`, { characterId: T.c, ...body }, T.tk);
  const state = async (id: number) => (await call(`/buildings/${id}/state/${T.c}`, undefined, T.tk)).j;
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; terrain = (await import('../../src/game/terrain')).terrain;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local'); T.tk = await login(`sa${s}@x.fr`);
    T.c = (await call('/characters', { pseudo: `sa${s}`, race: 'human' }, T.tk)).j.id;
    T.item = (await pool.query('SELECT id FROM items ORDER BY id LIMIT 1')).rows[0].id; T.spell = (await pool.query('SELECT id FROM spells ORDER BY id LIMIT 1')).rows[0].id;
  });
  afterAll(async () => { for (const id of T.buildings) { await pool.query('DELETE FROM positions WHERE building_id=$1', [id]); await pool.query('DELETE FROM buildings WHERE id=$1', [id]); } });

  test('admin : références vérifiées, schéma validé', async () => {
    expect((await call('/admin/content/buildings', { name: `Bad${s}`, activations: [{ kind: 'item', ref: 999999999, qty: 1 }] }, T.adm)).status).toBe(404);
    expect((await call('/admin/content/buildings', { name: `Bad${s}`, activations: [{ kind: 'spell', qty: 1 }] }, T.adm)).status).toBe(400);
  });

  test('plusieurs éléments, chacun sa durée : or (payé N fois), objet consommé / possédé, sort connu, définitif', async () => {
    const B = await building({ activations: [{ kind: 'gold', qty: 10, hours: 2 }, { kind: 'item', ref: T.item, qty: 2, hours: 1, consume: true }, { kind: 'item', ref: T.item, qty: 1, hours: 3, consume: false }, { kind: 'spell', ref: T.spell, hours: null }] });
    let st = await state(B.id); expect(st.elements.map((e: any) => [e.kind, e.max_times])).toEqual([['gold', 100], ['item', 100], ['item', 1], ['spell', 1]]);
    expect(st.elements[3].label).toMatch(/définitivement/); expect(st.elements[0].label).toBe('10 or · 2 h');
    await pool.query('UPDATE characters SET gold=25 WHERE id=$1', [T.c]);
    expect((await act(B.id, { element: 0, times: 3 })).status).toBe(403);   // 30 or requis
    const g = await act(B.id, { element: 0, times: 2 }); expect(g.status, JSON.stringify(g.j)).toBe(200); expect((await me()).gold).toBe(5);
    expect(new Date(g.j.until).getTime()).toBeGreaterThan(Date.now() + 4 * 3600e3 - 60e3);
    expect((await act(B.id, { element: 2, times: 2 })).status).toBe(400);   // possédé : une seule fois
    await pool.query('DELETE FROM character_items WHERE character_id=$1 AND item_id=$2', [T.c, T.item]);
    await pool.query("INSERT INTO character_items(character_id,item_id,qty) VALUES ($1,$2,1)", [T.c, T.item]);
    const p = await act(B.id, { element: 2 }); expect(p.status, JSON.stringify(p.j)).toBe(200);   // possédé : gardé, la durée s'ajoute
    expect(new Date(p.j.until).getTime()).toBeGreaterThan(new Date(g.j.until).getTime() + 3 * 3600e3 - 60e3);
    expect((await act(B.id, { element: 1 })).status).toBe(403);   // 2 consommés requis, 1 seul
    await pool.query("INSERT INTO character_items(character_id,item_id,qty) VALUES ($1,$2,1)", [T.c, T.item]);
    expect((await act(B.id, { element: 1 })).status).toBe(200);
    expect((await pool.query('SELECT COALESCE(sum(qty),0)::int n FROM character_items WHERE character_id=$1 AND item_id=$2', [T.c, T.item])).rows[0].n).toBe(0);
    expect((await act(B.id, { element: 3 })).status).toBe(403);   // sort non appris
    await pool.query('INSERT INTO character_spells(character_id,spell_id) VALUES ($1,$2)', [T.c, T.spell]);
    expect((await act(B.id, { element: 3 })).status).toBe(200);
    st = await state(B.id); expect(st).toMatchObject({ active: true, forever: true, can_activate: false });
    expect((await pool.query("SELECT open_until='infinity' f FROM buildings WHERE id=$1", [B.id])).rows[0].f).toBe(true);
  });

  test('XP : consommée = XP libre retirée ; possédée = XP totale (dépensée comprise), jamais retirée', async () => {
    await pool.query('UPDATE characters SET xp=100 WHERE id=$1', [T.c]); await pool.query('UPDATE characters SET xp=20 WHERE id=$1', [T.c]);   // 80 « dépensés »
    const tot = Number((await me()).xp_total); expect(tot).toBeGreaterThanOrEqual(100);
    const B = await building({ activations: [{ kind: 'xp', qty: 50, hours: 1, consume: true }, { kind: 'xp', qty: tot, hours: 1, consume: false }] });
    expect((await act(B.id, { element: 0 })).status).toBe(403);   // 20 XP libres seulement
    expect((await act(B.id, { element: 1 })).status).toBe(200); expect((await me()).xp).toBe(20);   // l'XP totale suffit, rien retiré
    await pool.query('UPDATE characters SET xp=70 WHERE id=$1', [T.c]);
    expect((await act(B.id, { element: 0 })).status).toBe(200);
    const m = await me(); expect(m.xp).toBe(20); expect(Number(m.xp_total)).toBe(tot + 50);   // dépenser ne baisse pas l'XP totale
  });

  test('structure à activer : ses sorts passifs ne valent que pendant l’activation ; structure invisible absente de la carte', async () => {
    const B = await building({ visible: false, activations: [{ kind: 'gold', qty: 1, hours: 1 }] });
    const cell = (await call(`/map/3/cell?x=${B.c.x}&y=${B.c.y}`, undefined, T.tk)).j; expect(cell.entity).toBeNull();
    const area = (await call(`/map/3/area?x=${B.c.x}&y=${B.c.y}&r=1`, undefined, T.tk)).j; expect(area.some((e: any) => e.building_id === B.id)).toBe(false);
    const V = await building({ peace_radius: 2 });
    const z = (await call('/map/3/zones', undefined, T.tk)).j.find((x: any) => x.id === V.id); expect(z).toMatchObject({ x: V.c.x, y: V.c.y, r: 2, name: V.name });
    expect((await call(`/map/3/cell?x=${V.c.x + 1}&y=${V.c.y}`, undefined, T.tk)).j.peace).toBe(V.name);
  });
});

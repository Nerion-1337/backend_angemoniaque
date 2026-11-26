import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Lot 1 : boutique par race (objets, sorts) et parchemins de fabrication (objet, sort, bâtiment).
describe.skipIf(!process.env.DATABASE_URL)('Boutique par race et parchemins', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = { items: [], spells: [], recipes: [], buildings: [] };
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const toCapital = async (id: number, race: string) => {   // place le personnage à côté de sa capitale (boutique)
    const { rows: [b] } = await pool.query("SELECT p.map_id m,p.coord_x x,p.coord_y y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.kind='capital' AND b.data->>'race'=$1", [race]);
    expect((await call(`/admin/players/${id}/teleport`, { map: b.m, x: b.x, y: b.y }, T.adm)).status).toBe(200);
  };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.hTk = await login(`cs${s}h@x.fr`); T.h = (await call('/characters', { pseudo: `csh${s}`, race: 'human' }, T.hTk)).j.id;
    T.aTk = await login(`cs${s}a@x.fr`); T.a = (await call('/characters', { pseudo: `csa${s}`, race: 'angel' }, T.aTk)).j.id;
    T.res = (await call('/admin/catalog', undefined, T.adm)).j.resources[0].id;
  });
  afterAll(async () => {
    for (const id of T.recipes) await call(`/admin/content/recipes/${id}`, undefined, T.adm, 'DELETE');
    for (const id of T.spells) { await pool.query('DELETE FROM character_spells WHERE spell_id=$1', [id]); await call(`/admin/content/spells/${id}`, undefined, T.adm, 'DELETE'); }
    for (const n of T.buildings) { await pool.query('DELETE FROM positions WHERE building_id IN (SELECT id FROM buildings WHERE name=$1)', [n]); await pool.query('DELETE FROM buildings WHERE name=$1', [n]); }
    for (const id of T.items) { await pool.query('DELETE FROM character_items WHERE item_id=$1', [id]); await call(`/admin/content/items/${id}`, undefined, T.adm, 'DELETE'); }
  });

  test('boutique : un objet réservé aux anges et un sort hors boutique', async () => {
    const it = await call('/admin/content/items', { name: `Plume ${s}`, rarity: 'rare', price: 99999, shop: true, shop_stock: 5, shop_races: ['angel'] }, T.adm);
    expect(it.status, JSON.stringify(it.j)).toBe(200); T.items.push(it.j.id);
    const sp = await call('/admin/content/spells', { name: `Secret ${s}`, kind: 'buff', price: 1, shop: false }, T.adm);
    expect(sp.status).toBe(200); T.spells.push(sp.j.id);
    const hs = (await call(`/shop?characterId=${T.h}`, undefined, T.hTk)).j, as = (await call(`/shop?characterId=${T.a}`, undefined, T.aTk)).j;
    expect(hs.items.some((i: any) => i.id === it.j.id)).toBe(false);
    expect(as.items.some((i: any) => i.id === it.j.id)).toBe(true);
    expect([...hs.spells, ...as.spells].some((x: any) => x.id === sp.j.id)).toBe(false);
    await toCapital(T.h, 'human');
    expect((await call('/shop/buy', { characterId: T.h, itemId: it.j.id }, T.hTk)).status).toBe(404);
    expect((await call('/shop/learn', { characterId: T.h, spellId: sp.j.id }, T.hTk)).status).toBe(404);
  });

  test('parchemin → objet : ressources et parchemin consommés, objet au sac', async () => {
    const target = await call('/admin/content/items', { name: `Lame forgée ${s}`, rarity: 'rare', shop: false }, T.adm); T.items.push(target.j.id);
    expect((await call('/admin/content/recipes', { newScrollName: `Parchemin ${s}`, targetKind: 'item', targetId: target.j.id, resources: { inexistante: 1 } }, T.adm)).status).toBe(404);
    const r = await call('/admin/content/recipes', { newScrollName: `Parchemin de lame ${s}`, targetKind: 'item', targetId: target.j.id, qtyOut: 2, resources: { [T.res]: 3 }, energyCost: 2 }, T.adm);
    expect(r.status, JSON.stringify(r.j)).toBe(200); T.recipes.push(r.j.id); T.items.push(r.j.scroll_item_id);
    expect((await call('/admin/content/recipes', { scrollItemId: r.j.scroll_item_id, targetKind: 'item', targetId: target.j.id }, T.adm)).status).toBe(409);
    expect((await call('/craft', { characterId: T.h, recipeId: r.j.id }, T.hTk)).status).toBe(403);      // pas de parchemin
    await call(`/admin/players/${T.h}/items`, { itemId: r.j.scroll_item_id, qty: 1, place: 'bag' }, T.adm);
    const list = (await call(`/craft/${T.h}`, undefined, T.hTk)).j.find((x: any) => x.id === r.j.id);
    expect(list.missing).toEqual({ [T.res]: 3 });
    expect((await call('/craft', { characterId: T.h, recipeId: r.j.id }, T.hTk)).status).toBe(409);      // ressources manquantes
    await pool.query('UPDATE characters SET resources=$2, energy_current=50 WHERE id=$1', [T.h, JSON.stringify({ [T.res]: 5 })]);
    const ok = await call('/craft', { characterId: T.h, recipeId: r.j.id }, T.hTk); expect(ok.status, JSON.stringify(ok.j)).toBe(200);
    const p = (await call(`/admin/players/${T.h}`, undefined, T.adm)).j;
    expect(p.items.find((i: any) => i.item_id === target.j.id && i.place === 'bag').qty).toBe(2);
    expect(p.items.some((i: any) => i.item_id === r.j.scroll_item_id)).toBe(false);
    expect(p.character.resources[T.res]).toBe(2); expect(p.character.energy_current).toBe(48);
  });

  test('parchemin → sort (non consommé, à l’hôtel de ville) puis bâtiment sur case adjacente', async () => {
    const sp = await call('/admin/content/spells', { name: `Rune ${s}`, kind: 'buff', shop: false }, T.adm); T.spells.push(sp.j.id);
    const r = await call('/admin/content/recipes', { newScrollName: `Grimoire ${s}`, targetKind: 'spell', targetId: sp.j.id, consumeScroll: false, atCapital: true }, T.adm);
    expect(r.status).toBe(200); T.recipes.push(r.j.id); T.items.push(r.j.scroll_item_id);
    await call(`/admin/players/${T.a}/items`, { itemId: r.j.scroll_item_id, place: 'bag' }, T.adm);
    await call(`/admin/players/${T.a}/teleport`, { map: 3, x: 50, y: 50 }, T.adm);
    expect((await call('/craft', { characterId: T.a, recipeId: r.j.id }, T.aTk)).status).toBe(409);      // hors hôtel de ville
    await toCapital(T.a, 'angel');
    expect((await call('/craft', { characterId: T.a, recipeId: r.j.id }, T.aTk)).status).toBe(200);
    expect((await call('/craft', { characterId: T.a, recipeId: r.j.id }, T.aTk)).status).toBe(409);      // déjà appris, parchemin gardé
    const bm = await call('/admin/content/buildings', { name: `Tour ${s}`, kind: 'tower', structure: 300 }, T.adm); T.buildings.push(`Tour ${s}`);
    const rb = await call('/admin/content/recipes', { newScrollName: `Plan ${s}`, targetKind: 'building', targetId: bm.j.id }, T.adm); T.recipes.push(rb.j.id); T.items.push(rb.j.scroll_item_id);
    await call(`/admin/players/${T.a}/items`, { itemId: rb.j.scroll_item_id, place: 'bag' }, T.adm);
    const { rows: [pos] } = await pool.query('SELECT map_id m, coord_x x, coord_y y FROM positions WHERE character_id=$1', [T.a]);
    expect((await call('/craft', { characterId: T.a, recipeId: rb.j.id }, T.aTk)).status).toBe(400);     // case requise
    let done = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const r2 = await call('/craft', { characterId: T.a, recipeId: rb.j.id, x: pos.x + dx, y: pos.y + dy }, T.aTk);
      if (r2.status === 200) { done = { x: pos.x + dx, y: pos.y + dy }; break; }
    }
    expect(done).toBeTruthy();
    const { rows: [bd] } = await pool.query('SELECT b.owner_id, b.structure FROM buildings b JOIN positions p ON p.building_id=b.id WHERE p.map_id=$1 AND p.coord_x=$2 AND p.coord_y=$3', [pos.m, done!.x, done!.y]);
    expect(bd).toMatchObject({ owner_id: T.a, structure: 300 });
  });
});

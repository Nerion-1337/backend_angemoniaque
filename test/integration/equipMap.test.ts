import { describe, test, expect, beforeAll } from 'vitest';
// Équipement à deux mains (plus d'emplacement « arc »), détail des caractéristiques, amélioration de carte vendue à l'Hôtel de ville.
describe.skipIf(!process.env.DATABASE_URL)('Équipement et carte des ressources', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  /** Case libre à 2 cases au plus de la capitale humaine (les tests y entassent des personnages). */
  const nearCapital = async () => {
    const { rows: [cap] } = await pool.query("SELECT p.map_id m, p.coord_x x, p.coord_y y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.kind='capital' AND b.data->>'race'='human'");
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2], [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1], [1, 0], [0, 1], [-1, 0], [0, -1]])
      if (!(await pool.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3', [cap.m, cap.x + dx, cap.y + dy])).rowCount) {
        await pool.query('UPDATE positions SET map_id=$2, coord_x=$3, coord_y=$4 WHERE character_id=$1', [T.c, cap.m, cap.x + dx, cap.y + dy]); return; }
    throw new Error('capitale encerclée');
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' }); return r.j.token; };
  const give = async (name: string, extra: any) => { const id = (await call('/admin/content/items', { name: `${name}${s}`, ...extra }, T.adm)).j.id; await call(`/admin/players/${T.c}/items`, { itemId: id, qty: 1, place: 'bag' }, T.adm); return id; };
  const equip = (itemId: number, slot: string | null) => call('/inventory/equip', { characterId: T.c, itemId, slot }, T.tk);
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`eq${s}@x.fr`); T.c = (await call('/characters', { pseudo: `eq${s}`, race: 'human' }, T.tk)).j.id;
  });

  test('arc à deux mains : main principale seulement, l’autre main reste libre ; bouclier refusé ensuite', async () => {
    const bow = await give('Arc', { slot: 'weapon', weapon_damage: 3, two_handed: true }), shield = await give('Pavois', { slot: 'shield', armor: 2 });
    expect((await equip(bow, 'weapon_off')).status).toBe(400);
    expect((await equip(bow, 'weapon_main')).status).toBe(200);
    expect((await equip(shield, 'weapon_off')).status).toBe(409);
    expect((await equip(bow, 'bow')).status).toBe(400);   // plus d'emplacement « arc »
  });
  test('type « mains » créé avant la correction : la migration l’a ramené à « weapon » (équipable)', async () => {
    const { rows: [r] } = await pool.query("SELECT count(*)::int n FROM items WHERE slot IN ('mains','tete','torse','pieds','collier','bague','bow')"); expect(r.n).toBe(0);
  });
  test('détail des caractéristiques : base + objet = valeur finale', async () => {
    const ring = await give('Anneau', { slot: 'ring', strength_bonus: 3, bonuses: { hp_max: 10 } });
    expect((await equip(ring, 'ring_l')).status).toBe(200);
    const me = (await call(`/characters/${T.c}`, undefined, T.tk)).j, b = me.breakdown;
    expect(b.strength.final).toBe(me.stats.strength); expect(b.strength.parts).toContainEqual({ label: `Anneau${s}`, value: 3, kind: 'item' });
    expect(b.strength.base + 3).toBe(b.strength.final);
    expect(b.hp_max.parts).toContainEqual({ label: `Anneau${s}`, value: 10, kind: 'item' }); expect(b.hp_max.final).toBe(me.hp_max);
  });
  test('amélioration de carte : prix réglé en admin, achat à l’Hôtel de ville, visible et modifiable sur la fiche joueur', async () => {
    expect((await call('/admin/content/map-upgrade', { price: 40 }, T.adm, 'PUT')).status).toBe(200);
    expect((await call(`/shop?characterId=${T.c}`, undefined, T.tk)).j.mapUpgrade.price).toBe(40);
    await call(`/admin/players/${T.c}/teleport`, { map: 3, x: 50, y: 50 }, T.adm);
    expect((await call('/shop/map-upgrade', { characterId: T.c }, T.tk)).status).toBe(409);   // loin de la capitale
    await nearCapital();
    await pool.query('UPDATE characters SET gold=100 WHERE id=$1', [T.c]);
    const r = await call('/shop/map-upgrade', { characterId: T.c }, T.tk); expect(r.status, JSON.stringify(r.j)).toBe(200);
    const world = (await pool.query('SELECT map_id FROM positions WHERE character_id=$1', [T.c])).rows[0].map_id;
    expect((await call(`/characters/${T.c}`, undefined, T.tk)).j).toMatchObject({ map_worlds: [world], gold: 60 });   // seulement le monde de cette capitale
    expect((await call('/shop/map-upgrade', { characterId: T.c }, T.tk)).status).toBe(409);   // déjà acquise
    expect((await call(`/admin/players/${T.c}`, { map_worlds: [] }, T.adm, 'PUT')).status).toBe(200);
    expect((await call(`/admin/players/${T.c}`, undefined, T.adm)).j.character.map_worlds).toEqual([]);
  });
  test('parchemin de carte des ressources : un par monde (migration 38), ouvre son monde à l’usage, consommé, pas deux fois', async () => {
    const scrolls = (await pool.query("SELECT id, (data->>'map_id')::int map_id FROM items WHERE data->>'kind'='resource_map' ORDER BY 2")).rows;
    expect(scrolls.map((r: any) => r.map_id)).toEqual((await pool.query('SELECT id FROM maps ORDER BY id')).rows.map((r: any) => r.id));
    const dead = scrolls.find((r: any) => r.map_id === 3).id;
    expect((await call(`/admin/players/${T.c}/items`, { itemId: dead, qty: 2 }, T.adm)).status).toBe(200);
    const r = await call('/inventory/use', { characterId: T.c, itemId: dead }, T.tk); expect(r.status, JSON.stringify(r.j)).toBe(200); expect(r.j.world).toBe(3);
    expect((await call(`/characters/${T.c}`, undefined, T.tk)).j.map_worlds).toContain(3);
    expect((await call('/inventory/use', { characterId: T.c, itemId: dead }, T.tk)).status).toBe(409);   // monde déjà ouvert : le 2e reste au sac
    expect((await pool.query('SELECT qty FROM character_items WHERE character_id=$1 AND item_id=$2', [T.c, dead])).rows[0].qty).toBe(1);
    await call('/admin/content/map-upgrade', { price: 500 }, T.adm, 'PUT');
  });
  test('Royaume des Morts : ses ressources sont au catalogue admin (gisements, conditions)', async () => {
    const cat = (await call('/admin/catalog', undefined, T.adm)).j.resources.map((r: any) => r.id);
    for (const id of ['asphodele_spectrale', 'saule_lamentations', 'ame_cristallisee']) expect(cat).toContain(id);
  });
});

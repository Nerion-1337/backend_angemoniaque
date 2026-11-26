import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Lot E : conditions d'activation d'un bâtiment (groupes alternatifs, consommation) ; porte et sorts « à activer ».
describe.skipIf(!process.env.DATABASE_URL)('Activation des bâtiments', () => {
  let app: any, pool: any, terrain: any; const s = Date.now() % 1e7; const T: any = { bids: [] };
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const me = async () => (await pool.query('SELECT p.map_id m, p.coord_x x, p.coord_y y, c.* FROM characters c JOIN positions p ON p.character_id=c.id WHERE c.id=$1', [T.c])).rows[0];
  /** Pose le bâtiment sur une case libre adjacente au personnage. */
  const placeNext = async (bid: number) => {
    const p = await me();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const x = p.x + dx, y = p.y + dy;
      if (['shallow', 'deep', 'volcano'].includes(terrain(x, y, p.m).kind) || (await pool.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3', [p.m, x, y])).rowCount) continue;
      await pool.query('INSERT INTO positions(map_id,coord_x,coord_y,building_id) VALUES ($1,$2,$3,$4)', [p.m, x, y, bid]); T.bids.push(bid); return;
    }
    throw new Error('aucune case adjacente libre');
  };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; terrain = (await import('../../src/game/terrain')).terrain;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`ba${s}@x.fr`); T.c = (await call('/characters', { pseudo: `ba${s}`, race: 'human' }, T.tk)).j.id;
    await call(`/admin/players/${T.c}/teleport`, { map: 3, x: 60 + (s % 80), y: 70 + (s % 60) }, T.adm);
    T.item = (await call('/admin/content/items', { name: `Clef${s}`, slot: 'special' }, T.adm)).j.id;
    T.sp = (await call('/admin/content/spells', { name: `Savoir${s}`, shop: false }, T.adm)).j.id;
    T.boost = (await call('/admin/content/spells', { name: `Souffle${s}`, shop: false, effects: { target: 'self', stats: [{ stat: 'energy', value: 7 }] } }, T.adm)).j.id;
    T.ranks = (await call('/admin/catalog', undefined, T.adm)).j.ranks.filter((r: any) => r.race === 'human');
  });
  afterAll(async () => { for (const id of T.bids) await pool.query('DELETE FROM positions WHERE building_id=$1', [id]); });

  test('admin : référence inconnue → 404 ; ancien format refusé (400)', async () => {
    expect((await call('/admin/content/buildings', { name: `Bad${s}`, activation: { groups: [{ items: [{ itemId: 999999, qty: 1 }] }] } }, T.adm)).status).toBe(404);
    expect((await call('/admin/content/buildings', { name: `Bad${s}`, activation: { groups: [{ ranks: [999999] }] } }, T.adm)).status).toBe(404);
    expect((await call('/admin/content/buildings', { name: `Bad${s}`, activation: { requires: 'relique' } }, T.adm)).status).toBe(400);
  });

  test('groupes alternatifs : rien → 403 détaillé ; 2 clés consommées ; puis rang 2 + sort connu (sans consommation)', async () => {
    const r2 = T.ranks.find((r: any) => r.current_rank === 2);
    const act = { groups: [{ items: [{ itemId: T.item, qty: 2 }], consume: true }, { minRank: 2, spellId: T.sp }] };
    const b = await call('/admin/content/buildings', { name: `Obélisque${s}`, kind: 'totem', activation: act }, T.adm); expect(b.status, JSON.stringify(b.j)).toBe(200);
    await call(`/admin/content/spells/${T.boost}/links`, { kind: 'building', refId: b.j.id, mode: 'active' }, T.adm);
    await placeNext(b.j.id);
    await pool.query('UPDATE characters SET energy_current=50, energy_max=100 WHERE id=$1', [T.c]);
    const ko = await call(`/buildings/${b.j.id}/activate`, { characterId: T.c }, T.tk);
    expect(ko.status).toBe(403); expect(ko.j.error, ko.j.error).toMatch(/option 1 : Clef\d+ ×2 ; option 2 : sort « Savoir\d+ », rang 2 minimum/);
    await call(`/admin/players/${T.c}/items`, { itemId: T.item, qty: 2, place: 'bag' }, T.adm);
    const ok = await call(`/buildings/${b.j.id}/activate`, { characterId: T.c }, T.tk); expect(ok.status, JSON.stringify(ok.j)).toBe(200);
    expect(ok.j.option).toBe(1); expect((await me()).energy_current).toBe(57);   // sort « à activer » du bâtiment appliqué à l'activateur
    expect((await pool.query('SELECT 1 FROM character_items WHERE character_id=$1 AND item_id=$2', [T.c, T.item])).rowCount).toBe(0);
    await pool.query('UPDATE characters SET specialization_id=$2 WHERE id=$1', [T.c, r2.id]);
    await call(`/admin/players/${T.c}/grant`, { kind: 'spell', refId: T.sp }, T.adm);
    const ok2 = await call(`/buildings/${b.j.id}/activate`, { characterId: T.c }, T.tk); expect(ok2.status, JSON.stringify(ok2.j)).toBe(200); expect(ok2.j.option).toBe(2);
    expect((await call(`/buildings/${b.j.id}/interact`, { characterId: T.c }, T.tk)).j.activation.groups).toHaveLength(2);
  });

  test('porte : les conditions réglées remplacent l\'objet divin historique (ici 10 or, consommés)', async () => {
    const d = await call('/admin/content/buildings', { name: `Seuil${s}`, kind: 'door', data: { to: [3, 30, 30], requires: 'relique' }, activation: { groups: [{ gold: 10, consume: true }] } }, T.adm);
    expect(d.status, JSON.stringify(d.j)).toBe(200); await placeNext(d.j.id);
    await pool.query('UPDATE characters SET gold=5 WHERE id=$1', [T.c]);
    expect((await call('/divine/door', { characterId: T.c, buildingId: d.j.id }, T.tk)).status).toBe(403);
    await pool.query('UPDATE characters SET gold=15 WHERE id=$1', [T.c]);
    const r = await call('/divine/door', { characterId: T.c, buildingId: d.j.id }, T.tk); expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect((await me()).gold).toBe(5);
    expect((await call(`/buildings/${d.j.id}/activate`, { characterId: T.c }, T.tk)).status).toBe(409);   // plus à côté (franchie)
  });
});

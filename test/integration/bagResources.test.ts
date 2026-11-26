import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Ressources dans le sac / le coffre (piles par emplacement), sac plein, « pas équipé pour récolter », parchemin d'agrandissement du sac.
describe.skipIf(!process.env.DATABASE_URL)('Sac, piles de ressources et parchemin de sac', () => {
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
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const inv = async () => (await call(`/inventory/${T.c}`, undefined, T.tk)).j;
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`bg${s}@x.fr`); T.c = (await call('/characters', { pseudo: `bg${s}`, race: 'human' }, T.tk)).j.id;
    await call(`/admin/players/${T.c}/teleport`, { map: 3, x: 30 + (s % 50), y: 30 + (s % 40) }, T.adm);
    T.p = (await pool.query('SELECT coord_x x, coord_y y FROM positions WHERE character_id=$1', [T.c])).rows[0];
    T.res = 'ame_cristallisee';
    expect((await call(`/admin/content/resource-stack/${T.res}`, { stackMax: 5 }, T.adm, 'PUT')).status).toBe(200);
    T.dep = (await call('/admin/content/deposits', { mapId: 3, name: `Sac${s}`, xMin: T.p.x, yMin: T.p.y, xMax: T.p.x, yMax: T.p.y, resources: [{ resource: T.res, percent: 100, stockMax: 500, yieldPerHarvest: 3 }] }, T.adm)).j.id;
    await pool.query("UPDATE characters SET energy_current=200, energy_max=200, resources='{}' WHERE id=$1", [T.c]);
  });
  afterAll(async () => { await pool.query('DELETE FROM resource_deposits WHERE id=$1', [T.dep]); await pool.query('UPDATE resource_rules SET stack_max=20 WHERE resource=$1', [T.res]); });

  test('la ressource récoltée apparaît dans le sac, en piles de « quantité par emplacement »', async () => {
    for (let i = 0; i < 4; i++) expect((await call('/actions/gather', { characterId: T.c }, T.tk)).status).toBe(200);
    const b = await inv(), mine = b.resStacks.filter((r: any) => r.id === T.res);
    expect(mine.map((r: any) => r.qty)).toEqual([5, 5, 2]); expect(mine[0]).toMatchObject({ name: 'Âme cristallisée', stack: 5 });
    expect(b.bagUsed).toBe(b.items.filter((i: any) => !i.equipped_slot).length + 3);
  });
  test('sac plein : récolte refusée avant tout trajet / toute dépense', async () => {
    const b = await inv(); await pool.query('UPDATE characters SET bag_size=$2 WHERE id=$1', [T.c, b.bagUsed]);
    await pool.query("UPDATE characters SET resources=jsonb_set(resources, '{ame_cristallisee}', '15') WHERE id=$1", [T.c]);   // piles pleines : +3 demande un emplacement
    const e0 = (await pool.query('SELECT energy_current FROM characters WHERE id=$1', [T.c])).rows[0].energy_current;
    const r = await call('/actions/gather', { characterId: T.c }, T.tk); expect(r.status).toBe(409); expect(r.j.error).toMatch(/Sac plein/);
    expect((await pool.query('SELECT energy_current FROM characters WHERE id=$1', [T.c])).rows[0].energy_current).toBe(e0);
    await pool.query('UPDATE characters SET bag_size=20 WHERE id=$1', [T.c]);
  });
  test('condition de récolte : la case dit ce qui manque à CE personnage ; plus rien quand il est équipé', async () => {
    const pick = (await call('/admin/content/items', { name: `Pioche${s}`, slot: 'tool' }, T.adm)).j.id;
    await call(`/admin/content/resource-rules/${T.res}`, { groups: [{ items: [{ itemId: pick, qty: 1 }] }] }, T.adm, 'PUT');
    const cell = async () => (await call(`/map/3/cell?x=${T.p.x}&y=${T.p.y}&characterId=${T.c}`, undefined, T.tk)).j;
    expect((await cell()).harvestMissing).toEqual([`Pioche${s} ×1`]);
    await call(`/admin/players/${T.c}/items`, { itemId: pick, qty: 1, place: 'bag' }, T.adm);
    expect((await cell()).harvestMissing).toEqual([]);
    expect((await call(`/map/3/cell?x=${T.p.x}&y=${T.p.y}`, undefined, T.tk)).j.harvestMissing).toBeUndefined();
    await call(`/admin/content/resource-rules/${T.res}`, { groups: [] }, T.adm, 'PUT');
    expect((await cell()).harvestMissing).toBeNull();
    expect((await call('/admin/content/resource-rules', undefined, T.adm)).j.find((r: any) => r.resource === T.res).stack_max).toBe(5);   // la taille de pile reste
  });
  test('coffre : ressources déplacées sac ⇄ coffre, place vérifiée en piles', async () => {
    await nearCapital();
    await pool.query('UPDATE characters SET chest_size=2 WHERE id=$1', [T.c]);
    expect((await call('/chest/resource', { characterId: T.c, resource: T.res, to: 'chest' }, T.tk)).status).toBe(409);   // 15 = 3 piles > 2
    expect((await call('/chest/resource', { characterId: T.c, resource: T.res, qty: 10, to: 'chest' }, T.tk)).status).toBe(200);
    const ch = (await call(`/chest/${T.c}`, undefined, T.tk)).j; expect(ch.used).toBe(2); expect(ch.resources.map((r: any) => r.qty)).toEqual([5, 5]);
    expect((await call('/chest/resource', { characterId: T.c, resource: T.res, to: 'bag' }, T.tk)).status).toBe(200);
    expect((await pool.query('SELECT resources->>$2 r, chest_resources->>$2 c FROM characters WHERE id=$1', [T.c, T.res])).rows[0]).toEqual({ r: '15', c: '0' });
  });
  test('parchemin de sac : +5 jusqu’à 30, consommé ; refusé au maximum', async () => {
    const sc = (await call('/admin/content/items', { name: `Besace${s}`, slot: 'scroll', data: { kind: 'bag', add: 5, max: 30 } }, T.adm)).j.id;
    await call(`/admin/players/${T.c}/items`, { itemId: sc, qty: 3, place: 'bag' }, T.adm);
    expect((await call('/inventory/use', { characterId: T.c, itemId: sc }, T.tk)).j.bagSize).toBe(25);
    expect((await call('/inventory/use', { characterId: T.c, itemId: sc }, T.tk)).j.bagSize).toBe(30);
    const ko = await call('/inventory/use', { characterId: T.c, itemId: sc }, T.tk); expect(ko.status).toBe(409); expect(ko.j.error).toMatch(/30/);
    expect((await inv()).bagMax).toBe(30);
    expect((await pool.query('SELECT COALESCE(sum(qty),0)::int n FROM character_items WHERE character_id=$1 AND item_id=$2', [T.c, sc])).rows[0].n).toBe(1);
  });
});

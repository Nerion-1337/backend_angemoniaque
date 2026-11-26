import { describe, test, expect, beforeAll } from 'vitest';
// Lot C : toutes les caractéristiques offertes par un objet ; armure magique comptée partout.
describe.skipIf(!process.env.DATABASE_URL)('Caractéristiques des objets et armure magique', () => {
  let app: any, pool: any, lib: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const ch = async () => (await pool.query('SELECT hp_max, hp_current, see, range, energy_max, recovery FROM characters WHERE id=$1', [T.c])).rows[0];
  const equip = (slot: string | null) => call('/inventory/equip', { characterId: T.c, itemId: T.item, slot }, T.tk);
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; lib = await import('../../src/game/combatlib');
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`is${s}@x.fr`); T.c = (await call('/characters', { pseudo: `is${s}`, race: 'human' }, T.tk)).j.id;
  });

  test('admin : caractéristique inconnue → 400 ; objet à bonus créé', async () => {
    expect((await call('/admin/content/items', { name: `Bad${s}`, slot: 'head', bonuses: { charisme: 3 } }, T.adm)).status).toBe(400);
    const r = await call('/admin/content/items', { name: `Heaume${s}`, slot: 'head', armor: 3, magic_armor: 4, strength_bonus: 2, bonuses: { hp_max: 20, see: 2, range: 1, energy_max: -5, recovery: 1 } }, T.adm);
    expect(r.status, JSON.stringify(r.j)).toBe(200); T.item = r.j.id;
  });

  test('équiper reporte les bonus sur la fiche, déséquiper les retire exactement (même si l\'objet a changé entre-temps)', async () => {
    T.base = await ch();
    await call(`/admin/players/${T.c}/grant`, { kind: 'item', refId: T.item }, T.adm);
    const e = await equip('head'); expect(e.status, JSON.stringify(e.j)).toBe(200);
    expect(await ch()).toMatchObject({ hp_max: T.base.hp_max + 20, see: T.base.see + 2, range: T.base.range + 1, energy_max: T.base.energy_max - 5, recovery: T.base.recovery + 1 });
    const st = (await call(`/characters/${T.c}`, undefined, T.tk)).j.stats;
    expect(st).toMatchObject({ armor: 3, magicArmor: 4 });
    await call(`/admin/content/items/${T.item}`, { bonuses: { hp_max: 500 } }, T.adm, 'PUT');   // modifié pendant qu'il est porté
    await pool.query("UPDATE character_items SET equipped_at=now()-interval '13 hours' WHERE character_id=$1", [T.c]);   // verrou de 12 h passé
    expect((await equip(null)).status).toBe(200);
    expect(await ch()).toMatchObject({ hp_max: T.base.hp_max, see: T.base.see, range: T.base.range, energy_max: T.base.energy_max, recovery: T.base.recovery });
  });

  test('un objet porté qui disparaît (retrait admin) rend aussi ses bonus', async () => {
    expect((await equip('head')).status).toBe(200);
    expect((await ch()).hp_max).toBe(T.base.hp_max + 500);
    expect((await call(`/admin/players/${T.c}/items/${T.item}?place=equipped`, undefined, T.adm, 'DELETE')).status).toBe(200);
    expect((await ch()).hp_max).toBe(T.base.hp_max);
  });

  test('armure magique : base du personnage (sorts) + équipement ; monstre = la sienne + ses objets portés', async () => {
    await pool.query('UPDATE characters SET magic_armor=5, armor=2 WHERE id=$1', [T.c]);
    const { rows: [p] } = await pool.query('SELECT * FROM positions WHERE character_id=$1', [T.c]);
    const t = await lib.loadTarget(pool, p); expect([t.armor, t.magicArmor]).toEqual([2, 5]);
    const m = (await call('/admin/content/monsters', { name: `Golem${s}`, hp_max: 50, hp_current: 50, armor: 1, magic_armor: 2 }, T.adm)).j.id;
    await pool.query('INSERT INTO monster_equips(monster_id,item_id,slot) VALUES ($1,$2,$3)', [m, T.item, 'head']);
    const mt = await lib.loadTarget(pool, { monsters_id: m }); expect([mt.armor, mt.magicArmor]).toEqual([4, 6]);
    await pool.query('DELETE FROM monster_equips WHERE monster_id=$1', [m]);
  });
});

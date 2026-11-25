import { describe, test, expect, beforeAll } from 'vitest';
// Lot A : parties du corps retirables ; réapparition réglée par type (non recréé, conditions sur les éléments limités).
describe.skipIf(!process.env.DATABASE_URL)('Monstres : parties du corps et réapparition', () => {
  let app: any, pool: any, lib: any, reincarnateDue: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' }); return r.j.token; };
  /** Pose une instance du type sur une case libre de la carte 3 (essais successifs). */
  const place = async (monsterId: number) => {
    for (let i = 0; i < 60; i++) {
      const r = await call('/admin/bestiary/place', { monsterId, mapId: 3, x: 30 + ((s + i * 7) % 150), y: 30 + ((s * 3 + i * 11) % 150) }, T.adm);
      if (r.status === 200) return r.j.id;
    }
    throw new Error('aucune case libre');
  };
  const kill = async (id: number) => {
    const { rows: [p] } = await pool.query('SELECT * FROM positions WHERE monsters_id=$1', [id]);
    await lib.applyDamage(pool, await lib.loadTarget(pool, p), 1e6, T.c);
  };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    lib = await import('../../src/game/combatlib'); reincarnateDue = (await import('../../src/game/spawn')).reincarnateDue;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`mr${s}@x.fr`); T.c = (await call('/characters', { pseudo: `mr${s}`, race: 'human' }, T.tk)).j.id;
    T.item = (await call('/admin/content/items', { name: `Relique${s}`, slot: 'special' }, T.adm)).j.id;   // objet dédié : pas de conflit avec les suites parallèles
  });

  test('partie du corps : cochée puis décochée (le paramètre texte n\'est plus converti en nombre)', async () => {
    const m = (await call('/admin/content/monsters', { name: `Slot${s}`, hp_max: 10, hp_current: 10 }, T.adm)).j.id;
    expect((await call(`/admin/content/monsters/${m}/slots`, { slot: 'weapon_main' }, T.adm)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${m}/slots/weapon_main`, undefined, T.adm, 'DELETE')).status).toBe(200);
    expect((await call(`/admin/content/monsters/${m}/slots`, undefined, T.adm)).j).toEqual([]);
  });

  test('type non recréé : l\'instance tuée disparaît', async () => {
    const m = (await call('/admin/content/monsters', { name: `NoRe${s}`, hp_max: 10, hp_current: 10, respawn: false }, T.adm));
    expect(m.status, JSON.stringify(m.j)).toBe(200);
    const id = await place(m.j.id); await kill(id);
    expect((await pool.query('SELECT 1 FROM monsters WHERE id=$1', [id])).rowCount).toBe(0);
  });

  test('conditions : pas de réapparition tant que le joueur détient l\'objet limité, puis réapparition', async () => {
    const m = await call('/admin/content/monsters', { name: `Lim${s}`, hp_max: 10, hp_current: 10, respawn: true, reincarnate_delay_h: 0, respawn_limits: [{ kind: 'item', ref: T.item, max: 1 }] }, T.adm);
    expect(m.status, JSON.stringify(m.j)).toBe(200);
    expect((await call(`/admin/content/monsters/${m.j.id}`, { respawn_limits: [{ kind: 'potion', ref: 1, max: 1 }] }, T.adm, 'PUT')).status).toBe(400);
    const id = await place(m.j.id);
    await pool.query('DELETE FROM character_items WHERE item_id=$1', [T.item]);
    await call(`/admin/players/${T.c}/items`, { itemId: T.item, qty: 1, place: 'bag' }, T.adm);
    await kill(id);
    const hp = async () => (await pool.query('SELECT hp_current FROM monsters WHERE id=$1', [id])).rows[0].hp_current;
    expect(await hp()).toBe(0);
    await reincarnateDue(pool); expect(await hp()).toBe(0);   // l'objet est chez un joueur : bloqué
    await pool.query('DELETE FROM character_items WHERE item_id=$1', [T.item]);
    await reincarnateDue(pool); expect(await hp()).toBe(10);
  });
});

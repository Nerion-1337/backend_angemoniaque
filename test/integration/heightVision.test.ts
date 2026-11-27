import { describe, test, expect, beforeAll } from 'vitest'; import { summonAndRide } from './_ride';
// Vision / portée selon la hauteur : invocation montée terrestre ou aquatique = +taille ; volante = +6 (sans la taille) ; capacité passive d'un sort.
// Coffre réglé par capitale ; coûts d'amélioration réglés en admin.
describe.skipIf(!process.env.DATABASE_URL)('Hauteur, coffre, coûts d’amélioration', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const me = async () => (await call(`/characters/${T.c}`, undefined, T.tk)).j;
  const ride = async (name: string, extra: any) => {   // descend, renvoie ses invocations, invoque le type et monte dessus
    await call('/summons/dismount', { characterId: T.c }, T.tk); await pool.query('DELETE FROM summons WHERE owner_id=$1', [T.c]);
    // descendre pose le personnage à côté (la monture reste) : retour sur la case de plaine de référence (niveau 0)
    await pool.query('UPDATE positions SET map_id=1, coord_x=$2, coord_y=$3 WHERE character_id=$1', [T.c, T.xy[0], T.xy[1]]);
    return (await summonAndRide(call, T.adm, T.c, T.tk, { name: `${name}${s}`, ...extra })).type;
  };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`hv${s}@x.fr`); T.c = (await call('/characters', { pseudo: `hv${s}`, race: 'human' }, T.tk)).j.id;
    const { terrain } = await import('../../src/game/terrain');
    for (let i = 0; i < 400 && !T.xy; i++) { const x = 20 + (s + i * 7) % 160, y = 20 + (s + i * 13) % 160;   // plaine libre : niveau 0
      if (terrain(x, y, 1).kind === 'plain' && !(await pool.query('SELECT 1 FROM positions WHERE map_id=1 AND coord_x=$1 AND coord_y=$2', [x, y])).rowCount) T.xy = [x, y]; }
    await pool.query('UPDATE positions SET map_id=1, coord_x=$2, coord_y=$3 WHERE character_id=$1', [T.c, T.xy[0], T.xy[1]]);
    T.see = (await pool.query('SELECT see FROM characters WHERE id=$1', [T.c])).rows[0].see;
  });

  test('à pied sur la plaine : vision de base ; invocation montée taille 2 : +2', async () => {
    expect((await me()).see_eff).toBe(T.see);
    await ride('Ours', { locomotion: ['land'], size: 2 });
    const m = await me(); expect(m.see_eff).toBe(T.see + 2);
    expect(m.breakdown.see.parts).toContainEqual({ label: `Sur Ours${s} (taille 2)`, value: 2, kind: 'mount' });
  });
  test('capacité passive d’un sort de l’invocation montée : compte ; volante : +6 sans la taille ; aquatique : +taille', async () => {
    const sp = (await call('/admin/content/spells', { name: `Œil${s}`, shop: false, effects: { target: 'self', stats: [{ stat: 'see', value: 1 }] } }, T.adm)).j.id;
    const type = await ride('Lynx', { locomotion: ['land'], size: 1 });
    await call(`/admin/content/monsters/${type}/spells`, { spellId: sp, mode: 'passive' }, T.adm);
    expect((await me()).see_eff).toBe(T.see + 1 + 1);
    await ride('Roc', { locomotion: ['air'], size: 3 });
    const m = await me(); expect(m.see_eff).toBe(T.see + 6); expect(m.range_eff).toBe(m.range + 6);
    await ride('Pegase', { locomotion: ['land', 'air'], size: 3 });   // vole ET marche : +6, la taille ne s'ajoute pas
    expect((await me()).see_eff).toBe(T.see + 6);
    await ride('Phoque', { locomotion: ['water'], size: 2 });          // aquatique (posé sur la plaine) : +taille
    expect((await me()).see_eff).toBe(T.see + 2);
    await call('/summons/dismount', { characterId: T.c }, T.tk);
    await call(`/admin/content/spells/${sp}`, undefined, T.adm, 'DELETE');
  });
  test('coffre : taille de départ et capacité max réglées sur la capitale', async () => {
    const { rows: [b] } = await pool.query("SELECT id, data FROM buildings WHERE kind='capital' AND data->>'race'='human'");
    await pool.query("UPDATE buildings SET data = data || '{\"chestStart\":4,\"chestMax\":5}' WHERE id=$1", [b.id]);
    try {
      const c2 = (await call('/characters', { pseudo: `hw${s}`, race: 'human' }, T.tk)).j.id;
      expect((await pool.query('SELECT chest_size FROM characters WHERE id=$1', [c2])).rows[0].chest_size).toBe(4);
      const { rows: [cap] } = await pool.query("SELECT p.coord_x x, p.coord_y y FROM positions p WHERE p.building_id=$1", [b.id]);
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2]])
        if (!(await pool.query('SELECT 1 FROM positions WHERE map_id=1 AND coord_x=$1 AND coord_y=$2', [cap.x + dx, cap.y + dy])).rowCount) { await pool.query('UPDATE positions SET map_id=1, coord_x=$2, coord_y=$3 WHERE character_id=$1', [c2, cap.x + dx, cap.y + dy]); break; }
      await pool.query('UPDATE characters SET gold=10000 WHERE id=$1', [c2]);
      expect((await call('/chest/expand', { characterId: c2 }, T.tk)).status).toBe(200);
      const ko = await call('/chest/expand', { characterId: c2 }, T.tk); expect(ko.status).toBe(409); expect(ko.j.error).toMatch(/maximale \(5/);
      expect((await call(`/chest/${c2}`, undefined, T.tk)).j).toMatchObject({ size: 5, max: 5 });
    } finally { await pool.query('UPDATE buildings SET data=$2 WHERE id=$1', [b.id, b.data]); }
  });
  test('coûts d’amélioration réglés en admin : appliqués à l’onglet Amélioration ; liste fermée ; retrait', async () => {
    expect((await call('/admin/content/stat-costs/xp', { base_xp_cost: 1, numb_up: 1, multi_1: 1, multi_2: 1, multi_3: 1 }, T.adm, 'PUT')).status).toBe(400);
    expect((await call('/admin/content/stat-costs/range', { base_xp_cost: 7, numb_up: 2, multi_1: 1, multi_2: 2, multi_3: 3 }, T.adm, 'PUT')).status).toBe(200);
    expect((await call('/admin/content/stat-costs', undefined, T.adm)).j.rules).toContainEqual({ stat: 'range', base_xp_cost: 7, numb_up: 2, multis: [1, 2, 3] });   // ancien format converti
    expect((await call('/admin/content/stat-costs/range', { base_xp_cost: 7, numb_up: 2, multis: [1, 2, 3, 4, 6] }, T.adm, 'PUT')).status).toBe(200);   // paliers ajoutés
    expect((await call('/admin/content/stat-costs', undefined, T.adm)).j.rules).toContainEqual({ stat: 'range', base_xp_cost: 7, numb_up: 2, multis: [1, 2, 3, 4, 6] });
    expect((await call('/admin/content/stat-costs/range', { base_xp_cost: 7, numb_up: 2, multis: [] }, T.adm, 'PUT')).status).toBe(400);
    expect((await call(`/characters/${T.c}/upgrades`, undefined, T.tk)).j.find((u: any) => u.stat === 'range')).toMatchObject({ nextCost: 7 });
    await pool.query('UPDATE characters SET xp=100 WHERE id=$1', [T.c]);
    const r0 = (await me()).range;
    expect((await call(`/characters/${T.c}/upgrade/range`, undefined, T.tk, 'POST')).status).toBe(200);
    expect((await me()).range).toBe(r0 + 1);
    expect((await call('/admin/content/stat-costs/range', undefined, T.adm, 'DELETE')).status).toBe(200);
    expect((await call(`/characters/${T.c}/upgrade/range`, undefined, T.tk, 'POST')).status).toBe(400);
  });
  test('améliorer la vie / l’énergie max remplit aussi la réserve actuelle du même montant', async () => {
    await pool.query('UPDATE characters SET xp=100000, hp_current=hp_max-5, energy_current=energy_max-5 WHERE id=$1', [T.c]);
    const b = await me();
    for (const st of ['hp_max', 'energy_max']) expect((await call(`/characters/${T.c}/upgrade/${st}`, undefined, T.tk, 'POST')).status).toBe(200);
    const a = await me();
    expect([a.hp_max, a.hp_current, a.energy_max, a.energy_current]).toEqual([b.hp_max + 1, b.hp_current + 1, b.energy_max + 1, b.energy_current + 1]);
    expect((await call(`/characters/${T.c}/upgrade/strength`, undefined, T.tk, 'POST')).status).toBe(200);
    expect((await me()).hp_current).toBe(a.hp_current);
  });
});

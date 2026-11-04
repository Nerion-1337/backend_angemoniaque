import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Étape 2 phase 2 (bestiaire) : tables de butin, spawn à l'horloge (caps + case libre),
// tirage au combat (× drop_rate global, transfert divin propre), invocation sous coûts/caps.
describe.skipIf(!process.env.DATABASE_URL)('Bestiaire phase 2 (loot, spawns, invocation)', () => {
  let app: any; const s = Date.now(); const T: any = {};
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const mk = async (name: string, race: string, admin = false) => {
    const email = admin ? (process.env.ADMIN_EMAIL ?? 'admin@ange.local') : `${name}${s}@x.fr`;
    let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' });
    const c0 = await call('/characters', undefined, r.j.token);
    if (c0.j?.[0]) return { tk: r.j.token, id: c0.j[0].id, pseudo: c0.j[0].pseudo };
    const pseudo = `${name}${s}`.slice(0, 20);
    const c = await call('/characters', { pseudo, race }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j));
    return { tk: r.j.token, id: c.j.id, pseudo };
  };
  beforeAll(async () => { T.adm = await mk('bsadm', 'human', true); T.p = await mk('bspl', 'human'); });
  const NAME = `Lueur${s}`;
  const instances = async () => (await call('/admin/bestiary/status', undefined, T.adm.tk)).j.instances.filter((x: any) => x.name.startsWith(NAME));

  test('admin : prototype + loot (objet/ressource/divin) + spawn + coût/cap', async () => {
    const m = await call('/admin/content/monsters', { name: NAME, hp_max: 1, recovery: 0, see: 4, strength: 15, agility: 5, energy_max: 10, range: 1, armor: 0, gold_current: 15, data: { behavior: 'passif' } }, T.adm.tk);
    expect(m.status).toBe(200); T.m = m.j.id;
    const it = await call('/admin/content/items', { name: `Herbe${s}`, price: 1 }, T.adm.tk); expect(it.status).toBe(200); T.i = it.j.id;
    const st0 = await call('/admin/bestiary/status', undefined, T.adm.tk);
    T.divineTotal = st0.j.guardians.length;
    T.divineId = st0.j.guardians.find((g: any) => g.holder_character_id == null)?.id ?? null;
    expect((await call(`/admin/content/monsters/${T.m}/loot`, { itemId: T.i, dropRate: 100, qtyMin: 1, qtyMax: 2 }, T.adm.tk)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${T.m}/loot`, { resource: 'bois', dropRate: 100, qtyMin: 2, qtyMax: 2 }, T.adm.tk)).status).toBe(200);
    if (T.divineId) expect((await call(`/admin/content/monsters/${T.m}/loot`, { divineId: T.divineId, dropRate: 100 }, T.adm.tk)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${T.m}/loot`, { dropRate: 50 }, T.adm.tk)).status).toBe(400);        // rien de choisi
    const r = await call(`/admin/content/monsters/${T.m}/spawns`, { mapId: 1, xMin: 102, yMin: 102, xMax: 106, yMax: 106, maxInstances: 2, intervalH: 0, probability: 100 }, T.adm.tk);
    expect(r.status).toBe(200); T.rule = r.j.id;
    expect((await call(`/admin/content/monsters/${T.m}/costs`, { resource: 'or', qty: 500 }, T.adm.tk)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${T.m}/caps`, { scope: 'per_player', value: 1 }, T.adm.tk)).status).toBe(200);
    const loots = await call(`/admin/content/monsters/${T.m}/loot`, undefined, T.adm.tk);
    expect(loots.j.length).toBe(T.divineId ? 3 : 2);
    expect(loots.j.find((l: any) => l.item_id === T.i).item_name).toBe(`Herbe${s}`);
    expect((await call(`/admin/content/monsters/${T.m}/spawns`, undefined, T.adm.tk)).j.length).toBe(1);
    const del = await call(`/admin/content/monsters/${T.m}/loot/${loots.j[0].id}`, undefined, T.adm.tk, 'DELETE');
    expect(del.status).toBe(200);
    expect((await call(`/admin/content/monsters/${T.m}/loot`, undefined, T.adm.tk)).j.length).toBe(T.divineId ? 2 : 1);
    await call(`/admin/content/monsters/${T.m}/loot`, { itemId: T.i, dropRate: 100, qtyMin: 1, qtyMax: 2 }, T.adm.tk);   // l'entrée supprimée est replacée : le butin de mort (test 3) en a besoin
  });

  test('spawn horaire : case libre, cases distinctes, plafond max_instances', async () => {
    expect((await instances()).length).toBe(0);
    expect((await call('/admin/tick', {}, T.adm.tk)).status).toBe(200);
    expect((await instances()).length).toBe(1);
    await call('/admin/tick', {}, T.adm.tk);
    expect((await instances()).length).toBe(2);
    await call('/admin/tick', {}, T.adm.tk);
    expect((await instances()).length).toBe(2);   // plafond max_instances = 2 : plus rien ne spawn
    const inst = await instances();
    expect(new Set(inst.map((x: any) => `${x.x},${x.y}`)).size).toBe(2);   // unicité de case (uq_cell)
    inst.forEach((x: any) => { expect(x.spawned).toBe(true); expect(x.map_id).toBe(1); });
    T.inst1 = inst[0].id; T.inst1cell = [inst[0].x, inst[0].y];
  });

  test('mort du monstre : or + butin + transfert divin (sans duplication) + désespawn', async () => {
    const st0 = await call('/admin/bestiary/status', undefined, T.adm.tk);
    await call(`/admin/players/${T.p.id}/stat`, { stat: 'agility', delta: 90 }, T.adm.tk);   // toucher ~91 % : le kill est quasi déterministe
    await call(`/admin/players/${T.p.id}/stat`, { stat: 'range', delta: 10 }, T.adm.tk);    // portée ≥ trajet : jamais de déplacement (donc jamais de « chemin bloqué »)
    const cell = await call(`/admin/players/${T.p.id}/teleport`, { map: 1, x: T.inst1cell[0] + 1, y: T.inst1cell[1] }, T.adm.tk);
    expect(cell.status).toBe(200);
    let killed = false;
    for (let k = 0; k < 6 && !killed; k++) killed = (await call('/combat/attack', { characterId: T.p.id, targetMonsterId: T.inst1 }, T.p.tk)).j?.killed === true;
    expect(killed).toBe(true);
    const me = await call(`/characters/${T.p.id}`, undefined, T.p.tk);
    expect(me.j.gold).toBeGreaterThanOrEqual(165);                                    // 150 de départ + 15 de butin
    const inv = await call(`/inventory/${T.p.id}`, undefined, T.p.tk);
    expect(inv.j.items.find((i: any) => i.id === T.i)?.qty).toBeGreaterThanOrEqual(1);
    expect((inv.j.resources?.bois ?? 0)).toBe(2);
    const st1 = await call('/admin/bestiary/status', undefined, T.adm.tk);
    expect(st1.j.guardians.length).toBe(T.divineTotal);                              // aucune duplication d'objet divin
    if (T.divineId) {
      const d = st1.j.guardians.find((g: any) => g.id === T.divineId);
      expect(d.holder_character_id).toBe(T.p.id);                                    // transfert propre au vainqueur
    }
    expect((await instances()).length).toBe(1);                                      // l'instance sauvage a disparu (désespawn)
    expect((await call('/admin/tick', {}, T.adm.tk)).status).toBe(200);
    expect((await instances()).length).toBe(2);                                      // le tick re-spawn jusqu'au plafond
  });

  test('invocation : coûts (entity_costs) et caps (entity_caps per_player)', async () => {
    const p0 = (await call(`/characters/${T.p.id}`, undefined, T.p.tk)).j;
    expect((await call(`/monsters/${T.m}/summon`, { characterId: T.p.id }, T.p.tk)).status).toBe(409);   // 500 or exigés
    expect((await call(`/admin/players/${T.p.id}/stat`, { stat: 'gold', delta: 500 }, T.adm.tk)).status).toBe(200);
    const ok = await call(`/monsters/${T.m}/summon`, { characterId: T.p.id }, T.p.tk);
    expect(ok.status).toBe(200);
    expect((await call(`/characters/${T.p.id}`, undefined, T.p.tk)).j.gold).toBe(p0.gold);   // +500 accordés, -500 payés
    const list = await call(`/summons/${T.p.id}`, undefined, T.p.tk);
    const sm = list.j.find((x: any) => x.name === NAME);
    expect(sm).toBeTruthy(); expect(sm.x).toBeTypeOf('number');                      // placée sur une case libre
    expect((await call(`/monsters/${T.m}/summon`, { characterId: T.p.id }, T.p.tk)).status).toBe(409);   // cap per_player = 1
    expect((await call(`/summons/${sm.id}/dismiss`, { characterId: T.p.id }, T.p.tk)).status).toBe(200);
  });

  test('statut bestiaire + audit des mutations', async () => {
    const st = await call('/admin/bestiary/status', undefined, T.adm.tk);
    expect(st.j.instances.length).toBeGreaterThanOrEqual(2);
    expect(st.j.guardians.every((g: any) => ['relique', 'arcane', 'artefact'].includes(g.kind))).toBe(true);
    const a1 = (await call('/admin/audit?action=monster.loot', undefined, T.adm.tk)).j;
    expect(a1.some((a: any) => a.target_id === T.m)).toBe(true);
    const a2 = (await call('/admin/audit?action=monster.spawn', undefined, T.adm.tk)).j;
    expect(a2.some((a: any) => a.target_id === T.m)).toBe(true);
  });

  // Nettoyage fin de run (volume réutilisé) : sans ça, les spawn_rules actives (interval_h 0)
  // s'accumulent entre les runs et inondent les cartes de monstres sauvages à chaque tick.
  afterAll(async () => {
    const { pool } = await import('../../src/db/pool.js');
    await pool.query('DELETE FROM spawn_rules WHERE monster_id=$1', [T.m]);
    await pool.query('DELETE FROM positions WHERE monsters_id IN (SELECT id FROM monsters WHERE name LIKE $1)', [`${NAME}%`]);
    await pool.query('DELETE FROM character_monster WHERE monster_id IN (SELECT id FROM monsters WHERE name LIKE $1)', [`${NAME}%`]);
    await pool.query('DELETE FROM monsters WHERE name LIKE $1', [`${NAME}%`]);   // prototype + instances restantes (loot en cascade)
  });
});

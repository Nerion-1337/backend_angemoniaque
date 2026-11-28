import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Lot du 2026-11-28 (migration 48) : portes activées par objets divins, franchissement par la porte en face, choix de la porte
// d'arrivée, porte du Royaume des Morts, perte à la mort, zones de paix / sans construction, reconstruction des structures,
// pactes suspendus par les portes détruites, pactes des demi-dieux, bonus d'alliance.
// Les portes sont un état partagé par tous les tests : destructions et alliances se vérifient dans une transaction ANNULÉE.
describe.skipIf(!process.env.DATABASE_URL)('Portes, zones des structures, mort, demi-dieux', () => {
  let app: any, pool: any, terrain: any, G: any; const s = Date.now() % 1e7; const T: any = { buildings: [], divine: [] };
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const mk = async (n: string, race: string) => { const tk = await login(`${n}${s}@x.fr`), r = await call('/characters', { pseudo: `${n}${s}`, race }, tk); expect(r.status, JSON.stringify(r.j)).toBe(200); return { tk, id: r.j.id, pseudo: `${n}${s}` }; };
  const pos = async (id: number) => (await pool.query('SELECT coord_x x, coord_y y, map_id m FROM positions WHERE character_id=$1', [id])).rows[0];
  const empty = async (m: number, x: number, y: number) => !['shallow', 'deep', 'volcano'].includes(terrain(x, y, m).kind) && !(await pool.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x BETWEEN $2-2 AND $2+2 AND coord_y BETWEEN $3-2 AND $3+2', [m, x, y])).rowCount;
  const spot = async (m: number, seed: number) => { for (let i = 0; i < 400; i++) { const x = 20 + ((seed + i * 37) % 110), y = 20 + ((seed * 7 + i * 53) % 110); if (await empty(m, x, y)) return { x, y }; } throw new Error('aucune zone libre'); };
  const tp = (id: number, m: number, c: any) => pool.query('UPDATE positions SET map_id=$4, coord_x=$2, coord_y=$3 WHERE character_id=$1', [id, c.x, c.y, m]);
  const building = async (body: any, m: number, c: any) => {
    const r = await call('/admin/content/buildings', { name: `B${s}-${T.buildings.length}`, ...body }, T.adm); expect(r.status, JSON.stringify(r.j)).toBe(200); T.buildings.push(r.j.id);
    await pool.query('INSERT INTO positions(map_id,coord_x,coord_y,building_id) VALUES ($1,$2,$3,$4)', [m, c.x, c.y, r.j.id]); return r.j;
  };
  const give = async (charId: number, kind: string, n: number) => { for (let i = 0; i < n; i++) T.divine.push((await pool.query('INSERT INTO divine_items(kind,item_id,holder_character_id) VALUES ($1,(SELECT min(id) FROM items WHERE divine_family=$1),$2) RETURNING id', [kind, charId])).rows[0].id); };
  /** Exécute `fn` dans une transaction annulée à la fin (état des portes jamais visible des autres tests). */
  const rolledBack = async (fn: (db: any) => Promise<void>) => { const db = await pool.connect(); try { await db.query('BEGIN'); await fn(db); } finally { await db.query('ROLLBACK'); db.release(); } };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; terrain = (await import('../../src/game/terrain')).terrain; G = await import('../../src/game/gates');
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.dem = await mk('gd', 'demon'); T.hum = await mk('gh', 'human'); T.low = await mk('gl', 'human');
  });
  afterAll(async () => {
    await pool.query('DELETE FROM divine_items WHERE id = ANY($1)', [T.divine]);
    for (const id of T.buildings) { await pool.query('DELETE FROM positions WHERE building_id=$1', [id]); await pool.query('DELETE FROM buildings WHERE id=$1', [id]); }
  });

  test('porte activée par les objets divins de son monde ; on ne franchit pas sa propre porte ; arrivée au choix', async () => {
    const c2 = await spot(2, s), c1 = await spot(1, s + 11), c1b = await spot(1, s + 29);
    const X = await building({ kind: 'door', realm: 'demon', leads_to: 'human', open_h_per_item: 5 }, 2, c2);
    const H = await building({ kind: 'door', realm: 'human', leads_to: 'demon', data: { to: [2, c2.x + 3, c2.y] } }, 1, c1);
    await tp(T.dem.id, 2, { x: c2.x + 1, y: c2.y }); await give(T.dem.id, 'arcane', 2);
    const st = (await call(`/divine/door/${X.id}/${T.dem.id}`, undefined, T.dem.tk)).j;
    expect(st).toMatchObject({ realm: 'demon', family: 'arcane', can_activate: true, held: 2, hours_per_item: 5 });
    expect((await call(`/divine/door/${X.id}/activate`, { characterId: T.dem.id, count: 3 }, T.dem.tk)).status).toBe(403);   // 3 requis, 2 détenus
    const a = await call(`/divine/door/${X.id}/activate`, { characterId: T.dem.id, count: 2 }, T.dem.tk); expect(a.status, JSON.stringify(a.j)).toBe(200);
    expect(a.j.open_in_s).toBeGreaterThan(10 * 3600 - 60);   // 2 objets × 5 h
    expect((await pool.query('SELECT count(*)::int n FROM divine_items WHERE holder_character_id=$1', [T.dem.id])).rows[0].n).toBe(0);
    const no = await call('/divine/door', { characterId: T.dem.id, buildingId: X.id }, T.dem.tk); expect(no.status).toBe(409); expect(no.j.error).toMatch(/fermée/);
    // un Humain active sa porte vers les Démons : il la franchit (arrivée fixe) et le Démon franchit la sienne (arrivée près de H)
    await tp(T.hum.id, 1, { x: c1.x + 1, y: c1.y }); await give(T.hum.id, 'artefact', 1);
    expect((await call(`/divine/door/${H.id}/activate`, { characterId: T.dem.id, count: 1 }, T.dem.tk)).status).toBe(409);   // pas à côté
    expect((await call(`/divine/door/${H.id}/activate`, { characterId: T.hum.id, count: 1 }, T.hum.tk)).status).toBe(200);
    const d1 = await call('/divine/door', { characterId: T.dem.id, buildingId: X.id }, T.dem.tk); expect(d1.status, JSON.stringify(d1.j)).toBe(200);
    let p = await pos(T.dem.id); expect(p.m).toBe(1); expect(Math.max(Math.abs(p.x - c1.x), Math.abs(p.y - c1.y))).toBeLessThanOrEqual(2);
    const h1 = await call('/divine/door', { characterId: T.hum.id, buildingId: H.id }, T.hum.tk); expect(h1.status, JSON.stringify(h1.j)).toBe(200);
    p = await pos(T.hum.id); expect(p.m).toBe(2); expect(Math.max(Math.abs(p.x - (c2.x + 3)), Math.abs(p.y - c2.y))).toBeLessThanOrEqual(3);
    // deux portes des Hommes vers les Démons ouvertes : le Démon choisit où apparaître
    const H2 = await building({ kind: 'door', realm: 'human', leads_to: 'demon' }, 1, c1b); await pool.query("UPDATE buildings SET open_until=now()+interval '2 hours' WHERE id=$1", [H2.id]);
    await tp(T.dem.id, 2, { x: c2.x + 1, y: c2.y });
    const ch = await call('/divine/door', { characterId: T.dem.id, buildingId: X.id }, T.dem.tk); expect(ch.status).toBe(200); expect(ch.j.ok).toBe(false);
    expect(ch.j.choose.map((o: any) => o.id).sort()).toEqual([H.id, H2.id].sort()); expect((await pos(T.dem.id)).m).toBe(2);   // pas encore parti
    expect((await call('/divine/door', { characterId: T.dem.id, buildingId: X.id, toBuildingId: H2.id }, T.dem.tk)).status).toBe(200);
    p = await pos(T.dem.id); expect(p.m).toBe(1); expect(Math.max(Math.abs(p.x - c1b.x), Math.abs(p.y - c1b.y))).toBeLessThanOrEqual(2);
    for (const id of [X.id, H.id, H2.id]) await pool.query('UPDATE buildings SET open_until=NULL WHERE id=$1', [id]);
  });

  test('Royaume des Morts : 150 × 150, sa porte centrale ramène dans son monde ; la mort coûte 25 % de l’XP non dépensée et de l’or', async () => {
    expect((await pool.query('SELECT width, height FROM maps WHERE id=3')).rows[0]).toEqual({ width: 150, height: 150 });
    const door = (await pool.query("SELECT b.id, p.coord_x x, p.coord_y y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.kind='door' AND b.realm='dead'")).rows[0];
    expect(door).toMatchObject({ x: 75, y: 75 });
    await pool.query('UPDATE characters SET xp=1000, gold=401 WHERE id=$1', [T.low.id]);
    const row = (await pool.query('SELECT * FROM characters WHERE id=$1', [T.low.id])).rows[0];
    await (await import('../../src/game/divine')).die(pool, row, null);
    const after = (await pool.query('SELECT xp, gold FROM characters WHERE id=$1', [T.low.id])).rows[0]; expect(after).toEqual({ xp: 750, gold: 301 });
    const p = await pos(T.low.id); expect(p.m).toBe(3); expect(Math.max(Math.abs(p.x - 75), Math.abs(p.y - 75))).toBeLessThanOrEqual(30);
    await pool.query('UPDATE positions SET coord_x=76, coord_y=75 WHERE character_id=$1', [T.low.id]);
    expect((await call(`/divine/door/${door.id}/${T.low.id}`, undefined, T.low.tk)).j).toMatchObject({ realm: 'dead', can_cross: true, can_activate: false });
    const r = await call('/divine/door', { characterId: T.low.id, buildingId: door.id }, T.low.tk); expect(r.status, JSON.stringify(r.j)).toBe(200);
    const z = (await pool.query("SELECT spawn_map_id m FROM races WHERE key='human'")).rows[0]; expect((await pos(T.low.id)).m).toBe(z?.m ?? 1);
  });

  test('zone de paix : aucune attaque dedans (monstres compris), la structure reste attaquable de l’extérieur ; zone sans construction', async () => {
    const c = await spot(3, s + 5), P = await building({ kind: 'tower', structure: 50, peace_radius: 2, nobuild_radius: 4 }, 3, c);
    const m = await call('/admin/content/monsters', { name: `Paix${s}`, hp_max: 500 }, T.adm); expect(m.status).toBe(200);
    expect((await call('/admin/bestiary/place', { monsterId: m.j.id, mapId: 3, x: c.x + 2, y: c.y }, T.adm)).status).toBe(200);
    await tp(T.hum.id, 3, { x: c.x + 3, y: c.y });
    const inst = (await pool.query('SELECT monsters_id id FROM positions WHERE map_id=3 AND coord_x=$1 AND coord_y=$2 AND monsters_id IS NOT NULL', [c.x + 2, c.y])).rows[0].id;
    const no = await call('/combat/attack', { characterId: T.hum.id, targetMonsterId: inst }, T.hum.tk); expect(no.status).toBe(403); expect(no.j.error).toMatch(/Zone de paix/);
    await tp(T.hum.id, 3, { x: c.x + 1, y: c.y });   // dans la zone : la tour elle-même n'est pas attaquable d'ici
    expect((await call('/combat/attack', { characterId: T.hum.id, targetBuildingId: P.id }, T.hum.tk)).status).toBe(403);
    expect(await G.zoneAt(pool, 'peace_radius', 3, c.x + 3, c.y, 0)).toBeNull();
    expect(await G.zoneAt(pool, 'peace_radius', 3, c.x, c.y, P.id)).toBeNull();   // la case de la tour, vue comme cible : hors de sa propre zone
    expect((await G.zoneAt(pool, 'nobuild_radius', 3, c.x + 4, c.y))).toBe(P.name); expect(await G.zoneAt(pool, 'nobuild_radius', 3, c.x + 5, c.y)).toBeNull();
    await expect(G.checkBuildable(pool, 3, c.x - 4, c.y + 4)).rejects.toThrow(/Construction interdite/);
    await pool.query("DELETE FROM positions WHERE monsters_id=$1", [inst]); await pool.query("DELETE FROM monsters WHERE id=$1 OR data->>'prototype'=$1::text", [m.j.id]);
  });

  test('structure détruite puis reconstruite (délai, conditions) sur sa case', async () => {
    const c = await spot(3, s + 9), B = await building({ kind: 'wall', structure: 1, respawn: true, respawn_delay_h: 0, respawn_limits: [{ kind: 'resource', ref: `rien${s}`, max: 1 }] }, 3, c);
    await tp(T.hum.id, 3, { x: c.x + 1, y: c.y }); await pool.query('UPDATE characters SET energy_current=energy_max, agility=999 WHERE id=$1', [T.hum.id]);
    let r: any; for (let i = 0; i < 6; i++) { r = await call('/combat/attack', { characterId: T.hum.id, targetBuildingId: B.id }, T.hum.tk); if (r.j?.killed) break; }
    expect(r.status, JSON.stringify(r.j)).toBe(200); expect(r.j.killed).toBe(true);
    const row = (await pool.query('SELECT destroyed_at, home FROM buildings WHERE id=$1', [B.id])).rows[0]; expect(row.destroyed_at).not.toBeNull(); expect(row.home).toEqual({ map: 3, x: c.x, y: c.y });
    await tp(T.hum.id, 3, { x: c.x + 4, y: c.y });
    const respawn = (await import('../../src/game/spawn')).respawnStructures;
    await pool.query("UPDATE characters SET resources=jsonb_set(COALESCE(resources,'{}'), ARRAY[$2::text], '5') WHERE id=$1", [T.hum.id, `rien${s}`]);
    await respawn(pool); expect((await pool.query('SELECT 1 FROM positions WHERE building_id=$1', [B.id])).rowCount).toBe(0);   // condition : bloquée
    await pool.query('UPDATE characters SET resources=resources - $2::text WHERE id=$1', [T.hum.id, `rien${s}`]);
    await respawn(pool); expect((await pool.query('SELECT map_id m, coord_x x, coord_y y FROM positions WHERE building_id=$1', [B.id])).rows[0]).toEqual({ m: 3, x: c.x, y: c.y });
    expect((await pool.query('SELECT destroyed_at FROM buildings WHERE id=$1', [B.id])).rows[0].destroyed_at).toBeNull();
  });

  test('pactes suspendus quand les portes de leur camp sont détruites ; demi-dieux seulement quand les 4 portes des Hommes le sont', async () => {
    await rolledBack(async db => {
      await db.query("DELETE FROM positions WHERE building_id IN (SELECT id FROM buildings WHERE kind='door' AND realm='demon')");
      await expect(G.checkPactRealm(db, 'demon')).rejects.toThrow(/démoniaques suspendus/);
      await G.checkPactRealm(db, 'angel');
      await expect(G.checkPactRealm(db, 'human')).rejects.toThrow(/demi-dieux suspendus/);
      await db.query("DELETE FROM positions WHERE building_id IN (SELECT id FROM buildings WHERE kind='door' AND realm='human')");
      await G.checkPactRealm(db, 'human');
      await expect(G.checkPactRealm(db, 'angel')).rejects.toThrow(/angéliques suspendus/);   // plus aucune porte des Hommes vers les Anges
    });
    await rolledBack(async db => {   // une seule des deux portes des Hommes vers les Démons détruite : pactes maintenus
      await db.query("DELETE FROM positions WHERE building_id=(SELECT id FROM buildings WHERE kind='door' AND realm='human' AND leads_to='demon' ORDER BY id LIMIT 1)");
      await G.checkPactRealm(db, 'demon');
    });
  });

  test('demi-dieu : propose un pacte à un Humain de rang inférieur, avec ses compositions ; activation suspendue tant que les portes tiennent', async () => {
    const dd = (await pool.query("SELECT id FROM specializations WHERE race='human' AND pact_patron ORDER BY current_rank LIMIT 1")).rows[0].id;
    await pool.query('UPDATE characters SET specialization_id=$2 WHERE id=$1', [T.hum.id, dd]);
    expect((await call('/pacts/request', { characterId: T.dem.id, targetPseudo: T.dem.pseudo }, T.dem.tk)).status).toBe(400);
    const r = await call('/pacts/request', { characterId: T.hum.id, targetPseudo: T.low.pseudo }, T.hum.tk); expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect((await call('/pacts/request', { characterId: T.low.id, targetPseudo: T.hum.pseudo }, T.low.tk)).status).toBe(409);   // déjà demandé
    expect((await call(`/pacts/${r.j.id}/answer`, { characterId: T.low.id, accept: true }, T.low.tk)).status).toBe(200);
    const view = (await call(`/pacts/${T.hum.id}`, undefined, T.hum.tk)).j;
    expect(view.patron).toBe(true); expect(view.tiers.length).toBeGreaterThan(0);
    expect((await pool.query('SELECT DISTINCT realm FROM pact_tiers WHERE id = ANY($1)', [view.tiers.map((t: any) => t.id)])).rows).toEqual([{ realm: 'demigod' }]);
    expect(view.active[0]).toMatchObject({ i_propose: true, realm: 'demigod' }); expect(view.active[0].suspended).toMatch(/portes du monde des Hommes/);
    const a = await call(`/pacts/${r.j.id}/activate`, { characterId: T.low.id }, T.low.tk); expect(a.status).toBe(409); expect(a.j.error).toMatch(/demi-dieux suspendus/);
    await pool.query('DELETE FROM pacts WHERE id=$1', [r.j.id]);
  });

  test('alliance : porte d’un camp ET porte des Hommes vers lui ouvertes → bonus aux joueurs du camp et aux Humains en pacte avec eux', async () => {
    await rolledBack(async db => {
      await db.query("UPDATE buildings SET open_until=now()+interval '3 hours' WHERE kind='door' AND name IN ('Brèche de Soufre', 'Porte des Dunes')");
      const p = (await db.query("INSERT INTO pacts(human_id,ethereal_id,requested_by,active,status) VALUES ($1,$2,$2,true,'active') RETURNING id", [T.low.id, T.dem.id])).rows[0].id;
      const before = (await db.query('SELECT id, strength FROM characters WHERE id = ANY($1) ORDER BY id', [[T.dem.id, T.low.id, T.hum.id]])).rows;
      await G.syncGates(db, { demon: { strength: 3 }, angel: {} });
      const after = (await db.query('SELECT id, strength FROM characters WHERE id = ANY($1) ORDER BY id', [[T.dem.id, T.low.id, T.hum.id]])).rows;
      const delta = Object.fromEntries(after.map((r: any, i: number) => [r.id, r.strength - before[i].strength]));
      expect(delta).toEqual({ [T.dem.id]: 3, [T.low.id]: 3, [T.hum.id]: 0 });
      const b = (await db.query("SELECT expires_at FROM temp_buffs WHERE source='gate:demon' AND character_id=$1", [T.dem.id])).rows[0];
      expect(new Date(b.expires_at).getTime()).toBeGreaterThan(Date.now() + 2.9 * 3600e3);
      await db.query("UPDATE buildings SET open_until=NULL WHERE kind='door' AND name='Porte des Dunes'");
      await G.syncGates(db, { demon: { strength: 3 }, angel: {} });   // un côté fermé : bonus retiré
      expect((await db.query('SELECT strength FROM characters WHERE id=$1', [T.dem.id])).rows[0].strength).toBe(before.find((r: any) => r.id === T.dem.id).strength);
      expect(p).toBeGreaterThan(0);
    });
  });
});

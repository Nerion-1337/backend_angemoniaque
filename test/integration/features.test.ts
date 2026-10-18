import { describe, test, expect, beforeAll } from 'vitest';
describe.skipIf(!process.env.DATABASE_URL)('Fonctionnalités du dépôt', () => {
  let app: any, pool: any; const s = Date.now(); const T: any = {};
  beforeAll(async () => { app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; });
  const call = async (path: string, body?: any, tk?: string, method?: string) => { const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const mk = async (n: string, race: string) => { const e = `${n}${s}@x.fr`, r = await call('/auth/register', { email: e, password: 'password1' }); const c = await call('/characters', { pseudo: `${n}${s}`.slice(0, 20), race }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j)); return { tk: r.j.token, id: c.j.id, pseudo: `${n}${s}`.slice(0, 20) }; };
  beforeAll(async () => { T.a = await mk('fa', 'human'); T.b = await mk('fb', 'angel'); });
  test('kit de départ + stats d\'équipement (armure, dégâts = arme × (Force − requis))', async () => {
    const me = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j; expect(me.gold).toBe(150); expect(me.stats.damage).toBe(1);
    const inv = (await call(`/inventory/${T.a.id}`, undefined, T.a.tk)).j; const id = (n: string) => inv.items.find((i: any) => i.name === n).id;
    for (const [n, slot] of [['Épée Sanctifiée', 'weapon_main'], ['Écu de la Garde', 'weapon_off'], ['Casque de Fer Forgé', 'head'], ['Plastron du Lion', 'chest']]) expect((await call('/inventory/equip', { characterId: T.a.id, itemId: id(n), slot }, T.a.tk)).status).toBe(200);
    const st = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j.stats; expect(st.armor).toBe(20); expect(st.reqStrength).toBe(6); expect(st.damage).toBe(3 * (5 - 6 < 0 ? 0 : 5 - 6) || 1);
  });
  test('sorts : invocation, limite, prise de contrôle, retour au héros', async () => {
    expect((await call(`/spells/${T.a.id}`, undefined, T.a.tk)).j.spells).toHaveLength(0);                                    // aucun sort appris au départ : catégorie vide
    await pool.query('INSERT INTO character_spells(character_id,spell_id) SELECT $1,id FROM spells', [T.a.id]);                // (apprentissage à la capitale simulé)
    const me = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j, sp = (await call(`/spells/${T.a.id}`, undefined, T.a.tk)).j; expect(sp.spells).toHaveLength(4);
    const golem = sp.spells.find((x: any) => x.kind === 'summon'), cast = (x: number, y: number) => call('/spells/cast', { characterId: T.a.id, spellId: golem.id, x, y }, T.a.tk);
    let r = { status: 0 }; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) { r = await cast(me.pos.x + dx, me.pos.y + dy); if (r.status === 200) break; } expect(r.status).toBe(200);
    expect((await cast(me.pos.x, me.pos.y)).status).toBe(409);                                    // case adjacente obligatoire / limite d'invocations
    const sm = (await call(`/summons/${T.a.id}`, undefined, T.a.tk)).j[0]; expect(sm.name).toContain('Golem');
    expect((await call('/summons/control', { characterId: T.a.id, summonId: sm.id }, T.a.tk)).status).toBe(200);
    const c = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j; expect(c.actor.kind).toBe('summon'); expect(c.actor.pos.x).toBe(sm.x);
    expect((await call('/summons/control', { characterId: T.a.id, summonId: null }, T.a.tk)).status).toBe(200); expect((await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j.actor.kind).toBe('hero');
  });
  test('monture : énergie séparée (seuls les déplacements paient la monture)', async () => {
    const m = (await call(`/mounts/${T.a.id}`, undefined, T.a.tk)).j; expect(m[0].name).toContain('Destrier'); expect(m[0].recovery).toBe(10);
    expect((await call('/mounts/summon', { characterId: T.a.id, mountId: m[0].id }, T.a.tk)).status).toBe(200);
    let me = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j; expect(me.actor.energy_max).toBe(me.energy_max); expect(me.mount.energy_max).toBe(90); expect(me.see_eff).toBe(me.see + 1);
    const e0 = me.energy_current, m0 = me.mount.energy_current; let moved = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) { if ((await call('/actions/move', { characterId: T.a.id, x: me.pos.x + dx, y: me.pos.y + dy }, T.a.tk)).status === 200) { moved = true; break; } }
    me = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j; if (moved) { expect(me.mount.energy_current).toBeLessThan(m0); expect(me.energy_current).toBe(e0); }
    expect((await call('/actions/gather', { characterId: T.a.id }, T.a.tk)).status).toBe(200);                                 // l'action utilise l'énergie du personnage
    me = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j; expect(me.energy_current).toBe(e0 - 4);
  });
  test('parchemins : aucun au départ ; le parchemin de navire donne une monture aquatique', async () => {
    expect((await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j.scrolls).toEqual({});
    expect((await call('/buildings/place', { characterId: T.a.id, kind: 'ship' }, T.a.tk)).status).toBe(403);
    await pool.query("INSERT INTO character_items(character_id,item_id) SELECT $1,id FROM items WHERE name='Parchemin de navire'", [T.a.id]);
    expect((await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j.scrolls.ship).toBe(1);
    expect((await call('/buildings/place', { characterId: T.a.id, kind: 'ship' }, T.a.tk)).status).toBe(200);
    expect((await call(`/mounts/${T.a.id}`, undefined, T.a.tk)).j.some((x: any) => x.name === 'Navire' && x.aquatic)).toBe(true);
  });
  test('confidentialité : état de forme sans PV exacts', async () => {
    const pa = (await call(`/characters/${T.a.id}`, undefined, T.a.tk)).j.pos; const cell = (await call(`/map/${pa.map_id}/cell?x=${pa.x}&y=${pa.y}&details=1`, undefined, T.b.tk)).j.entity;
    expect(cell.health).toBe('En pleine forme'); expect(cell.hp_current).toBeUndefined(); expect(cell.chp).toBeUndefined(); expect(cell.visibleGear).toBeDefined();
  });
  test('guilde : rangs, droits, postulants, forum filtré par rang', async () => {
    const g = await call('/guilds', { characterId: T.a.id, name: `Aube${s}`, tag: 'AUBE' }, T.a.tk); expect(g.status).toBe(200);
    expect((await call('/guilds/apply', { characterId: T.b.id, name: `Aube${s}` }, T.b.tk)).status).toBe(200);
    let st = (await call(`/guilds/${T.a.id}`, undefined, T.a.tk)).j; expect(st.me.leader).toBe(true); expect(st.applicants).toHaveLength(1); expect(st.ranks.map((r: any) => r.name)).toEqual(['Chef', 'Officier', 'Membre']);
    expect((await call(`/guilds/applicants/${st.applicants[0].id}/answer`, { characterId: T.a.id, accept: true }, T.a.tk)).status).toBe(200);
    expect((await call('/guilds/folders', { characterId: T.a.id, name: 'Secret', visibleRanks: ['Chef'] }, T.a.tk)).status).toBe(200);
    expect((await call('/guilds/folders', { characterId: T.a.id, name: 'Public', visibleRanks: ['Chef', 'Membre'] }, T.a.tk)).status).toBe(200);
    const vb = (await call(`/guilds/${T.b.id}`, undefined, T.b.tk)).j; expect(vb.me.rank).toBe('Membre'); expect(vb.folders.map((f: any) => f.name)).toEqual(['Public']); expect(vb.applicants).toEqual([]);
    expect((await call('/guilds/invite', { characterId: T.b.id, pseudo: 'x' }, T.b.tk)).status).toBe(403);                 // droit manquant
    expect((await call('/guilds/presentation', { characterId: T.b.id, mantra: 'non' }, T.b.tk)).status).toBe(403);           // réservé au Chef
    expect((await call('/guilds/presentation', { characterId: T.a.id, mantra: 'x'.repeat(121) }, T.a.tk)).status).toBe(400);  // 120 caractères max
    expect((await call('/guilds/presentation', { characterId: T.a.id, mantra: 'Pour l’aube', description: 'mot '.repeat(1001) }, T.a.tk)).status).toBe(400);
    expect((await call('/guilds/ranks', { characterId: T.a.id, name: 'Sénéchal', permissions: { send_invites: true } }, T.a.tk)).status).toBe(200);
  });
  test('boutique : réserve de la faction + mail avec objet', async () => {
    const shop = (await call('/shop', undefined, T.a.tk)).j; expect(shop.items[0].stock).toBeGreaterThan(0); expect(shop.spells).toHaveLength(4);
    expect((await call('/messages', { characterId: T.a.id, channel: 'mail', to: T.b.pseudo, subject: 'Salut', body: 'Hello' }, T.a.tk)).status).toBe(200);
    expect((await call(`/messages/${T.b.id}/mail`, undefined, T.b.tk)).j[0].subject).toBe('Salut');
  });
  test('améliorations par paliers', async () => { const u = (await call(`/characters/${T.a.id}/upgrades`, undefined, T.a.tk)).j; const f = u.find((x: any) => x.stat === 'strength'); expect(f.nextCost).toBe(50); expect(f.tier).toBe(1); });
});

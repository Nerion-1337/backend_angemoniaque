import { describe, test, expect, beforeAll } from 'vitest';
// Lot D : invocations par sort (permanentes / temporaires) et sorts d'objets déclenchés au coup porté / à l'attaque reçue.
describe.skipIf(!process.env.DATABASE_URL)('Invocations et sorts déclenchés par les objets', () => {
  let app: any, pool: any, expireSummons: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const spell = async (name: string, effects: any) => { const r = await call('/admin/content/spells', { name: `${name}${s}`, energyCost: 1, shop: false, effects }, T.adm); expect(r.status, JSON.stringify(r.j)).toBe(200); return r.j.id; };
  const learnCast = async (id: number) => { await call(`/admin/players/${T.c}/grant`, { kind: 'spell', refId: id }, T.adm); return call('/spells/cast', { characterId: T.c, spellId: id }, T.tk); };
  const expire = async () => { await pool.query("UPDATE spell_summons SET until=now()-interval '1 minute' WHERE caster_id=$1", [T.c]); await expireSummons(pool); };
  const player = async (tag: string) => { const tk = await login(`${tag}${s}@x.fr`); const id = (await call('/characters', { pseudo: `${tag}${s}`, race: 'human' }, tk)).j.id;
    await pool.query("UPDATE characters SET energy_current=500, energy_max=500, agility=900 WHERE id=$1", [id]); return { tk, id }; };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; expireSummons = (await import('../../src/game/spellSummon')).expireSummons;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    ({ tk: T.tk, id: T.c } = await player('sa'));
    T.item = (await call('/admin/content/items', { name: `Gemme${s}`, slot: 'special' }, T.adm)).j.id;
    T.bld = (await call('/admin/content/buildings', { name: `Autel${s}`, kind: 'totem', structure: 10 }, T.adm)).j.id;
    T.mon = (await call('/admin/content/monsters', { name: `Feu${s}`, hp_max: 30, hp_current: 30, strength: 5, agility: 1 }, T.adm)).j.id;
    T.steed = (await call('/admin/content/monsters', { name: `Coursier${s}`, hp_max: 50, energy_max: 40, mountable: true }, T.adm)).j.id;
  });

  test('admin : élément à invoquer inconnu ou monture non montable → 404', async () => {
    expect((await call('/admin/content/spells', { name: `X${s}`, effects: { summon: { kind: 'item', refId: 999999 } } }, T.adm)).status).toBe(404);
    expect((await call('/admin/content/spells', { name: `Y${s}`, effects: { summon: { kind: 'mount', refId: T.mon } } }, T.adm)).status).toBe(404);
  });

  test('objet temporaire ×2 : dans le sac, puis retiré à l\'échéance', async () => {
    const r = await learnCast(await spell('Don', { target: 'self', summon: { kind: 'item', refId: T.item, qty: 2, durationH: 1 } }));
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const n = async () => (await pool.query('SELECT COALESCE(sum(qty),0)::int n FROM character_items WHERE character_id=$1 AND item_id=$2', [T.c, T.item])).rows[0].n;
    expect(await n()).toBe(2); await expire(); expect(await n()).toBe(0);
  });

  test('monstre temporaire, monture et bâtiment permanents', async () => {
    expect((await learnCast(await spell('Appel', { target: 'self', summon: { kind: 'monster', refId: T.mon, durationH: 2 } }))).status).toBe(200);
    const sm = (await pool.query('SELECT s.id, p.id pos FROM summons s JOIN positions p ON p.summon_id=s.id WHERE s.owner_id=$1 AND s.name=$2', [T.c, `Feu${s}`])).rows;
    expect(sm).toHaveLength(1);
    expect((await learnCast(await spell('Monte', { target: 'self', summon: { kind: 'mount', refId: T.steed } }))).status).toBe(200);
    expect((await pool.query('SELECT 1 FROM character_mounts cm JOIN mounts mo ON mo.id=cm.mount_id WHERE cm.character_id=$1 AND mo.monster_id=$2', [T.c, T.steed])).rowCount).toBe(1);
    expect((await learnCast(await spell('Bâtir', { target: 'self', summon: { kind: 'building', refId: T.bld } }))).status).toBe(200);
    expect((await pool.query('SELECT 1 FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.owner_id=$1 AND b.name=$2', [T.c, `Autel${s}`])).rowCount).toBe(1);
    await expire();
    expect((await pool.query('SELECT 1 FROM summons WHERE id=$1', [sm[0].id])).rowCount).toBe(0);   // monstre temporaire parti
    expect((await pool.query('SELECT 1 FROM buildings WHERE owner_id=$1', [T.c])).rowCount).toBe(1);  // bâtiment permanent resté
  });

  test('liens : au coup porté réservé aux objets ; liste depuis la fiche de l\'objet', async () => {
    T.burn = await spell('Brûlure', { target: 'single', dot: { damage: 3, hours: 2 } });
    expect((await call(`/admin/content/spells/${T.burn}/links`, { kind: 'building', refId: T.bld, mode: 'on_hit' }, T.adm)).status).toBe(400);
    T.blade = (await call('/admin/content/items', { name: `Lame${s}`, slot: 'weapon', weapon_damage: 1 }, T.adm)).j.id;
    expect((await call(`/admin/content/spells/${T.burn}/links`, { kind: 'item', refId: T.blade, mode: 'on_hit' }, T.adm)).status).toBe(200);
    T.mail = (await call('/admin/content/items', { name: `Cotte${s}`, slot: 'chest', armor: 1 }, T.adm)).j.id;
    expect((await call(`/admin/content/spells/${T.burn}/links`, { kind: 'item', refId: T.mail, mode: 'on_struck' }, T.adm)).status).toBe(200);
    const l = (await call(`/admin/content/element-spells?kind=item&refId=${T.blade}`, undefined, T.adm)).j;
    expect(l).toMatchObject([{ spell_id: T.burn, mode: 'on_hit', spell_name: `Brûlure${s}` }]);
  });

  test('combat : l\'arme applique son sort au coup porté, l\'armure du défenseur à l\'attaque reçue', async () => {
    const B = await player('sb');
    let placed = false;
    for (let k = 0; k < 40 && !placed; k++) {
      const x = 40 + ((s + k * 13) % 120), y = 60 + ((s + k * 7) % 100);
      const a = await call(`/admin/players/${T.c}/teleport`, { map: 3, x, y }, T.adm), b = await call(`/admin/players/${B.id}/teleport`, { map: 3, x: x + 1, y }, T.adm);
      const { rows: [pa] } = await pool.query('SELECT coord_x x, coord_y y FROM positions WHERE character_id=$1', [T.c]), { rows: [pb] } = await pool.query('SELECT coord_x x, coord_y y FROM positions WHERE character_id=$1', [B.id]);
      placed = a.status === 200 && b.status === 200 && Math.max(Math.abs(pa.x - pb.x), Math.abs(pa.y - pb.y)) === 1;
    }
    expect(placed).toBe(true);
    await pool.query('INSERT INTO character_items(character_id,item_id,equipped_slot) VALUES ($1,$2,$3), ($4,$5,$6)', [T.c, T.blade, 'weapon_main', B.id, T.mail, 'chest']);
    await pool.query('UPDATE characters SET agility=1 WHERE id=$1', [B.id]);
    let hit = false;
    for (let i = 0; i < 15 && !hit; i++) { const r = await call('/combat/attack', { characterId: T.c, targetCharacterId: B.id }, T.tk); expect(r.status, JSON.stringify(r.j)).toBe(200); hit = !r.j.missed; }
    expect(hit).toBe(true);
    const dot = async (id: number) => (await pool.query("SELECT 1 FROM spell_dots WHERE target_kind='character' AND target_id=$1 AND spell_id=$2", [id, T.burn])).rowCount;
    expect(await dot(B.id)).toBeGreaterThan(0);   // arme de l'attaquant → défenseur
    expect(await dot(T.c)).toBeGreaterThan(0);    // armure du défenseur → attaquant
  });
});

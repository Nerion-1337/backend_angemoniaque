import { describe, test, expect, beforeAll } from 'vitest';
// Montures possédées : montée (déplacements et capacités payés par la monture) ou invoquée à pied (créature contrôlable) ; équipement.
describe.skipIf(!process.env.DATABASE_URL)('Monter ou invoquer sa monture', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' }); return r.j.token; };
  const cm = async () => (await pool.query('SELECT * FROM character_mounts WHERE id=$1', [T.cm])).rows[0];
  const hero = async () => (await pool.query('SELECT energy_current FROM characters WHERE id=$1', [T.c])).rows[0].energy_current;
  const mine = async () => (await call(`/mounts/${T.c}`, undefined, T.tk)).j.find((x: any) => x.cm_id === T.cm);
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`mc${s}@x.fr`); T.c = (await call('/characters', { pseudo: `mc${s}`, race: 'human' }, T.tk)).j.id;
    await call(`/admin/players/${T.c}/teleport`, { map: 3, x: 50 + (s % 90), y: 60 + (s % 70) }, T.adm);
    T.type = (await call('/admin/content/monsters', { name: `Wyverne${s}`, hp_max: 80, energy_max: 60, armor: 2, strength: 9, agility: 4, mountable: true, locomotion: ['land', 'air'] }, T.adm)).j.id;
    await call(`/admin/content/monsters/${T.type}/slots`, { slot: 'head' }, T.adm);
    T.sp = (await call('/admin/content/spells', { name: `Rugissement${s}`, energyCost: 5, shop: false, effects: { target: 'self', heal: 1 } }, T.adm)).j.id;
    await call(`/admin/content/monsters/${T.type}/spells`, { spellId: T.sp, mode: 'active' }, T.adm);
    const mountId = (await pool.query('SELECT id FROM mounts WHERE monster_id=$1', [T.type])).rows[0].id;
    expect((await call(`/admin/players/${T.c}/grant`, { kind: 'mount', refId: mountId }, T.adm)).status).toBe(200);
    T.cm = (await pool.query('SELECT id FROM character_mounts WHERE character_id=$1 AND mount_id=$2', [T.c, mountId])).rows[0].id;
    T.helm = (await call('/admin/content/items', { name: `Chanfrein${s}`, slot: 'head', armor: 3 }, T.adm)).j.id;
    await pool.query('UPDATE characters SET energy_current=100, energy_max=100 WHERE id=$1', [T.c]);
  });

  test('fiche : montable, partie équipable, capacité ; équiper (sac → monture), partie interdite 400', async () => {
    expect(await mine()).toMatchObject({ can_ride: true, slots: ['head'], capacities: [{ id: T.sp }], summon_id: null });
    await call(`/admin/players/${T.c}/grant`, { kind: 'item', refId: T.helm }, T.adm);
    expect((await call('/mounts/equip', { characterId: T.c, cmId: T.cm, itemId: T.helm, slot: 'foot' }, T.tk)).status).toBe(400);
    expect((await call('/mounts/equip', { characterId: T.c, cmId: T.cm, itemId: T.helm, slot: 'head' }, T.tk)).status).toBe(200);
    expect((await pool.query('SELECT 1 FROM character_items WHERE character_id=$1 AND item_id=$2', [T.c, T.helm])).rowCount).toBe(0);
    expect((await mine()).stats.armor).toBe(5);
  });

  test('montée : capacité et déplacement payés par la monture, pas par le joueur ; invoquer à pied refusé', async () => {
    expect((await call('/mounts/summon', { characterId: T.c, cmId: T.cm }, T.tk)).status).toBe(200);
    expect((await call('/mounts/call', { characterId: T.c, cmId: T.cm }, T.tk)).status).toBe(409);
    const e0 = (await cm()).energy_current, h0 = await hero();
    const r = await call('/spells/cast', { characterId: T.c, spellId: T.sp }, T.tk); expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect((await cm()).energy_current).toBe(e0 - 5); expect(await hero()).toBe(h0);
    const { rows: [p] } = await pool.query('SELECT coord_x x, coord_y y FROM positions WHERE character_id=$1', [T.c]);
    let moved = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) { if ((await call('/actions/move', { characterId: T.c, x: p.x + dx, y: p.y + dy }, T.tk)).status === 200) { moved = true; break; } }
    expect(moved).toBe(true);
    expect((await cm()).energy_current).toBeLessThan(e0 - 5); expect(await hero()).toBe(h0);
    expect((await call('/mounts/dismount', { characterId: T.c }, T.tk)).status).toBe(200);
  });

  test('à pied : créature contrôlable (équipement compris), capacité payée par elle, PV / énergie rendus au renvoi', async () => {
    const r = await call('/mounts/call', { characterId: T.c, cmId: T.cm }, T.tk); expect(r.status, JSON.stringify(r.j)).toBe(200);
    const sm = (await pool.query('SELECT * FROM summons WHERE id=$1', [r.j.summonId])).rows[0];
    expect(sm).toMatchObject({ char_mount_id: T.cm, monster_id: T.type, armor: 5 });
    expect((await call('/mounts/equip', { characterId: T.c, cmId: T.cm, itemId: T.helm, slot: 'head' }, T.tk)).status).toBe(409);
    await pool.query('UPDATE positions SET coord_x=coord_x+6 WHERE summon_id=$1', [sm.id]);   // trop loin pour monter dessus
    const far = await call('/mounts/summon', { characterId: T.c, cmId: T.cm }, T.tk); expect(far.status).toBe(409); expect(far.j.error).toMatch(/approchez-vous/);
    await pool.query('UPDATE positions SET coord_x=coord_x-6 WHERE summon_id=$1', [sm.id]);
    await call('/summons/control', { characterId: T.c, summonId: sm.id }, T.tk);
    const h0 = await hero();
    expect((await call('/spells/cast', { characterId: T.c, spellId: T.sp }, T.tk)).status).toBe(200);
    const after = (await pool.query('SELECT energy_current FROM summons WHERE id=$1', [sm.id])).rows[0].energy_current;
    expect(after).toBe(sm.energy_current - 5); expect(await hero()).toBe(h0);
    await call('/summons/control', { characterId: T.c, summonId: null }, T.tk);
    expect((await call(`/summons/${sm.id}/dismiss`, { characterId: T.c }, T.tk)).status).toBe(200);
    expect((await cm()).energy_current).toBe(after);
  });

  test('type qui ne sert plus de monture : monter refusé, invoquer à pied possible ; retrait de l\'équipement vers le sac', async () => {
    await call(`/admin/content/monsters/${T.type}`, { mountable: false }, T.adm, 'PUT');
    expect((await call('/mounts/summon', { characterId: T.c, cmId: T.cm }, T.tk)).status).toBe(409);
    const r = await call('/mounts/call', { characterId: T.c, cmId: T.cm }, T.tk); expect(r.status).toBe(200);
    await call(`/summons/${r.j.summonId}/dismiss`, { characterId: T.c }, T.tk);
    expect((await call('/mounts/unequip', { characterId: T.c, cmId: T.cm, slot: 'head' }, T.tk)).status).toBe(200);
    expect((await pool.query('SELECT 1 FROM character_items WHERE character_id=$1 AND item_id=$2', [T.c, T.helm])).rowCount).toBe(1);
  });

  test('invoquée à pied puis « Monter dessus » depuis la case voisine : créature renvoyée, PV / énergie conservés, montée', async () => {
    await call(`/admin/content/monsters/${T.type}`, { mountable: true }, T.adm, 'PUT');
    const r = await call('/mounts/call', { characterId: T.c, cmId: T.cm }, T.tk); expect(r.status, JSON.stringify(r.j)).toBe(200);
    await pool.query('UPDATE summons SET energy_current=11 WHERE id=$1', [r.j.summonId]);
    const up = await call('/mounts/summon', { characterId: T.c, cmId: T.cm }, T.tk); expect(up.status, JSON.stringify(up.j)).toBe(200);
    expect((await pool.query('SELECT 1 FROM summons WHERE id=$1', [r.j.summonId])).rowCount).toBe(0);
    expect(await cm()).toMatchObject({ active: true, energy_current: 11 });
    expect((await mine()).summon_id).toBeNull();
    await call('/mounts/dismount', { characterId: T.c }, T.tk);
  });
});

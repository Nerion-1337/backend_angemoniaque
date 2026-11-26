import { describe, test, expect, beforeAll } from 'vitest';
// Migration 43 : plus de montures possédées. Un sort invoque un monstre ; s'il est « montable », son propriétaire monte dessus
// (après coup depuis une case voisine, ou dès le lancer). Délai avant de relancer un sort ; délai après la mort de l'invocation.
describe.skipIf(!process.env.DATABASE_URL)('Monter sur une invocation, délais de relance', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const spell = async (name: string, extra: any) => { const r = await call('/admin/content/spells', { name: `${name}${s}`, energyCost: 0, shop: false, ...extra }, T.adm); expect(r.status, JSON.stringify(r.j)).toBe(200);
    await call(`/admin/players/${T.c}/grant`, { kind: 'spell', refId: r.j.id }, T.adm); return r.j.id; };
  const monster = async (name: string, extra: any) => (await call('/admin/content/monsters', { name: `${name}${s}`, hp_max: 60, energy_max: 60, locomotion: ['land'], ...extra }, T.adm)).j.id;
  const cast = (spellId: number, ride?: boolean) => call('/spells/cast', { characterId: T.c, spellId, ...(ride !== undefined ? { ride } : {}) }, T.tk);
  const mine = async (type: number) => (await call(`/summons/${T.c}`, undefined, T.tk)).j.find((x: any) => x.monster_id === type);
  const hero = async () => (await pool.query('SELECT energy_current, riding_summon_id FROM characters WHERE id=$1', [T.c])).rows[0];
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`sr${s}@x.fr`); T.c = (await call('/characters', { pseudo: `sr${s}`, race: 'human' }, T.tk)).j.id;
    await call(`/admin/players/${T.c}/teleport`, { map: 3, x: 50 + (s % 90), y: 60 + (s % 70) }, T.adm);
    await pool.query('UPDATE characters SET energy_current=100, energy_max=100, summon_cap=10 WHERE id=$1', [T.c]);
    T.steed = await monster('Wyverne', { mountable: true, energy_max: 80 });
    T.roar = (await call('/admin/content/spells', { name: `Rugissement${s}`, energyCost: 5, shop: false, effects: { target: 'self', heal: 1 } }, T.adm)).j.id;
    await call(`/admin/content/monsters/${T.steed}/spells`, { spellId: T.roar, mode: 'active' }, T.adm);
    T.call = await spell('Appel', { effects: { summon: { kind: 'monster', refId: T.steed } } });
  });

  test('invoqué puis monté depuis une case voisine ; déplacement et capacité payés par l\'invocation ; descendre', async () => {
    expect((await cast(T.call)).status).toBe(200);
    const sm = await mine(T.steed); expect(sm).toMatchObject({ mountable: true, ridden: false });
    await pool.query('UPDATE positions SET coord_x=coord_x+6 WHERE summon_id=$1', [sm.id]);   // trop loin
    const far = await call('/summons/ride', { characterId: T.c, summonId: sm.id }, T.tk); expect(far.status).toBe(409); expect(far.j.error).toMatch(/Approchez-vous/);
    await pool.query('UPDATE positions SET coord_x=coord_x-6 WHERE summon_id=$1', [sm.id]);
    expect((await call('/summons/ride', { characterId: T.c, summonId: sm.id }, T.tk)).status).toBe(200);
    expect((await hero()).riding_summon_id).toBe(sm.id);
    expect((await pool.query('SELECT 1 FROM positions WHERE summon_id=$1', [sm.id])).rowCount).toBe(0);   // porte son cavalier : plus une cible
    expect((await mine(T.steed)).ridden).toBe(true);
    expect((await call('/summons/control', { characterId: T.c, summonId: sm.id }, T.tk)).status).toBe(409);
    const en = async () => (await pool.query('SELECT energy_current FROM summons WHERE id=$1', [sm.id])).rows[0].energy_current;
    const e0 = await en(), h0 = (await hero()).energy_current;
    const rc = await call('/spells/cast', { characterId: T.c, spellId: T.roar }, T.tk); expect(rc.status, JSON.stringify(rc.j)).toBe(200);   // capacité du type
    expect(await en()).toBe(e0 - 5); expect((await hero()).energy_current).toBe(h0);
    const { rows: [p] } = await pool.query('SELECT coord_x x, coord_y y FROM positions WHERE character_id=$1', [T.c]);
    let moved = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) { if ((await call('/actions/move', { characterId: T.c, x: p.x + dx, y: p.y + dy }, T.tk)).status === 200) { moved = true; break; } }
    expect(moved).toBe(true); expect(await en()).toBeLessThan(e0 - 5); expect((await hero()).energy_current).toBe(h0);
    expect((await call('/summons/dismount', { characterId: T.c }, T.tk)).status).toBe(200);
    expect((await hero()).riding_summon_id).toBeNull();
    const { rows: [q] } = await pool.query('SELECT p.coord_x x, p.coord_y y, h.coord_x hx, h.coord_y hy FROM positions p, positions h WHERE p.summon_id=$1 AND h.character_id=$2', [sm.id, T.c]);
    expect(Math.max(Math.abs(q.x - q.hx), Math.abs(q.y - q.hy))).toBeLessThanOrEqual(1);   // reposé à côté
    expect((await call('/summons/dismount', { characterId: T.c }, T.tk)).status).toBe(409);
  });

  test('monter dès le lancer ; type non montable : refusé', async () => {
    const r = await cast(T.call, true); expect(r.status, JSON.stringify(r.j)).toBe(200); expect(r.j.results[0].effect).toContain('monte dessus');
    expect((await hero()).riding_summon_id).toBeTruthy();
    await call('/summons/dismount', { characterId: T.c }, T.tk);
    const rat = await monster('Rat', {}), sp = await spell('Rats', { effects: { summon: { kind: 'monster', refId: rat } } });
    const r2 = await cast(sp, true); expect(r2.status).toBe(200); expect(r2.j.results[0].effect).not.toContain('monte');   // invoqué, pas monté
    const sm = await mine(rat); expect(sm.mountable).toBe(false);
    expect((await call('/summons/ride', { characterId: T.c, summonId: sm.id }, T.tk)).status).toBe(409);
  });

  test('délai avant de relancer un sort (spells.cooldown_h, en heures)', async () => {
    const sp = await spell('Éclair', { cooldownH: 1.5, effects: { target: 'self', heal: 1 } });
    expect((await cast(sp)).status).toBe(200);
    const again = await cast(sp); expect(again.status).toBe(409); expect(again.j.error).toMatch(/encore 1 h 30/);
    const listed = (await call(`/spells/${T.c}`, undefined, T.tk)).j.spells.find((x: any) => x.id === sp);
    expect(Number(listed.cooldown_h)).toBe(1.5); expect(listed.cooldown_left_s).toBeGreaterThan(5000);
    await pool.query("UPDATE spell_cooldowns SET ready_at=now() - interval '1 second' WHERE character_id=$1 AND spell_id=$2", [T.c, sp]);
    expect((await cast(sp)).status).toBe(200);
  });

  test('mort de l\'invocation : délai (monsters.resummon_delay_h) avant de relancer son sort ; renvoi : aucun délai', async () => {
    const golem = await monster('Golem', { resummon_delay_h: 2 }), sp = await spell('Golem', { effects: { summon: { kind: 'monster', refId: golem } } });
    expect((await cast(sp)).status).toBe(200);
    let sm = await mine(golem);
    expect((await call(`/summons/${sm.id}/dismiss`, { characterId: T.c }, T.tk)).status).toBe(200);   // renvoyé : pas mort
    expect((await cast(sp)).status).toBe(200);
    sm = await mine(golem);
    const { loadTarget, applyDamage } = await import('../../src/game/combatlib');
    const { rows: [pos] } = await pool.query('SELECT * FROM positions WHERE summon_id=$1', [sm.id]);
    expect((await applyDamage(pool, (await loadTarget(pool, pos))!, 100000, T.c)).killed).toBe(true);
    const r = await cast(sp); expect(r.status).toBe(409); expect(r.j.error).toMatch(/encore (1 h 59|2 h)/);
    const { rows: [cd] } = await pool.query('SELECT EXTRACT(EPOCH FROM ready_at - now())::int s FROM spell_cooldowns WHERE character_id=$1 AND spell_id=$2', [T.c, sp]);
    expect(cd.s).toBeGreaterThan(7000); expect(cd.s).toBeLessThanOrEqual(7200);
  });

  test('admin : délais validés (négatif refusé) ; plus de routes /mounts', async () => {
    expect((await call('/admin/content/spells', { name: `Neg${s}`, cooldownH: -1 }, T.adm)).status).toBe(400);
    expect((await call('/admin/content/monsters', { name: `Neg${s}`, resummon_delay_h: -1 }, T.adm)).status).toBe(400);
    expect((await call(`/mounts/${T.c}`, undefined, T.tk)).status).toBe(404);
  });
});

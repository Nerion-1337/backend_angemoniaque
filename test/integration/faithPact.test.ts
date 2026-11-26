import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Migration 44 : classement public, foi réglée en admin (dieux de sa race, prières limitées, bénédictions au coût proportionnel),
// pactes à compositions (choisies par l'Ange / le Démon, % des caractéristiques transféré, durée, délai), pactes par rang.
describe.skipIf(!process.env.DATABASE_URL)('Classement, foi et pactes', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const mk = async (n: string, race: string) => { const tk = await login(`${n}${s}@x.fr`), id = (await call('/characters', { pseudo: `${n}${s}`, race }, tk)).j.id; return { tk, id, pseudo: `${n}${s}` }; };
  const ch = async (id: number) => (await pool.query('SELECT * FROM characters WHERE id=$1', [id])).rows[0];
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.faith0 = (await call('/admin/content/faith', undefined, T.adm)).j; T.pact0 = (await call('/admin/content/pact', undefined, T.adm)).j;
    T.god = await mk('dieu', 'human'); T.fid = await mk('fid', 'human'); T.ang = await mk('ange', 'angel'); T.hum = await mk('hom', 'human');
    const { rows: [top] } = await pool.query("SELECT id FROM specializations WHERE race='human' AND current_rank >= 5 ORDER BY current_rank LIMIT 1");
    await pool.query('UPDATE characters SET specialization_id=$2, divine_energy_current=100, divine_energy_max=100, xp=0 WHERE id=$1', [T.god.id, top.id]);
  });
  afterAll(async () => {
    await call('/admin/content/faith', { followersStep: T.faith0.followersStep, xpHour: T.faith0.xpHour, goldHour: T.faith0.goldHour, prayers: T.faith0.prayers, prayerPeriodH: T.faith0.prayerPeriodH, blessings: T.faith0.blessings }, T.adm, 'PUT');
    await call('/admin/content/pact', { stats: T.pact0.stats }, T.adm, 'PUT');
  });

  test('classement public : par rang puis XP, paginé ; « around » ouvre la page du joueur', async () => {
    const r = await call('/ranking?size=5'); expect(r.status).toBe(200);
    expect(r.j).toMatchObject({ page: 1, size: 5 }); expect(r.j.rows.length).toBeLessThanOrEqual(5);
    expect(Object.keys(r.j.rows[0]).sort()).toEqual(['current_rank', 'guild', 'pos', 'pseudo', 'race', 'race_name', 'rank_name']);
    for (let i = 1; i < r.j.rows.length; i++) expect(r.j.rows[i].current_rank).toBeLessThanOrEqual(r.j.rows[i - 1].current_rank);
    const me = await call(`/ranking?size=5&around=${T.fid.pseudo}`); expect(me.j.rows.some((x: any) => x.pseudo === T.fid.pseudo)).toBe(true);
    expect(me.j.page).toBe(Math.ceil(me.j.position / 5));
    expect((await call(`/ranking?size=5&page=${me.j.pages + 3}`)).j.page).toBe(me.j.pages);   // au-delà : dernière page
  });

  test('foi : dieux de sa race seulement, prières limitées, bénédiction au coût proportionnel', async () => {
    expect((await call('/admin/content/faith', { followersStep: 1, xpHour: 4, goldHour: 3, prayers: 1, prayerPeriodH: 24, blessings: { strength: { max: 5, maxH: 10, cost: 10 }, hp_max: { max: 20, maxH: 2, cost: 4 } } }, T.adm, 'PUT')).status).toBe(200);
    expect((await call('/admin/content/faith', { followersStep: 0, xpHour: 1, goldHour: 1, prayers: 1, prayerPeriodH: 1, blessings: {} }, T.adm, 'PUT')).status).toBe(400);
    const gods = (await call(`/faiths/gods/${T.fid.id}`, undefined, T.fid.tk)).j; expect(gods.some((g: any) => g.pseudo === T.god.pseudo)).toBe(true);
    expect((await call(`/faiths/gods/${T.ang.id}`, undefined, T.ang.tk)).j.some((g: any) => g.pseudo === T.god.pseudo)).toBe(false);   // autre race
    expect((await call('/faiths/join', { characterId: T.ang.id, godId: T.god.id }, T.ang.tk)).status).toBe(403);
    expect((await call('/faiths/join', { characterId: T.fid.id, godId: T.god.id }, T.fid.tk)).status).toBe(200);
    let g = (await call(`/faiths/${T.god.id}`, undefined, T.god.tk)).j; const f = g.asGod.find((x: any) => x.pseudo === T.fid.pseudo);
    expect(f).toMatchObject({ status: 'pending', race: 'human' }); expect(f.rank_name).toBeTruthy();
    expect((await call(`/faiths/${f.id}/accept`, { characterId: T.god.id, accept: true }, T.god.tk)).status).toBe(200);
    expect((await call(`/faiths/${f.id}/pray`, { characterId: T.fid.id, stat: 'see' }, T.fid.tk)).status).toBe(400);   // non proposée
    expect((await call(`/faiths/${f.id}/pray`, { characterId: T.fid.id, stat: 'strength' }, T.fid.tk)).status).toBe(200);
    const again = await call(`/faiths/${f.id}/pray`, { characterId: T.fid.id, stat: 'strength' }, T.fid.tk); expect(again.status).toBe(429); expect(again.j.error).toMatch(/prochaine dans/);
    g = (await call(`/faiths/${T.god.id}`, undefined, T.god.tk)).j; expect(g.asGod.find((x: any) => x.id === f.id).request_choice).toBe('strength');
    expect(g.income).toEqual({ xp: 4, gold: 3 });
    expect((await call(`/faiths/${f.id}/bless`, { characterId: T.god.id, stat: 'strength', value: 6, hours: 1 }, T.god.tk)).status).toBe(400);
    expect((await call(`/faiths/${f.id}/bless`, { characterId: T.god.id, stat: 'strength', value: 1, hours: 11 }, T.god.tk)).status).toBe(400);
    const s0 = (await ch(T.fid.id)).strength;
    const b = await call(`/faiths/${f.id}/bless`, { characterId: T.god.id, stat: 'strength', value: 3, hours: 4 }, T.god.tk); expect(b.status, JSON.stringify(b.j)).toBe(200);
    expect(b.j.cost).toBe(3);   // ⌈10 × 3/5 × 4/10⌉ = ⌈2,4⌉
    expect((await ch(T.fid.id)).strength).toBe(s0 + 3); expect((await ch(T.god.id)).divine_energy_current).toBe(97);
    expect((await call(`/faiths/${T.god.id}`, undefined, T.god.tk)).j.asGod.find((x: any) => x.id === f.id).request_choice).toBeNull();
    const h0 = await ch(T.fid.id);
    expect((await call(`/faiths/${f.id}/bless`, { characterId: T.god.id, stat: 'hp_max', value: 10, hours: 1 }, T.god.tk)).status).toBe(200);
    const h1 = await ch(T.fid.id); expect(h1.hp_max).toBe(h0.hp_max + 10); expect(h1.hp_current).toBe(Math.min(h0.hp_current + 10, h1.hp_max));   // PV max ET PV
    expect((await call(`/faiths/${f.id}/bless`, { characterId: T.fid.id, stat: 'strength', value: 1, hours: 1 }, T.fid.tk)).status).toBe(403);   // pas un dieu
    const { hourlyTick } = await import('../../src/routes/tick');
    const x0 = (await ch(T.god.id)).xp, gain = (await pool.query('SELECT s.gain_xp_hour FROM characters c JOIN specializations s ON s.id=c.specialization_id WHERE c.id=$1', [T.god.id])).rows[0].gain_xp_hour;
    const rate = Number((await pool.query("SELECT value FROM game_config WHERE key='xp_rate'")).rows[0]?.value ?? 1);
    await hourlyTick(); expect((await ch(T.god.id)).xp - x0).toBe(Math.round((gain + 4) * rate));   // 1 fidèle × 4 XP/h
  });

  test('pactes : compositions (admin), choix par l\'Ange, transfert en %, PV insuffisants, recharge, limite par rang', async () => {
    expect((await call('/admin/content/pact-tiers', { name: `Bad${s}`, xp_hour: 1, gold_hour: 1, percent: 0, duration_h: 1, cooldown_h: 0 }, T.adm)).status).toBe(400);
    const tier = await call('/admin/content/pact-tiers', { name: `Fort${s}`, xp_hour: 7, gold_hour: 2, percent: 50, duration_h: 1, cooldown_h: 2 }, T.adm); expect(tier.status, JSON.stringify(tier.j)).toBe(200);
    expect((await call('/admin/content/pact-tiers', { name: `Fort${s}`, xp_hour: 1, gold_hour: 1, percent: 5, duration_h: 1, cooldown_h: 0 }, T.adm)).status).toBe(409);
    expect((await call('/admin/content/pact', { stats: ['strength', 'hp_max'] }, T.adm, 'PUT')).status).toBe(200);
    const r = await call('/pacts/request', { characterId: T.hum.id, targetPseudo: T.ang.pseudo }, T.hum.tk); expect(r.status).toBe(200);
    const inc = (await call(`/pacts/${T.ang.id}`, undefined, T.ang.tk)).j.incoming.find((p: any) => p.id === r.j.id);
    expect(inc).toMatchObject({ pseudo: T.hum.pseudo, race: 'human' }); expect(inc.rank_name).toBeTruthy();   // mêmes infos que le classement
    expect((await call(`/pacts/${r.j.id}/answer`, { characterId: T.ang.id, accept: true }, T.ang.tk)).status).toBe(200);
    expect((await call(`/pacts/${r.j.id}/tier`, { characterId: T.hum.id, tierId: tier.j.id }, T.hum.tk)).status).toBe(404);   // l'Humain ne choisit pas
    expect((await call(`/pacts/${r.j.id}/tier`, { characterId: T.ang.id, tierId: tier.j.id }, T.ang.tk)).status).toBe(200);
    const hv = (await call(`/pacts/${T.hum.id}`, undefined, T.hum.tk)).j; expect(hv.tiers).toEqual([]); expect(hv.active[0].tier_name).toBe(`Fort${s}`);
    expect((await call(`/pacts/${T.ang.id}`, undefined, T.ang.tk)).j.tiers.some((t: any) => t.id === tier.j.id && t.percent === 50)).toBe(true);
    await pool.query('UPDATE characters SET strength=21, hp_max=100, hp_current=40 WHERE id=$1', [T.ang.id]);
    const weak = await call(`/pacts/${r.j.id}/activate`, { characterId: T.hum.id }, T.hum.tk); expect(weak.status).toBe(409); expect(weak.j.error).toMatch(/points de vie/);
    await pool.query('UPDATE characters SET hp_current=100 WHERE id=$1', [T.ang.id]);
    const h0 = await ch(T.hum.id);
    const a = await call(`/pacts/${r.j.id}/activate`, { characterId: T.hum.id }, T.hum.tk); expect(a.status, JSON.stringify(a.j)).toBe(200);
    expect(a.j.transfer).toEqual({ strength: 11, hp_max: 50 });   // ⌈21 × 50 %⌉, ⌈100 × 50 %⌉
    const h1 = await ch(T.hum.id), e1 = await ch(T.ang.id);
    expect(h1.strength).toBe(h0.strength + 11); expect(h1.hp_max).toBe(h0.hp_max + 50); expect(e1).toMatchObject({ strength: 10, hp_max: 50, hp_current: 50 });
    expect((await call(`/pacts/${r.j.id}/activate`, { characterId: T.hum.id }, T.hum.tk)).j.error).toMatch(/déjà actif/);
    await pool.query("DELETE FROM temp_buffs WHERE source=$1", [`pact:${r.j.id}`]);   // fin du bonus simulée
    const cd = await call(`/pacts/${r.j.id}/activate`, { characterId: T.hum.id }, T.hum.tk); expect(cd.status).toBe(409); expect(cd.j.error).toMatch(/recharge : encore (2 h 5|3 h)/);
    // limite par rang : 1 pacte pour le rang de l'Humain
    expect((await call(`/admin/content/pact-limits/${h1.specialization_id}`, { maxPacts: 1 }, T.adm, 'PUT')).status).toBe(200);
    const d2 = await mk('dem', 'demon'), r2 = await call('/pacts/request', { characterId: d2.id, targetPseudo: T.hum.pseudo }, d2.tk);
    const no = await call(`/pacts/${r2.j.id}/answer`, { characterId: T.hum.id, accept: true }, T.hum.tk); expect(no.status).toBe(409); expect(no.j.error).toMatch(/nombre maximal de pactes \(1\)/);
    expect((await call(`/admin/content/pact-limits/${h1.specialization_id}`, { maxPacts: null }, T.adm, 'PUT')).status).toBe(200);
    expect((await call('/admin/content/pact-limits', undefined, T.adm)).j.find((x: any) => x.id === h1.specialization_id)).toMatchObject({ max_pacts: null, default_max: 1 });
    expect((await call(`/admin/content/pact-tiers/${tier.j.id}`, undefined, T.adm, 'DELETE')).status).toBe(200);
    expect((await call(`/pacts/${T.hum.id}`, undefined, T.hum.tk)).j.active.find((p: any) => p.id === r.j.id).tier_id).toBeNull();
  });
});

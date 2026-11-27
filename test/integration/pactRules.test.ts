import { describe, test, expect, beforeAll, afterAll } from 'vitest';
// Lot pactes (migration 45) : attributions limitées par composition, changement de composition toutes les 48 h, durée et recharge
// visibles des deux côtés, recharge comptée depuis la FIN du bonus, origine des bonus au survol (pacte / foi / objet).
describe.skipIf(!process.env.DATABASE_URL)('Pactes : limites, délais, origine des bonus', () => {
  let app: any, pool: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const mk = async (n: string, race: string) => { const tk = await login(`${n}${s}@x.fr`), id = (await call('/characters', { pseudo: `${n}${s}`, race }, tk)).j.id; return { tk, id, pseudo: `${n}${s}` }; };
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.pact0 = (await call('/admin/content/pact', undefined, T.adm)).j;
    await call('/admin/content/pact', { stats: ['strength'] }, T.adm, 'PUT');
    T.strong = (await call('/admin/content/pact-tiers', { name: `Fort${s}`, xp_hour: 5, gold_hour: 5, percent: 50, duration_h: 2, cooldown_h: 3, max_assign: 2 }, T.adm)).j;
    T.weak = (await call('/admin/content/pact-tiers', { name: `Faible${s}`, xp_hour: 1, gold_hour: 1, percent: 10, duration_h: 1, cooldown_h: 1 }, T.adm)).j;
    T.ang = await mk('pa', 'angel'); T.h = [await mk('ph1', 'human'), await mk('ph2', 'human'), await mk('ph3', 'human')];
    T.p = [];
    for (const h of T.h) { const r = await call('/pacts/request', { characterId: h.id, targetPseudo: T.ang.pseudo }, h.tk); expect(r.status, JSON.stringify(r.j)).toBe(200); T.p.push(r.j.id);
      expect((await call(`/pacts/${r.j.id}/answer`, { characterId: T.ang.id, accept: true }, T.ang.tk)).status).toBe(200); }
  });
  afterAll(async () => {
    await call('/admin/content/pact', { stats: T.pact0.stats }, T.adm, 'PUT');
    for (const t of [T.strong, T.weak]) if (t?.id) await call(`/admin/content/pact-tiers/${t.id}`, undefined, T.adm, 'DELETE');
  });
  const tierOf = (id: number, tierId: number) => call(`/pacts/${id}/tier`, { characterId: T.ang.id, tierId }, T.ang.tk);

  test('une composition s’attribue au plus « max_assign » fois ; l’Ange voit ce qui reste', async () => {
    expect(T.strong.max_assign).toBe(2);
    expect((await tierOf(T.p[0], T.strong.id)).status).toBe(200);
    expect((await tierOf(T.p[1], T.strong.id)).status).toBe(200);
    const no = await tierOf(T.p[2], T.strong.id); expect(no.status).toBe(409); expect(no.j.error).toMatch(/2 fois/);
    const t = (await call(`/pacts/${T.ang.id}`, undefined, T.ang.tk)).j.tiers.find((x: any) => x.id === T.strong.id);
    expect(t).toMatchObject({ used: 2, full: true });
  });

  test('changement de composition : une fois toutes les 48 h (même composition = sans effet)', async () => {
    expect((await tierOf(T.p[0], T.strong.id)).status).toBe(200);   // inchangée
    const no = await tierOf(T.p[0], T.weak.id); expect(no.status).toBe(409); expect(no.j.error).toMatch(/prochain changement dans (47|48) h/);
    const view = (await call(`/pacts/${T.ang.id}`, undefined, T.ang.tk)).j.active.find((p: any) => p.id === T.p[0]); expect(view.tier_change_in_s).toBeGreaterThan(47 * 3600);
    await pool.query("UPDATE pacts SET tier_changed_at=now() - interval '49 hours' WHERE id=$1", [T.p[0]]);
    expect((await tierOf(T.p[0], T.weak.id)).status).toBe(200);
    expect((await tierOf(T.p[2], T.strong.id)).status).toBe(200);   // une place s'est libérée
  });

  test('l’Humain voit durée et recharge ; recharge comptée depuis la fin du bonus ; pas de cumul sur un même pacte ; origine au survol', async () => {
    const h = T.h[2]; await pool.query('UPDATE characters SET strength=20 WHERE id=$1', [T.ang.id]);
    let v = (await call(`/pacts/${h.id}`, undefined, h.tk)).j.active[0];
    expect(v).toMatchObject({ tier_name: `Fort${s}`, duration_h: 2, cooldown_h: 3 }); expect(v.percent).toBeUndefined();
    const a = await call(`/pacts/${T.p[2]}/activate`, { characterId: h.id }, h.tk); expect(a.status, JSON.stringify(a.j)).toBe(200);
    v = (await call(`/pacts/${h.id}`, undefined, h.tk)).j.active[0];
    expect(v.bonus_left_s).toBeGreaterThan(2 * 3600 - 60); expect(v.ready_in_s).toBeGreaterThan(5 * 3600 - 60);   // 2 h de bonus PUIS 3 h de recharge
    expect((await call(`/pacts/${T.p[2]}/activate`, { characterId: h.id }, h.tk)).j.error).toMatch(/déjà actif/);
    const bd = (await call(`/characters/${h.id}`, undefined, h.tk)).j.breakdown.strength.parts;
    expect(bd).toContainEqual({ label: `Pacte avec ${T.ang.pseudo} (Fort${s})`, value: 10, kind: 'pact' });
    const be = (await call(`/characters/${T.ang.id}`, undefined, T.ang.tk)).j.breakdown.strength.parts;
    expect(be).toContainEqual({ label: `Pacte avec ${h.pseudo} (Fort${s})`, value: -10, kind: 'pact' });
  });

  test('admin : max_assign validé et remis à illimité', async () => {
    expect((await call(`/admin/content/pact-tiers/${T.weak.id}`, { max_assign: 0 }, T.adm, 'PUT')).status).toBe(400);
    expect((await call(`/admin/content/pact-tiers/${T.strong.id}`, { max_assign: null }, T.adm, 'PUT')).j.max_assign).toBeNull();
  });
});

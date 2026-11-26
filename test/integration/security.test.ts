import { describe, test, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
// Sécurité de bout en bout : accès admin (jeton falsifié, rôle obsolète, jeton à portée restreinte), cookie des fichiers admin,
// amorçage de l'admin, inscription (mot de passe fort, champ piège, preuve de travail), limitation de débit, CORS.
describe.skipIf(!process.env.DATABASE_URL)('Sécurité : admin, inscription, débit', () => {
  let app: any, pool: any, signToken: any, sign: any, env: any; const s = Date.now() % 1e7, PW = 'Lune-Brisee-2026!';
  const req = (path: string, o: any = {}) => app.request(path, { method: o.method ?? (o.body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(o.tk ? { authorization: `Bearer ${o.tk}` } : {}), ...(o.h ?? {}) }, body: o.body ? JSON.stringify(o.body) : undefined });
  const call = async (path: string, o: any = {}) => { const r = await req(path, o); return { status: r.status, j: await r.json().catch(() => null), r }; };
  const reg = (email: string, extra: any = {}, h?: any) => call('/auth/register', { body: { email, password: PW, ...extra }, h });
  const withEnv = async (vars: Record<string, string>, fn: () => Promise<void>) => { const old = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]])); Object.assign(process.env, vars); try { await fn(); } finally { for (const [k, v] of Object.entries(old)) v === undefined ? delete process.env[k] : (process.env[k] = v); } };
  beforeAll(async () => { app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool; signToken = (await import('../../src/middleware/auth')).signToken; sign = (await import('hono/jwt')).sign; env = (await import('../../src/config/env')).env;
    if ((await reg(env.adminEmail)).status !== 200) await call('/auth/login', { body: { email: env.adminEmail, password: PW } }); });

  test('API admin : jeton falsifié → 401 ; rôle « admin » dans le jeton d’un joueur → 403 ; admin rétrogradé → 403 ; jeton de portée → 401', async () => {
    const forged = await sign({ sub: 1, role: 'admin', exp: Math.floor(Date.now() / 1000) + 600 }, 'dev-secret', 'HS256');
    expect((await call('/admin/players', { tk: forged })).status).toBe(401);
    const p = (await reg(`sec${s}@x.fr`)).j, id = (await call('/auth/me', { tk: p.token })).j.id;
    expect((await call('/admin/players', { tk: p.token })).status).toBe(403);
    expect((await call('/admin/players', { tk: await signToken(id, 'admin') })).status).toBe(403);   // rôle lu en base, pas dans le jeton
    await pool.query("UPDATE accounts SET role='admin' WHERE id=$1", [id]); const tk = await signToken(id, 'admin');
    expect((await call('/admin/players', { tk })).status).toBe(200);
    await pool.query("UPDATE accounts SET role='player' WHERE id=$1", [id]);
    expect((await call('/admin/players', { tk })).status).toBe(403);   // rétrogradé : effet immédiat
    const scoped = await sign({ sub: id, scope: 'admin-assets', exp: Math.floor(Date.now() / 1000) + 600 }, env.jwt, 'HS256');
    expect((await call('/characters', { tk: scoped })).status).toBe(401);
    expect((await call('/forum/mod/reports', { tk: p.token })).status).toBe(403);
  });
  test('fichiers admin : sans cookie 403 ; cookie posé à la connexion admin → 204 ; joueur sans cookie ; cookie falsifié → 403', async () => {
    expect((await req('/auth/admin-asset')).status).toBe(403);
    const lg = await req('/auth/login', { body: { email: env.adminEmail, password: PW } }), ck = (lg.headers.get('set-cookie') ?? '').match(/ange_adm=[^;]+/)?.[0];
    expect(ck).toBeTruthy(); expect(lg.headers.get('set-cookie')).toMatch(/HttpOnly/i); expect(lg.headers.get('set-cookie')).toMatch(/SameSite=Strict/i);
    expect((await req('/auth/admin-asset', { h: { cookie: ck } })).status).toBe(204);
    const pl = await req('/auth/login', { body: { email: `sec${s}@x.fr`, password: PW } }); expect(pl.headers.get('set-cookie') ?? '').not.toMatch(/ange_adm=[^;]{10,}/);
    const pid = (await call('/auth/me', { tk: (await pl.json()).token })).j.id, fake = await sign({ sub: pid, scope: 'admin-assets', exp: Math.floor(Date.now() / 1000) + 600 }, env.jwt, 'HS256');
    expect((await req('/auth/admin-asset', { h: { cookie: `ange_adm=${fake}` } })).status).toBe(403);
  });
  test('amorçage : l’email admin ne devient admin que s’il n’existe aucun admin', async () => {
    const { bootstrapRole } = await import('../../src/routes/auth'); expect(await bootstrapRole(env.adminEmail.toLowerCase())).toBe('player');
  });
  test('inscription : mot de passe faible refusé (motifs), champ piège refusé', async () => {
    const w = await call('/auth/register', { body: { email: `weak${s}@x.fr`, password: 'azertyuiop12' } }); expect(w.status).toBe(400); expect(w.j.error).toMatch(/Mot de passe trop faible/);
    expect((await reg(`bot${s}@x.fr`, { website: 'http://spam' })).status).toBe(400);
  });
  test('inscription : preuve de travail exigée, résolue, à usage unique', async () => {
    await withEnv({ BOT_CHECK: '1', POW_BITS: '10' }, async () => {
      expect((await reg(`pow${s}@x.fr`)).j.error).toMatch(/anti-robot/);
      const ch = (await call('/auth/challenge')).j, sl = JSON.parse(Buffer.from(ch.token.split('.')[0], 'base64url').toString());
      let n = 0; for (;; n++) { const h = createHash('sha256').update(`${sl.s}:${n}`).digest(); let z = 0; for (const x of h) { if (!x) { z += 8; continue; } z += Math.clz32(x) - 24; break; } if (z >= sl.b) break; }
      expect((await reg(`pow${s}@x.fr`, { pow: { token: ch.token, nonce: n } })).status).toBe(200);
      expect((await reg(`pow2${s}@x.fr`, { pow: { token: ch.token, nonce: n } })).j.error).toMatch(/déjà utilisée/);
    });
  });
  test('débit : inscriptions par IP plafonnées ; connexion verrouillée après 8 échecs sur un email ; CORS fermé', async () => {
    await withEnv({ RATE_LIMIT: '1' }, async () => {
      const ip = { 'x-real-ip': `10.9.${s % 250}.${(s >> 8) % 250}` }; const st: number[] = [];
      for (let i = 0; i < 6; i++) st.push((await call('/auth/register', { body: { email: `rl${i}${s}@x.fr`, password: 'x' }, h: ip })).status);
      expect(st.slice(0, 5).every(x => x === 400)).toBe(true); expect(st[5]).toBe(429);
      const em = `sec${s}@x.fr`; for (let i = 0; i < 8; i++) expect((await call('/auth/login', { body: { email: em, password: 'mauvais' }, h: { 'x-real-ip': `10.8.${i}.${s % 250}` } })).status).toBe(401);
      const locked = await call('/auth/login', { body: { email: em, password: PW }, h: { 'x-real-ip': `10.7.1.${s % 250}` } }); expect(locked.status).toBe(429); expect(locked.j.error).toMatch(/15 min/);
    });
    const r = await req('/forum', { h: { origin: 'https://evil.example' } }); expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });
});

import { describe, test, expect, beforeAll } from 'vitest';
describe.skipIf(!process.env.DATABASE_URL)('Inscription / connexion', () => {
  let app: any; const em = `reg${Date.now()}@x.fr`;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const post = async (p: string, b: any, tk?: string) => { const r = await app.request(p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json() }; };
  test('email invalide -> message lisible', async () => { const r = await post('/auth/register', { email: 'nope', password: 'password1' }); expect(r.s).toBe(400); expect(typeof r.j.error).toBe('string'); expect(r.j.error).toContain('email'); });
  test('mot de passe trop court', async () => { const r = await post('/auth/register', { email: em, password: 'abc' }); expect(r.s).toBe(400); expect(r.j.error).toContain('8 caractères'); });
  test('inscription, doublon refusé, connexion, /auth/me', async () => {
    const ok = await post('/auth/register', { email: em, password: 'password1' }); expect(ok.s).toBe(200); expect(ok.j.token).toBeTruthy();
    const dup = await post('/auth/register', { email: em.toUpperCase(), password: 'password1' }); expect(dup.s).toBe(409); expect(dup.j.error).toContain('déjà utilisé');
    expect((await post('/auth/login', { email: em, password: 'mauvais-mdp' })).s).toBe(401);
    const lg = await post('/auth/login', { email: em, password: 'password1' }); expect(lg.s).toBe(200);
    const me = await (await app.request('/auth/me', { headers: { authorization: `Bearer ${lg.j.token}` } })).json(); expect(me.email).toBe(em);
  });
  test('pseudo invalide refusé', async () => { const t = (await post('/auth/login', { email: em, password: 'password1' })).j.token; const r = await post('/characters', { pseudo: 'a b', race: 'human' }, t); expect(r.s).toBe(400); });
});

import { describe, test, expect, beforeAll } from 'vitest';
// Nécessite Postgres (schéma du dépôt infra) + Redis : exécuté en CI, ignoré sans DATABASE_URL.
describe.skipIf(!process.env.DATABASE_URL)('API intégration', () => {
  let app: any; const u = `t${Date.now()}`; let token = ''; let id = 0;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = (path: string, body?: any, tk?: string) =>
    app.request(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  test('inscription + création + déplacement', async () => {
    token = (await (await call('/auth/register', { email: `${u}@x.fr`, password: 'password1' })).json()).token; expect(token).toBeTruthy();
    const r = await call('/characters', { pseudo: u, race: 'angel' }, token); expect(r.status).toBe(200); id = (await r.json()).id;
    const me = await (await call(`/characters/${id}`, undefined, token)).json(); expect(me.rank.rank_name).toBe('Soldat');
    const m = await call('/actions/move', { characterId: id, x: me.pos.x + 1, y: me.pos.y }, token); expect([200, 409]).toContain(m.status);
  });
  test('même race obligatoire (trigger SQL)', async () => expect((await call('/characters', { pseudo: u + 'b', race: 'human' }, token)).status).toBe(400));
  test('routes protégées', async () => expect((await call('/characters')).status).toBe(401));
  test('admin interdit aux joueurs', async () => expect((await call('/admin/stats', undefined, token)).status).toBe(403));
});

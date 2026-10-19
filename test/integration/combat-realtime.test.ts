import { describe, test, expect, beforeAll } from 'vitest'; import { Redis } from 'ioredis';
// Parcours complet du retour temps réel : un joueur attaque, le spectateur (abonné Redis du canal de la carte)
// reçoit l'événement « combat » avec la cible et les résultats publics — nécessite Postgres (schéma infra) + Redis.
describe.skipIf(!process.env.DATABASE_URL || !process.env.REDIS_URL)('combat temps réel (WS/Redis)', () => {
  let app: any; const u = `r${Date.now()}`; let tk = '', attacker = 0, target = 0, mapId = 0;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = (path: string, body?: any, t?: string) =>
    app.request(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const posOf = async (id: number) => (await (await call(`/characters/${id}`, undefined, tk)).json()).pos;
  test('un coup sur un joueur de la carte émet un événement « combat » public vers les spectateurs', async () => {
    const reg = await (await call('/auth/register', { email: `${u}@x.fr`, password: 'password1' })).json(); tk = reg.token;
    attacker = (await (await call('/characters', { pseudo: `${u}a`, race: 'angel' }, tk)).json()).id;
    target = (await (await call('/characters', { pseudo: `${u}b`, race: 'angel' }, tk)).json()).id;
    const pa = await posOf(attacker), pb = await posOf(target); mapId = pa.map_id;
    let moved = false;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const)   // cas adjacent libre
      if ((await call('/actions/move', { characterId: target, x: pa.x + dx, y: pa.y + dy }, tk)).status === 200) { moved = true; break; }
    expect(moved).toBe(true);
    const sub = new Redis(process.env.REDIS_URL); sub.on('error', () => {});
    await sub.subscribe(`map:${mapId}`);
    const evt = new Promise<any>((res, rej) => {
      const t = setTimeout(() => rej(new Error(`aucun événement combat sur map:${mapId} sous 10 s`)), 10_000);
      const onMsg = (_c: any, m: string) => { const e = JSON.parse(m); if (e.type === 'combat' && e.target === target) { clearTimeout(t); sub.off('message', onMsg); res(e); } };
      sub.on('message', onMsg);
    });
    const res = await (await call('/combat/attack', { characterId: attacker, targetCharacterId: target }, tk));
    expect(res.status).toBe(200);
    const r = await res.json(), e = await evt;
    await sub.quit();
    expect(e).toMatchObject({ type: 'combat', target, killed: r.killed, missed: r.missed });
  });
});

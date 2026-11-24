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
    let moved = false; const tries: string[] = [];
    for (const d of [1, 2] as const) {   // rayon 1 puis 2 : les cases adjacentes peuvent être occupées (monstres sauvages accumulés)
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {   // case libre proche
        const mv = await call('/actions/move', { characterId: target, x: pa.x + dx * d, y: pa.y + dy * d }, tk);
        if (mv.status === 200) { moved = true; break; }
        tries.push(`${dx * d},${dy * d}:${mv.status} ${(await mv.json().catch(() => ({})))?.error ?? ''}`);
      }
      if (moved) break;
    }
    if (!moved) {   // capitale encombrée par les personnages des autres suites (trajet en ligne droite bloqué) : placement direct sur une case libre adjacente
      const { pool } = await import('../../src/lib/db'); const { terrain } = await import('../../src/game/terrain');
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const x = pa.x + dx, y = pa.y + dy;
        if (['shallow', 'deep', 'volcano'].includes(terrain(x, y, mapId).kind) || (await pool.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3', [mapId, x, y])).rowCount) continue;
        await pool.query('UPDATE positions SET map_id=$2, coord_x=$3, coord_y=$4 WHERE character_id=$1', [target, mapId, x, y]); moved = true; break;
      }
    }
    expect(moved, `cible ${target} près de ${pa.x},${pa.y} (carte ${pa.map_id}) : ${tries.join(' | ')}`).toBe(true);
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

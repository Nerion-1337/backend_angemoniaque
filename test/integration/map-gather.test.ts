import { describe, test, expect, beforeAll } from 'vitest';
import { terrain } from '../../src/game/terrain';
import { pathCost } from '../../src/game/movement';
// Parcours complet carte & récolte : déplacement, récolte sur place / à distance, ressources JSONB,
// interdits (eau profonde à pied, hors carte) et confidentialité de la zone. Nécessite Postgres + Redis (CI / stack).
// La base de dev est partagée entre suites : on choisit les cases en évitant les cases ET les chemins occupés
// (lecture de la zone en une fois), avec relance si un interlock nous coince au dernier moment.
describe.skipIf(!process.env.DATABASE_URL)('Carte & récolte intégration', () => {
  let app: any; const u = `m${Date.now()}`; let tk = '', id = 0, me: any;
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = (path: string, body?: any, t = tk, method?: string) =>
    app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  beforeAll(async () => {
    // Base de dev partagée : les suites réexécutées saturent la base (3 personnages max/compte, aire d’apparition pleine) —
    // à 503 la création est annulée (rollback), on réessaie avec un autre compte.
    for (let k = 0; k < 3; k++) {
      const reg = await call('/auth/register', { email: `${u}${k}@x.fr`, password: 'password1' });
      expect(reg.status).toBe(200);
      tk = (await reg.json()).token;
      const cr = await call('/characters', { pseudo: `${u}${k}`, race: 'human' });
      if (cr.status === 200) { id = (await cr.json()).id; break; }
    }
    expect(id).toBeTruthy(); // encore 503 : base saturée → base propre (stack down/up ou dev-reset) requise
    me = await (await call(`/characters/${id}`)).json();
    expect(me.actor).toBeTruthy();
  });
  const pos = () => me.actor.pos;
  const occupied = new Set<string>(); // cases portant une entité bloquante (pas les objets déposés : ils ne bloquent pas le trajet)
  const loadZone = async (r: number) => { occupied.clear(); for (const e of await (await call(`/map/${pos().map_id}/area?x=${pos().x}&y=${pos().y}&r=${r}`)).json()) if (e.kind !== 'item') occupied.add(`${e.x},${e.y}`); };
  const walkCells = (from: { x: number; y: number }, to: { x: number; y: number }) => { const cells: { x: number; y: number }[] = []; let { x, y } = from; while (x !== to.x || y !== to.y) { x += Math.sign(to.x - x), y += Math.sign(to.y - y); cells.push({ x, y }); } return cells; };
  const clearPath = (c: { x: number; y: number }) => walkCells(pos(), c).every(p => !occupied.has(`${p.x},${p.y}`)); // inclut la case cible
  // Case libre du bon type autour de la position courante (humains.map = 200×200), chemins compris. `maxCost` borne le
  // coût d'énergie du trajet (budget du Mortel = 50) pour rester dans le budget quelle que soit la case trouvée.
  const freeCellOf = async (kind: string, r = 12, maxCost = Infinity) => {
    if (kind !== 'deep') await loadZone(r); // la case profonde se cherche à la carte (la route borne le rayon d’aire à 25)
    for (let i = 0; i < 600; i++) {
      const rad = kind === 'deep' ? 40 : r;
      const x = pos().x + Math.floor(Math.random() * (2 * rad + 1)) - rad,
        y = pos().y + Math.floor(Math.random() * (2 * rad + 1)) - rad;
      if (x < 0 || y < 0 || x > 199 || y > 199) continue;
      if (terrain(x, y).kind !== kind || occupied.has(`${x},${y}`) || (kind !== 'deep' && !clearPath({ x, y }))) continue;
      if (pathCost({ mount: null }, pos(), { x, y }) > maxCost) continue;
      return { x, y };
    }
    throw new Error(`pas de case libre ${kind} (chemin dégagé, coût ≤ ${maxCost}) autour de ${pos().x},${pos().y}`);
  };
  // Un interlock (autre suite qui occupe une case de notre chemin au dernier moment) rend l'action 409 : on relance.
  const retry = async (n: number, fn: () => Promise<number>) => { for (let i = 0; i < n; i++) { const s = await fn(); if (s !== 409) return s; } return 409; };
  test('déplacement : se rendre à une case libre, puis hors de la carte = 409', async () => {
    let c: any; expect(await retry(25, async () => { c = await freeCellOf('plain', 12, 20); return (await call('/actions/move', { characterId: id, x: c.x, y: c.y })).status; })).toBe(200);
    me = await (await call(`/characters/${id}`)).json();
    expect([me.actor.pos.x, me.actor.pos.y]).toEqual([c.x, c.y]);
    expect((await call('/actions/move', { characterId: id, x: 9999, y: 0 })).status).toBe(409); // hors des 200×200
  });
  test('récolte sur place : la ressource de la case entre dans les ressources du personnage', async () => {
    const c = await (await call(`/map/${pos().map_id}/cell?x=${pos().x}&y=${pos().y}`)).json();
    expect(c.terrain.kind).not.toBe('deep'); // un personnage à pied ne se pose jamais dans l’eau profonde
    expect((await call('/actions/gather', { characterId: id })).status).toBe(200);
    const inv = await (await call(`/inventory/${id}`)).json();
    expect(inv.resources[c.terrain.resource]).toBeGreaterThanOrEqual(1);
  });
  test('récolte à distance : trajet + 4 énergie, la position suit, herbe +1', async () => {
    let c: any; expect(await retry(25, async () => { c = await freeCellOf('plain', 12, 20); return (await call('/actions/gather', { characterId: id, x: c.x, y: c.y })).status; })).toBe(200);
    const inv = await (await call(`/inventory/${id}`)).json();
    expect(inv.resources.herbe).toBeGreaterThanOrEqual(2);
    me = await (await call(`/characters/${id}`)).json();
    expect([me.actor.pos.x, me.actor.pos.y]).toEqual([c.x, c.y]);
  });
  test('eau profonde à pied : 409 (navire / monture volante ou aquatique requis)', async () => {
    const c = await freeCellOf('deep', 40); // la règle du parcours (case profonde + acteur à pied) bloque AVANT le trajet : déterministe
    const resp = await call('/actions/gather', { characterId: id, x: c.x, y: c.y });
    expect(resp.status).toBe(409);
    expect((await resp.json()).error).toBe('Rien à récolter ici');
  });
  test('la zone n’expose que l’état de forme + l’équipement visible, jamais les PV', async () => {
    const t2 = (await (await call('/auth/register', { email: `${u}9@x.fr`, password: 'password1' }, '', 'POST')).json()).token;
    let ok = false, id2: any, p: any;
    for (let k = 0; k < 3 && !ok; k++) { // même saturation possible pour le 2e personnage
      const cr = await call('/characters', { pseudo: `${u}9${k}`, race: 'human' }, t2);
      if (cr.status === 200) { ok = true; id2 = (await cr.json()).id; p = (await (await call(`/characters/${id2}`, undefined, t2)).json()).actor.pos; }
    }
    expect(ok).toBe(true);
    const c = await (await call(`/map/${p.map_id}/cell?x=${p.x}&y=${p.y}&details=1`)).json();
    expect(c.entity.kind).toBe('character');
    expect(['En pleine forme', 'Bon état', 'Blessé', 'Souffrant']).toContain(c.entity.health);
    expect(c.entity.chp).toBeUndefined(); expect(c.entity.visibleGear).toBeInstanceOf(Array);
  });
});

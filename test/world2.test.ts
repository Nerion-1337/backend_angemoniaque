import { test, expect } from 'vitest';
import { terrain, noiseAt, KIND_COST, BURN_DAMAGE } from '../src/game/terrain';
import { terrain2, waterTint, FRONTIER_X } from '../src/game/world2';
import { ZONES2, RESOURCES2, RES2_BY_ID } from '../src/game/resources2';
import { W2, H2, FEATURES2 } from '../src/game/angelDemonMap';
// Monde 2 (Anges & Démons) : ce qu'on VOIT sur le sol est exactement ce qu'on peut y RÉCOLTER.
const GROUP = { plain: 'plaines', forest: 'bois', mountain: 'minerai', snow: 'minerai', ether: 'minerai', volcano: 'minerai', arid: 'arides', shallow: 'eaux', deep: 'abysses' } as any;
const ZONE = Object.fromEntries(ZONES2.map(z => [z.id, z])) as any;
const all = (f: (x: number, y: number, t: any) => void) => { for (let x = 0; x < W2; x++) for (let y = 0; y < H2; y++) f(x, y, terrain(x, y, 2)); };
test('carte 300x300, branchée sur terrain() pour le monde 2', () => { expect([W2, H2]).toEqual([300, 300]); expect(terrain(150, 150, 2)).toBe(terrain2(150, 150)); expect(terrain(-1, 0, 2).kind).toBe('deep'); });
test('coûts et brûlure identiques à terrain.ts', () => { all((_x, _y, t) => { expect(t.cost).toBe((KIND_COST as any)[t.kind]); expect(t.burn).toBe(t.kind === 'volcano' ? BURN_DAMAGE : 0); }); });
test('cohérence sol / récolte : la ressource appartient à la zone de la case et à son groupe', () => {
  all((_x, _y, t) => { const z = ZONE[t.zoneId], r = RES2_BY_ID[t.resourceId];
    expect(z.kind).toBe(t.kind); expect(z.res.map((e: any) => e[0])).toContain(t.resourceId); expect(r.group).toBe(GROUP[t.kind]); expect(t.resource).toBe(r.name); expect(t.ground).toBe(z.ground); });
});
test('apparence 3D : toute ressource de sol visible a un « look » ; seules les eaux profondes n’en ont pas ; type de look ↔ type de sol', () => {
  for (const r of RESOURCES2) expect(r.look === null, r.id).toBe(r.group === 'abysses');
  all((_x, _y, t) => { const lk = RES2_BY_ID[t.resourceId].look; if (!lk) return; if (lk.k === 'tree') expect(t.kind).toBe('forest'); if (lk.k === 'plant') expect(['plain', 'arid', 'shallow']).toContain(t.kind); if (lk.k === 'ore') expect(['mountain', 'snow', 'ether', 'volcano', 'arid']).toContain(t.kind); });
});
test('chaque zone et chaque ressource existent sur la carte', () => {
  const zs = new Set<string>(), rs = new Set<string>(); all((_x, _y, t) => { zs.add(t.zoneId); rs.add(t.resourceId); });
  for (const z of ZONES2) expect(zs.has(z.id), z.id).toBe(true); for (const r of RESOURCES2) expect(rs.has(r.id), r.id).toBe(true);
});
test('deux moitiés : ressources démoniaques à l’ouest, angéliques à l’est, frontière au centre', () => {
  all((x, _y, t) => { const s = RES2_BY_ID[t.resourceId].side; if (x < 100) expect(s).toBe('demon'); if (x > 200) expect(s).toBe('ange'); if (s === 'neutre') expect(Math.abs(x - FRONTIER_X)).toBeLessThanOrEqual(40); });
  const side = (x: number) => { const c: any = {}; for (let y = 0; y < H2; y++) { const s = RES2_BY_ID[terrain(x, y, 2).resourceId].side; c[s] = (c[s] ?? 0) + 1; } return c; };
  expect(side(60).demon).toBeGreaterThan(50); expect(side(240).ange).toBeGreaterThan(50);
});
test('lave : seul type de case qui brûle, uniquement côté démons, seule source de Cœur de magma', () => {
  let n = 0; all((x, _y, t) => { expect(t.resourceId === 'coeur_magma').toBe(t.kind === 'volcano'); if (t.kind === 'volcano') { n++; expect(t.burn).toBe(10); expect(x).toBeLessThan(140); } }); expect(n).toBeGreaterThan(300);
});
test('ressources rares : semées case par case, environ leur poids', () => {
  let tot = 0, f = 0; for (let x = 0; x < W2; x++) for (let y = 0; y < H2; y++) { const t = terrain2(x, y); if (t.zoneId === 'landes_cendre') { tot++; if (t.resourceId === 'fleur_soufre') f++; } }
  expect(f / tot).toBeGreaterThan(0.03); expect(f / tot).toBeLessThan(0.07);
});
test('élévation logique cohérente avec le type de case', () => { all((x, y, t) => { const v = noiseAt(x, y, 2); if (t.kind === 'deep') expect(v).toBeLessThan(0.14); if (t.kind === 'shallow') expect(v).toBeLessThan(0.22); if (t.kind === 'plain') expect(v).toBeGreaterThan(0.235); if (['plain', 'arid'].includes(t.kind)) expect(v).toBeLessThan(0.58); if (t.kind === 'forest') expect(v).toBeGreaterThanOrEqual(0.58); }); });
test('capitales dégagées (rayon 12 en plaine), portes, arrivées 7x7 et monstres sur terre praticable', () => {
  for (const c of [FEATURES2.capitals.demon, FEATURES2.capitals.angel]) for (let dx = -8; dx <= 8; dx++) for (let dy = -8; dy <= 8; dy++) expect(terrain2(c.x + dx, c.y + dy).kind).toBe('plain');
  for (const d of FEATURES2.doors) expect(['plain', 'arid']).toContain(terrain2(d.x, d.y).kind);
  expect(FEATURES2.arrivals).toHaveLength(4);
  for (const a of FEATURES2.arrivals) for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) expect(['plain', 'arid']).toContain(terrain2(a.x + dx, a.y + dy).kind);
  expect(['deep', 'volcano']).not.toContain(terrain2(FEATURES2.monsters.balrog.x, FEATURES2.monsters.balrog.y).kind);
  expect(terrain2(FEATURES2.monsters.leviathan.x, FEATURES2.monsters.leviathan.y).kind).toBe('shallow');
});
test('accessibilité à pied SANS traverser la lave : capitale démon → portes, arrivées, frontière, capitale ange', () => {
  const seen = new Uint8Array(W2 * H2), q = [[FEATURES2.capitals.demon.x, FEATURES2.capitals.demon.y]]; seen[q[0][1] * W2 + q[0][0]] = 1;
  for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W2 || ny >= H2 || seen[ny * W2 + nx]) continue; if (['deep', 'volcano'].includes(terrain2(nx, ny).kind)) continue; seen[ny * W2 + nx] = 1; q.push([nx, ny]); } }
  const ok = (p: any) => expect(seen[p.y * W2 + p.x]).toBe(1);
  FEATURES2.doors.forEach(ok); FEATURES2.arrivals.forEach(ok); ok(FEATURES2.capitals.angel); ok(FEATURES2.monsters.balrog); ok({ x: 150, y: 150 });
});
test('eau : sombre côté démons, claire côté anges, inchangée ailleurs ; déterminisme', () => {
  const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
  expect(lum(waterTint(2, 40))).toBeLessThan(lum(waterTint(2, 150))); expect(lum(waterTint(2, 150))).toBeLessThan(lum(waterTint(2, 260))); expect(waterTint(1, 40)).toBe(0x2a7fa3);
  all((x, y, t) => { expect(terrain(x, y, 2)).toBe(t); });
});

import { test, expect } from 'vitest';
import { terrain, noiseAt, inSafeZone, FEATURES, MAP_HUMAN, BURN_DAMAGE } from '../src/game/terrain';
import { RESOURCES } from '../src/game/resources';
const all = (f: (x: number, y: number, t: any) => void) => { for (let x = 0; x < 200; x++) for (let y = 0; y < 200; y++) f(x, y, terrain(x, y, MAP_HUMAN)); };
test('Hôtel de ville exactement au milieu de la carte 200x200, sur une plaine', () => { expect(FEATURES.hotel).toEqual({ x: 100, y: 100 }); expect(terrain(100, 100, MAP_HUMAN).kind).toBe('plain'); });
test('zone sacrée : rayon 10 autour de l’hôtel, Monde des Hommes uniquement', () => {
  expect(inSafeZone(1, 100, 100)).toBe(true); expect(inSafeZone(1, 110, 90)).toBe(true); expect(inSafeZone(1, 111, 100)).toBe(false); expect(inSafeZone(1, 100, 89)).toBe(false); expect(inSafeZone(2, 100, 100)).toBe(false);
  for (let x = 90; x <= 110; x++) for (let y = 90; y <= 110; y++) expect(['plain', 'forest']).toContain(terrain(x, y, 1).kind);
});
test('4 portails, sur terre ferme', () => { expect(FEATURES.portals).toHaveLength(4); for (const p of FEATURES.portals) expect(['deep', 'shallow', 'volcano']).not.toContain(terrain(p.x, p.y, 1).kind); });
test('chaque ressource du catalogue existe sur la carte', () => { const seen = new Set<string>(); all((_x, _y, t) => t.resourceId && seen.add(t.resourceId)); for (const r of RESOURCES) expect(seen.has(r.id), r.id).toBe(true); });
test('Yggdrasil : un seul arbre de 8 cases', () => { let n = 0; all((_x, _y, t) => { if (t.resourceId === 'yggdrasil') n++; }); expect(n).toBe(8); });
test('verre-dragon uniquement dans le volcan, seul type de case qui brûle', () => { all((_x, _y, t) => { expect(t.resourceId === 'verre_dragon').toBe(t.kind === 'volcano'); expect(t.burn).toBe(t.kind === 'volcano' ? BURN_DAMAGE : 0); }); expect(BURN_DAMAGE).toBe(10); });
test('coûts : eau peu profonde 4, eau profonde infranchissable', () => { all((_x, _y, t) => { if (t.kind === 'shallow') expect(t.cost).toBe(4); if (t.kind === 'deep') expect(t.cost).toBe(99); }); });
test('élévation logique cohérente avec le type de case (mêmes seuils que le bruit d’origine)', () => { all((x, y, t) => { const v = noiseAt(x, y, 1); if (t.kind === 'deep') expect(v).toBeLessThan(0.14); if (t.kind === 'shallow') expect(v).toBeLessThan(0.22); if (t.kind === 'plain') expect(v).toBeGreaterThan(0.235); if (t.kind === 'plain' || t.kind === 'arid') expect(v).toBeLessThan(0.58); }); });
test('autres mondes : bruit procédural déterministe avec ressources', () => { expect(terrain(10, 10, 2)).toEqual(terrain(10, 10, 2)); const t = terrain(40, 40, 3); expect(t.cost).toBeGreaterThan(0); });

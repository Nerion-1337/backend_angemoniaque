import { test, expect } from 'vitest';
import { levelAt, heightParts, FLY_LEVEL } from '../src/game/levels';
import { terrain } from '../src/game/terrain';
// Hauteur → vision / portée : terrain (jamais négatif) + taille de la monture ; monture volante = niveau +6.
const find = (pred: (t: any, l: number) => boolean) => { for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) if (pred(terrain(x, y, 1), levelAt(x, y, 1))) return [x, y]; return null; };
test('niveaux (miroir du front) : sol 0, eau négative, massif 1 à 5', () => {
  const [px, py] = find(t => t.kind === 'plain')!; expect(levelAt(px, py, 1)).toBe(0);
  const [dx, dy] = find(t => t.kind === 'deep')!; expect(levelAt(dx, dy, 1)).toBe(-4);
  expect(find((t, l) => t.kind === 'mountain' && l === 5)).not.toBeNull();
});
test('heightParts : à pied sur la plaine = rien ; sommet = +5 ; monture taille 2 = +2 ; volante = +6 partout', () => {
  const [px, py] = find(t => t.kind === 'plain')!, [mx, my] = find((t, l) => t.kind === 'mountain' && l === 5)!, [dx, dy] = find(t => t.kind === 'deep')!;
  const sum = (p: any[]) => p.reduce((n, x) => n + x.value, 0);
  expect(heightParts(1, px, py, null)).toEqual([]);
  expect(sum(heightParts(1, mx, my, null))).toBe(5);
  expect(sum(heightParts(1, px, py, { name: 'Ours', size: 2 }))).toBe(2);
  expect(sum(heightParts(1, mx, my, { name: 'Titan', size: 3 }))).toBe(8);
  expect(sum(heightParts(1, dx, dy, { name: 'Raie', size: 1 }))).toBe(1);   // l'eau ne retire rien
  expect(sum(heightParts(1, mx, my, { name: 'Wyverne', flying: true, size: 3 }))).toBe(FLY_LEVEL);
});

import { test, expect } from 'vitest';
import { cellRoll, pickShare, shareTotals } from '../src/game/deposits';
// Secteurs de ressources : tirage d'UNE ressource par case selon les parts ; miroir front (test/deposits.test.js : mêmes valeurs).
test('cellRoll : déterministe, 0..99, valeurs figées (identiques au front)', () => {
  expect([cellRoll(0, 0, 1), cellRoll(12, 40, 3), cellRoll(199, 7, 25)]).toEqual([39, 66, 67]);
  const n = Array(100).fill(0); for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) n[cellRoll(x, y, 9)]++;
  expect(Math.min(...n)).toBeGreaterThan(60); expect(Math.max(...n)).toBeLessThan(140);
});
test('pickShare : parts dans l’ordre, type de case respecté, reste = terrain naturel', () => {
  const wood = { resource: 'bois', percent: 70, kind: 'forest' }, iron = { resource: 'fer', percent: 30 };
  let w = 0, i = 0, none = 0;
  for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) { const s = pickShare([wood, iron], 'forest', x, y, 4); s === wood ? w++ : s === iron ? i++ : none++; }
  expect(none).toBe(0); expect(w / 2500).toBeGreaterThan(0.65); expect(w / 2500).toBeLessThan(0.75);
  for (let x = 0; x < 50; x++) expect(pickShare([wood, iron], 'plain', x, 3, 4)).not.toBe(wood);   // bois limité à la forêt
  let nat = 0; for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) if (!pickShare([iron], 'plain', x, y, 4)) nat++;
  expect(nat / 2500).toBeGreaterThan(0.65);   // 70 % des cases gardent la ressource du terrain
});
test('shareTotals : somme par type de case (une ressource sans type compte partout)', () => {
  expect(shareTotals([{ percent: 60, kind: 'forest' }, { percent: 30 }])).toEqual({ plain: 30, forest: 90, mountain: 30, arid: 30, snow: 30, ether: 30, volcano: 30, shallow: 30, deep: 30 });
  expect(shareTotals([{ percent: 60, kind: 'forest' }, { percent: 50, kind: 'forest' }])).toEqual({ forest: 110 });
});

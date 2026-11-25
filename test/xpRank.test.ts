import { describe, test, expect } from 'vitest';
import { rankPercent, DEFAULT_RANK_DIFF } from '../src/game/xp.js';
// Écart de rang → % d'XP : ligne exacte, ligne la plus proche, bornes, égalité, table vide.
describe('rankPercent', () => {
  test('ligne exacte et bornes', () => {
    expect(rankPercent(DEFAULT_RANK_DIFF, 0)).toBe(100);
    expect(rankPercent(DEFAULT_RANK_DIFF, 1)).toBe(125);
    expect(rankPercent(DEFAULT_RANK_DIFF, -2)).toBe(50);
    expect(rankPercent(DEFAULT_RANK_DIFF, 7)).toBe(150);
    expect(rankPercent(DEFAULT_RANK_DIFF, -9)).toBe(50);
  });
  test('ligne la plus proche, égalité : la plus basse ; table vide = 100', () => {
    expect(rankPercent({ '-2': 40, '2': 160 }, 0)).toBe(40);   // égalité de distance → la ligne la plus basse
    expect(rankPercent({ '0': 100, '3': 200 }, 2)).toBe(200);
    expect(rankPercent({ '0': 100, '4': 200 }, 2)).toBe(100);
    expect(rankPercent({}, 3)).toBe(100);
  });
});

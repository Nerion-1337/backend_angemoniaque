import { test, expect } from 'vitest'; import { statUpgradeCost, pathEnergy, effectiveRank, walk, routeEnergy } from '../src/game/rules';
import { terrain } from '../src/game/terrain';
const r = { base_xp_cost: 50, numb_up: 10, multi_1: 1, multi_2: 2, multi_3: 3 };
test('coût par paliers', () => { expect(statUpgradeCost(r, 0)).toBe(50); expect(statUpgradeCost(r, 10)).toBe(100); expect(statUpgradeCost(r, 99)).toBe(150); });
test('diagonale = 1 case', () => expect(pathEnergy({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3));
test('chemin 8 directions', () => { expect(walk({ x: 0, y: 0 }, { x: 3, y: 1 })).toHaveLength(3); expect(routeEnergy({ x: 0, y: 0 }, { x: 2, y: 2 }, () => 2)).toBe(4); });
test('surcharge divine', () => expect(effectiveRank(2, 3, { 3: 2, 4: 3 })).toBe(3));
test('terrain déterministe', () => expect(terrain(10, 10)).toEqual(terrain(10, 10)));

import { test, expect } from 'vitest';
import { stepCost } from '../src/game/movement';
// Créature volante contrôlée (invocation dont le type a la locomotion « air ») : 1 énergie par case, quel que soit le terrain.
test('stepCost : volante (monture ou créature contrôlée) = 1 partout ; aquatique contrôlée = 1 sur l’eau, pas de terre ferme', () => {
  for (const kind of ['plain', 'forest', 'mountain', 'snow', 'volcano', 'shallow', 'deep']) {
    expect(stepCost({ kind, cost: 3 }, { loco: { flying: true, aquatic: false, terrestrial: true } })).toBe(1);
    expect(stepCost({ kind, cost: 3 }, { mount: { flying: true } })).toBe(1);
  }
  const fish = { loco: { flying: false, aquatic: true, terrestrial: false } };
  expect(stepCost({ kind: 'deep', cost: 99 }, fish)).toBe(1);
  expect(stepCost({ kind: 'plain', cost: 1 }, fish)).toBe(Infinity);
});

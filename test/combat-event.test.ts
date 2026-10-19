import { test, expect } from 'vitest'; import { combatEvent } from '../src/lib/events';
test('événement combat : shape publique stable (jamais les PV exacts)', () => {
  expect(combatEvent(42, true)).toEqual({ type: 'combat', target: 42, killed: true, missed: false });
  expect(combatEvent(42, false, true)).toEqual({ type: 'combat', target: 42, killed: false, missed: true });
});
test('événement combat : clé fermée (pas de champ PV/sensible)', () => {
  expect(Object.keys(combatEvent(7, true)).sort()).toEqual(['killed', 'missed', 'target', 'type']);
});

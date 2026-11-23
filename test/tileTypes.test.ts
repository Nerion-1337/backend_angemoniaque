// Section admin « Cases » : coût d'énergie et sort passif par type de case et par monde.
import { test, expect, beforeEach } from 'vitest';
import { tileCost, tileHpDelta, tilePublic, setTilesForTest, TILE_KINDS } from '../src/game/tileTypes';
import { stepCost } from '../src/game/movement';
import { KIND_COST } from '../src/game/terrain';
const row = (o: any) => ({ map_id: 1, kind: 'plain', name: 'Plaine', description: '', energy_cost: 1, spell_id: null, spell_mode: null, ...o });
beforeEach(() => setTilesForTest([]));
test('sans ligne en base : coûts du code (aucun changement de jeu)', () => {
  for (const k of TILE_KINDS) expect(tileCost(1, k, KIND_COST[k as keyof typeof KIND_COST])).toBe(KIND_COST[k as keyof typeof KIND_COST]);
  expect(tilePublic(3, 'forest')).toMatchObject({ name: 'Forêt', cost: 2, spell: null });
});
test('le coût admin est propre à chaque monde', () => {
  setTilesForTest([row({ kind: 'forest', energy_cost: 5 }), row({ map_id: 2, kind: 'forest', energy_cost: 1 })]);
  const t = { kind: 'forest', cost: 2 };
  expect(stepCost(t, { mount: null, mp: { map_id: 1 } })).toBe(5);
  expect(stepCost(t, { mount: null, mp: { map_id: 2 } })).toBe(1);
  expect(stepCost(t, { mount: null, mp: { map_id: 3 } })).toBe(2);           // monde sans ligne : défaut
  expect(stepCost(t, { mount: { flying: true }, mp: { map_id: 1 } })).toBe(1); // monture volante : 1 partout
});
test('eau profonde reste interdite à pied quel que soit le coût saisi', () => {
  setTilesForTest([row({ kind: 'deep', energy_cost: 2 })]);
  expect(stepCost({ kind: 'deep', cost: 99 }, { mount: null, mp: { map_id: 1 } })).toBe(Infinity);
});
test('sort passif : bonus = +PV, malus = -PV, sans mode ou sans dégâts = rien', () => {
  expect(tileHpDelta('bonus', 6)).toBe(6); expect(tileHpDelta('malus', 6)).toBe(-6); expect(tileHpDelta('malus', -6)).toBe(-6);
  expect(tileHpDelta(null, 6)).toBe(0); expect(tileHpDelta('bonus', 0)).toBe(0);
  setTilesForTest([row({ kind: 'snow', name: 'Pics gelés', spell_id: 4, spell_mode: 'malus', spell_name: 'Morsure du givre', spell_damage: 3 })]);
  expect(tilePublic(1, 'snow')).toMatchObject({ name: 'Pics gelés', spell: { name: 'Morsure du givre', mode: 'malus', hpPerHour: -3 } });
});

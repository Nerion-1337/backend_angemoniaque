// Lot 2 : moteur de sorts paramétrable — fonctions pures.
import { test, expect } from 'vitest';
import { Effects, isHarmful, isAlly, keepTarget, poolValue, pickTargets, hasEffects } from '../src/game/spellEffects';
const t = (kind: string, id: number, x: number, y: number, row: any = {}) => ({ kind, id, pos: { coord_x: x, coord_y: y }, row, name: `${kind}${id}`, armor: 0, magicArmor: 0, agility: 0 }) as any;
test('valeurs par défaut : cible unique, portée 4, ennemis, aucun effet ; {} = sort historique', () => {
  expect(Effects.parse({})).toMatchObject({ target: 'single', range: 4, radius: 0, affects: 'enemies', damage: 0, heal: 0, stats: [], durationH: 0 });
  expect(hasEffects({})).toBe(false); expect(hasEffects({ damage: 3 })).toBe(true);
  expect(() => Effects.parse({ stats: [{ stat: 'gold', value: 5 }] })).toThrow();
});
test('hostile = dégâts, dégâts sur la durée ou caractéristique négative', () => {
  expect(isHarmful(Effects.parse({ heal: 5 }))).toBe(false);
  expect(isHarmful(Effects.parse({ stats: [{ stat: 'energy', value: -3 }] }))).toBe(true);
  expect(isHarmful(Effects.parse({ dot: { damage: 2, hours: 3 } }))).toBe(true);
});
test('camps : même race = allié, invocation du lanceur = alliée, monstre = ennemi', () => {
  expect(isAlly('human', 1, { kind: 'character', row: { race: 'human' } })).toBe(true);
  expect(isAlly('human', 1, { kind: 'character', row: { race: 'demon' } })).toBe(false);
  expect(isAlly('human', 1, { kind: 'summon', row: { owner_id: 1 } })).toBe(true);
  expect(isAlly('human', 1, { kind: 'monster', row: {} })).toBe(false);
  expect(keepTarget('all', false)).toBe(true); expect(keepTarget('allies', false)).toBe(false); expect(keepTarget('enemies', false)).toBe(true);
});
test('réserves bornées : jamais au-delà du max ni sous le min', () => {
  expect(poolValue(40, 50, 30)).toBe(50); expect(poolValue(5, 50, -30)).toBe(0); expect(poolValue(5, 50, -30, 1)).toBe(1);
});
test('ciblage : soi / case unique / zone filtrée par camp', () => {
  const me = { id: 1, race: 'human' };
  const ents = [t('character', 1, 0, 0, { race: 'human' }), t('character', 2, 1, 0, { race: 'human' }), t('character', 3, 2, 0, { race: 'demon' }), t('monster', 9, 1, 1)];
  expect(pickTargets(Effects.parse({ target: 'self' }), me, { x: 0, y: 0 }, ents).map(x => x.id)).toEqual([1]);
  expect(pickTargets(Effects.parse({ target: 'single' }), me, { x: 2, y: 0 }, ents).map(x => x.id)).toEqual([3]);
  expect(pickTargets(Effects.parse({ target: 'area', radius: 1, affects: 'allies' }), me, { x: 1, y: 0 }, ents).map(x => x.id)).toEqual([1, 2]);
  expect(pickTargets(Effects.parse({ target: 'area', radius: 1, affects: 'enemies' }), me, { x: 1, y: 0 }, ents).map(x => x.id)).toEqual([3, 9]);
});

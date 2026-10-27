import { test, expect } from 'vitest'; import { statUpgradeCost, pathEnergy, effectiveRank, walk, routeEnergy } from '../src/game/rules';
import { terrain, BURN_DAMAGE } from '../src/game/terrain'; import { RES_BY_ID } from '../src/game/resources'; import { RES2_BY_ID } from '../src/game/resources2';
const r = { base_xp_cost: 50, numb_up: 10, multi_1: 1, multi_2: 2, multi_3: 3 };
test('coût par paliers', () => { expect(statUpgradeCost(r, 0)).toBe(50); expect(statUpgradeCost(r, 10)).toBe(100); expect(statUpgradeCost(r, 99)).toBe(150); });
test('diagonale = 1 case', () => expect(pathEnergy({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3));
test('chemin 8 directions', () => { expect(walk({ x: 0, y: 0 }, { x: 3, y: 1 })).toHaveLength(3); expect(routeEnergy({ x: 0, y: 0 }, { x: 2, y: 2 }, () => 2)).toBe(4); });
test('surcharge divine', () => expect(effectiveRank(2, 3, { 3: 2, 4: 3 })).toBe(3));
test('terrain déterministe', () => expect(terrain(10, 10)).toEqual(terrain(10, 10)));
test('ressources : le nom affiché est celui du catalogue (clé stable resourceId, 3 mondes)', () => {
  for (const mapId of [1, 2, 3]) for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) {
    const t = terrain(x, y, mapId);
    expect(t.resourceId ? (RES_BY_ID[t.resourceId] ?? RES2_BY_ID[t.resourceId]).name : null).toBe(t.resource);
  }
});
const KIND_GROUP = { plain: 'plaines', forest: 'bois', mountain: 'minerai', shallow: 'eaux', deep: 'abysses' };
test('autres mondes : la ressource suit le type de terrain (groupe du catalogue)', () => {
  for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) { const t = terrain(x, y, 3); expect(RES_BY_ID[t.resourceId].group).toBe(KIND_GROUP[t.kind]); }
});
test('nouvelles cases du Monde des Hommes : coûts (aride 2, neige/éther/volcan 3) + brûlure 10/h', () => {
  const seen: Record<string, any> = {};
  for (let x = 0; x < 200; x++) for (let y = 0; y < 200; y++) { const t = terrain(x, y, 1); if (!seen[t.kind]) { seen[t.kind] = t; if (Object.keys(seen).length === 9) break; } }
  for (const [k, c] of Object.entries({ arid: 2, snow: 3, ether: 3, volcano: 3 })) {
    expect(seen[k], k).toBeTruthy();
    if (k === 'volcano') { expect(seen[k].cost).toBe(c); expect(seen[k].burn).toBe(BURN_DAMAGE); }
  }
  for (const k of ['plain', 'forest', 'mountain', 'shallow', 'deep']) expect(seen[k].burn, k).toBe(0);
  expect(seen['arid'].cost).toBe(2); expect(seen['volcano'].resourceId).toBe('verre_dragon');
});
import { computeCharacterDamage, getPublicHealthState, computePactStatTransfer, canUseDivineEnergy, computeHitChance } from '../src/game/rules';
test('dégâts = arme × (Force − Force requise), 1 à mains nues', () => { expect(computeCharacterDamage(10, 3, 3)).toBe(21); expect(computeCharacterDamage(10, 3, null)).toBe(1); expect(computeCharacterDamage(2, 5, 3)).toBe(1); });
test('état de forme public (jamais les PV exacts)', () => { expect(getPublicHealthState(100, 100)).toBe('En pleine forme'); expect(getPublicHealthState(60, 100)).toBe('Bon état'); expect(getPublicHealthState(30, 100)).toBe('Blessé'); expect(getPublicHealthState(10, 100)).toBe('Souffrant'); });
test('transfert de pacte du dépôt', () => { const t = computePactStatTransfer(24, 16); expect(t.humanStrengthBonus).toBe(12); expect(t.etherealStrengthPenalty).toBe(6); });
test('énergie divine selon race / rang', () => { expect(canUseDivineEnergy('nephilim', 'Soldat')).toBe(true); expect(canUseDivineEnergy('human', 'Demi-Dieu')).toBe(true); expect(canUseDivineEnergy('human', 'Mortel')).toBe(false); });
test('chance de toucher (agilité)', () => { expect(computeHitChance(10, 10)).toBe(50); expect(computeHitChance(40, 5)).toBeGreaterThan(computeHitChance(5, 40)); expect(computeHitChance(200, 1)).toBe(95); });

import { stepCost, pathCost } from '../src/game/movement';
import { terrain } from '../src/game/terrain';
function find(kind: string) { for (let x = 0; x < 200; x++) for (let y = 0; y < 200; y++) if (terrain(x, y).kind === kind) return { x, y }; throw new Error(kind); }
test('eau peu profonde = 4 ; eau profonde interdite à pied / monture terrestre', () => { const sh = terrain(find('shallow').x, find('shallow').y), dp = terrain(find('deep').x, find('deep').y);
  expect(stepCost(sh, { mount: null })).toBe(4); expect(stepCost(dp, { mount: null })).toBe(Infinity); expect(stepCost(dp, { mount: { flying: false, aquatic: false } })).toBe(Infinity); });
test('navire / monture aquatique : l\'eau seulement ; monture volante : partout', () => { const dp = terrain(find('deep').x, find('deep').y), pl = terrain(find('plain').x, find('plain').y);
  expect(stepCost(dp, { mount: { aquatic: true } })).toBe(1); expect(stepCost(pl, { mount: { aquatic: true } })).toBe(Infinity); expect(stepCost(dp, { mount: { flying: true } })).toBe(1); expect(stepCost(pl, { mount: { flying: true } })).toBe(1); });
test('relief : plus de forêts, montagnes et eaux', () => { const c: any = {}; for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) { const k = terrain(x, y, 3).kind; c[k] = (c[k] ?? 0) + 1; } for (const k of ['plain', 'forest', 'mountain', 'shallow', 'deep']) expect(c[k]).toBeGreaterThan(300); });
import { applyArmor } from '../src/game/rules';
test('dégâts : exemples du cahier des charges', () => {
  expect(computeCharacterDamage(10, 2, 5)).toBe(40);        // Force 10, épée 5 dégâts / 2 Force requise : 5 × (10 − 2) = 40
  expect(computeCharacterDamage(10, 2 + 5, 5)).toBe(15);    // + armure demandant 5 Force : 5 × (10 − 7) = 15
});
test('l\'armure réduit directement les dégâts (minimum 1)', () => { expect(applyArmor(40, 10)).toBe(30); expect(applyArmor(15, 20)).toBe(1); expect(applyArmor(45, 0)).toBe(45); });

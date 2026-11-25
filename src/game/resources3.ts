// Royaume des Morts (carte 3) : ses TROIS ressources uniques, absentes des autres mondes, sur très peu de cases (≈ 0,5 % des cases de
// leur type). Aucune ressource des autres mondes n'y pousse. Copie identique : back/src/game/resources3.ts et front/src/lib/resources3.js.
export const RESOURCES3 = [
  { id: 'asphodele_spectrale', name: 'Asphodèle spectrale', group: 'plaines', kind: 'plain', color: '#d6e4ff', rarity: 'unique',
    where: 'Royaume des Morts : quelques touffes isolées dans les plaines grises.', look: { k: 'plant', c: 0xd6e4ff, shape: 0 } },
  { id: 'saule_lamentations', name: 'Saule des Lamentations', group: 'bois', kind: 'forest', color: '#8fa3ad', rarity: 'unique',
    where: 'Royaume des Morts : de rares saules au cœur des forêts mortes.', look: { k: 'tree', leaf: 0x8fa3ad, bark: 0x2f2a33 } },
  { id: 'ame_cristallisee', name: 'Âme cristallisée', group: 'minerai', kind: 'mountain', color: '#7ff5e1', rarity: 'unique',
    where: 'Royaume des Morts : quelques veines luminescentes dans les massifs.', look: { k: 'ore', c: 0x7ff5e1, e: 0x2ad6c0 } },
];
export const RES3_BY_ID = Object.fromEntries(RESOURCES3.map(r => [r.id, r]));
/** Part des cases de leur type qui portent une ressource du Royaume des Morts. */
export const RARE3 = 0.005;

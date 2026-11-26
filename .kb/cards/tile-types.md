---
title: Types de case éditables par monde (admin « Cases ») : coût, description, sort passif
slug: tile-types
status: done
updated: 2026-11-26
files:
  - src/game/tileTypes.ts
  - src/routes/admin/tiles.ts
symbols:
  - src/game/tileTypes.ts:loadTiles
  - src/game/tileTypes.ts:tileCost
  - src/game/tileTypes.ts:applyTileSpells
  - src/routes/admin/tiles.ts:tileRoutes
tests:
  - test/tileTypes.test.ts
  - test/integration/tiles.test.ts
---
## Purpose
Types de case éditables par monde (admin « Cases ») : nom, description, coût d'énergie d'un pas et sort passif appliqué en continu
aux personnages qui s'y tiennent. La géométrie des cartes reste générée dans le code.

## Business rules
- Un type de case par (monde, kind) ; sans ligne en base, les constantes du code s'appliquent (aucun changement de jeu à la migration).
- Le coût d'un pas = coût du type de case DE CE MONDE (0 à 99) ; l'eau profonde reste interdite à pied quel que soit le coût ; invocation montée volante = 1 partout.
- Sort passif : bonus = +|dégâts du sort| PV par heure, malus = −|dégâts| ; dégâts 0 ou mode absent = aucun effet ; PV bornés à [1, PV max] (jamais mortel).
- L'effet s'applique au tick horaire, aux PERSONNAGES non bloqués seulement (pas aux monstres ni aux invocations).
- Un sort exige un mode bonus/malus (400) et doit exister (404) ; kind inconnu → 400 ; type absent du monde → 404.
- La carte de case du jeu reçoit `tile` (nom, description, coût, sort) ; `/map/{id}/tile-types` donne les 9 kinds du monde.
- Cache 30 s, invalidé à chaque écriture admin sur l'instance ; les autres instances suivent sous 30 s.

## Gotchas
- La brûlure du volcan est indépendante du sort de case.
- Le front duplique les coûts (`lib/tiles.js`) pour l'estimation affichée : garder la même règle.
- Un test qui crée un sort doit le supprimer (`features.test.ts` compte les sorts).

## Tests
`test/tileTypes.test.ts` (défauts, coût par monde dans `stepCost`, volante, eau profonde, bonus/malus) ; `test/integration/tiles.test.ts` (9/9/5 types, 403, validations, coût payé par `/actions/move`, malus −7 / bonus +7 / plancher 1).

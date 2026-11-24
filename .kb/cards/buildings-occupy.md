---
title: Bâtiments : case occupable, bonus et protections de l’occupant, armure, sorts de la structure
slug: buildings-occupy
status: done
updated: 2026-11-24
files:
  - src/game/buildingCell.ts
  - src/routes/admin/buildings.ts
  - src/game/spellTick.ts
symbols:
  - src/game/buildingCell.ts:occupiableAt
  - src/game/buildingCell.ts:checkOccupantAttack
  - src/game/buildingCell.ts:BLOCKING
  - src/game/spellTick.ts:hourlyBuildingSpells
tests:
  - test/integration/buildings.test.ts
---
## Purpose
Bâtiments paramétrables : armure de la structure, case occupable par un personnage (bonus d'armure, de vue, de portée ; règles
d'attaque contre l'occupant), production horaire, sorts de la structure (actifs pour le propriétaire, passifs chaque heure).

## Business rules
- `structure` = points de vie de la structure, `armor` = son armure ; les structures ne sont pas encore attaquables (valeurs stockées).
- Un bâtiment NON occupable bloque sa case ; un bâtiment occupable laisse UN personnage (ou une entité) s'y tenir (`BLOCKING` exclut ces bâtiments des contrôles de trajet).
- Unicité en base : une entité au plus par case, un bâtiment au plus par case (deux index).
- Occupant : vue + `bonus_see`, portée + `bonus_range`, armure + `bonus_armor`.
- Attaque d'un occupant : refusée (403) si `occupant_attack[type]` est faux — corps à corps = distance finale ≤ 1 (portée de l'attaquant ≤ 1 ou cible adjacente), distance = au-delà, sort = tout sort hostile (attaque historique ou effet hostile du moteur). Les sorts bénéfiques restent possibles.
- Sorts ACTIFS d'un bâtiment : lançables par son PROPRIÉTAIRE quand il est sur la case ou à côté (source « bâtiment »).
- Sorts PASSIFS : chaque heure, depuis la case du bâtiment ; zone = entités dans le rayon (camp relatif à la race du propriétaire), sinon l'occupant ; un effet hostile ne touche jamais un personnage en zone sacrée ni un occupant protégé contre les sorts.
- Production : `data.production` / `data.collection` (par ressource et par heure) créditent le propriétaire, plafonnés par `data.storage`.
- `/map/{id}/cell` renvoie l'entité avant le bâtiment quand la case est occupée.

## Gotchas
- Toute nouvelle vérification « case occupée » pour un trajet doit utiliser `BLOCKING`, sinon les bâtiments occupables redeviennent des murs.
- Les tests qui placent un personnage près d'une capitale doivent le poser directement (cases encombrées par les autres suites en parallèle).

## Tests
`test/integration/buildings.test.ts` (mur bloquant, entrée sur une tour occupable, bonus vue / portée, corps à corps et sort refusés, distance autorisée, sort passif de zone, sort actif du propriétaire seulement).

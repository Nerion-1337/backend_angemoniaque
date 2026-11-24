---
title: Guilde : intégrité du dernier Chef + renommage des rangs
slug: guild-ranks-integrity
status: done
updated: 2026-11-24
files:
  - src/routes/guilds.ts
  - test/integration/guild-ranks.test.ts
symbols:
  - src/routes/guilds.ts:lastChef
tests:
  - test/integration/guild-ranks.test.ts
---
## Purpose
Intégrité des rangs de guilde : une guilde n'est jamais sans Chef ; le Chef renomme les rangs (y compris le sien) avec
répercussion sur les droits du forum ; la liste des membres expose leur rang de jeu.

## Business rules
- Le DERNIER détenteur d'un rang Chef (`is_leader`) ne peut ni quitter la guilde ni passer à un rang non-Chef (409), même seul membre.
- Un Chef peut partir dès qu'un autre membre détient un rang Chef.
- Seul le Chef nomme des Chefs (403).
- Renommer : Chef seul (403), 2 à 24 caractères après trim (400), nom unique dans la guilde (409) ; le libellé du rang Chef est renommable.
- Le renommage réécrit `visible_ranks` et `write_ranks` des catégories et sujets qui citent l'ancien nom.
- L'autorité vient du RANG Chef ; `guilds.leader_id` (fondateur) n'est jamais lu par les règles.
- Les membres exposent `game_rank` (nom du palier de jeu, null sans spécialisation).

## Gotchas
- Les droits du forum sont stockés par NOM de rang : sans la cascade, un renommage casse lecture et écriture.
- `visible_ranks`/`write_ranks` sont des `TEXT[]` : passer un tableau JS, jamais `JSON.stringify` (« malformed array literal »).
- Pas de dissolution d'une guilde d'une personne via « quitter ».

## Tests
`test/integration/guild-ranks.test.ts` (dernier Chef bloqué, second Chef libère, transmission, renommages dont le Chef) ; `features.test.ts` (nomination, droits, candidatures).

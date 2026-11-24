---
title: Guilde : ordre persisté des rangs, label Chef renommable, visibilités par défaut dynamiques
slug: guild-ranks-order
status: done
updated: 2026-11-24
files:
  - src/routes/guilds.ts
  - test/integration/guild-ranks-order.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-ranks-order.test.ts
---
## Purpose
Ordre d'affichage persistant des rangs de guilde, réordonnancement par le Chef, nouveaux rangs en fin de liste, et visibilité
par défaut du forum qui suit le nom réel du rang Chef.

## Business rules
- Rangs triés par `sort_order` puis id ; un nouveau rang arrive en dernier (`max + 1`).
- Réordonner les rangs : Chef seul (403) ; ids d'une autre guilde sans effet.
- Une catégorie créée sans rang choisi est visible du rang Chef SOUS SON NOM ACTUEL (`leaderRankName`), jamais d'un « Chef » codé en dur.
- Un sujet créé sans choix hérite de la lecture de sa catégorie (card `guild-forum-perms`).
- « Rang le plus bas » (arrivée d'un membre) reste défini par l'id, pas par l'ordre d'affichage.

## Gotchas
- Le libellé Chef renommable n'est sûr qu'avec `leaderRankName` : garder les deux ensemble.
- Les modales du front initialisent leurs choix de rangs au montage : rouvrir après un renommage.

## Tests
`test/integration/guild-ranks-order.test.ts` (rang ajouté en dernier, 403 non-Chef, ordre persistant, renommage du Chef suivi par le défaut du forum) ; `guild-ranks.test.ts`.

---
title: Guilde : ordre d'affichage et réorganisation du forum
slug: guild-forum-order
status: done
updated: 2026-11-24
files:
  - src/routes/guilds.ts
  - test/integration/guild-forum.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-forum.test.ts
---
## Purpose
Ordre d'affichage du forum de guilde (catégories, et sujets dans une catégorie), persistant et identique pour tous les membres.

## Business rules
- Réordonner catégories et sujets exige `create_topics` (pas réservé au Chef : le rang Membre l'a par défaut).
- L'ordre envoyé est complet : `sort_order = position` de chaque id ; un id d'une autre guilde est sans effet ; catégorie inconnue pour les sujets → 404.
- Affichage trié par `sort_order` puis id ; les nouveaux éléments arrivent en fin de liste (`max + 1`).
- L'ordre des sujets n'a de sens qu'à l'intérieur d'une catégorie.
- Une catégorie invisible pour un membre disparaît de sa liste sans décaler les autres.

## Gotchas
- Une requête de réordonnancement = n petits UPDATE dans une transaction : prévu pour l'échelle d'une guilde (≤ 200 ids).

## Tests
`test/integration/guild-forum.test.ts` (ordre initial par id, réordonnancement des catégories et sujets, Membre autorisé, rang sans droit 403, 404, ids étrangers ignorés).

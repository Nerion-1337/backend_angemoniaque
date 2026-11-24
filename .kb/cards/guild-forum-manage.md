---
title: Guilde : suppression en cascade et transfert de sujet du forum
slug: guild-forum-manage
status: done
updated: 2026-11-24
files:
  - src/routes/guilds.ts
  - test/integration/guild-forum-manage.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-forum-manage.test.ts
---
## Purpose
Gestion du forum de guilde : suppression d'une catégorie (avec ses sujets, messages et états de lecture) ou d'un sujet,
réservée au Chef ; transfert d'un sujet vers une autre catégorie pour les gestionnaires.

## Business rules
- Supprimer une catégorie ou un sujet : Chef SEUL (un Officier « tous droits » reçoit 403 « Réservé au Chef ») ; 404 si inconnu ou d'une autre guilde.
- Suppression en cascade dans une seule transaction : messages → états de lecture → sujets → catégorie.
- Transférer un sujet : `create_topics` (Chef inclus) ; 404 sujet ou catégorie cible inconnus ; même catégorie = 200 sans effet.
- Le sujet transféré arrive EN DERNIER dans la cible ; ses messages et ses droits propres le suivent.

## Gotchas
- Les FK du schéma n'ont pas d'`ON DELETE CASCADE` : toute nouvelle table enfant de `guild_topics`/`guild_folders` doit être ajoutée à la cascade manuelle (sinon 500).
- Le transfert ne réordonne pas la cible ; l'ordre fin passe par `/guilds/reorder` (card `guild-forum-order`).

## Tests
`test/integration/guild-forum-manage.test.ts` (suppressions : refus des non-Chefs, voisins intacts, 404 après ; transfert : refus sans `create_topics`, arrivée en dernier, message qui suit, 404, sans effet).

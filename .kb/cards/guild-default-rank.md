---
title: Guilde : rang par défaut des nouveaux arrivants (option unique default_rank_id)
slug: guild-default-rank
status: done
updated: 2026-11-24
files:
  - src/routes/guilds.ts
  - test/integration/guild-default-rank.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-default-rank.test.ts
---
## Purpose
Le Chef choisit UN rang par défaut attribué aux nouveaux membres (candidature acceptée ou invitation acceptée) ; sans choix,
le nouveau membre reçoit le rang non-Chef le plus bas (comportement historique).

## Business rules
- Un seul rang par défaut par guilde : colonne `guilds.default_rank_id` (NULL = automatique), jamais un drapeau sur `guild_ranks`.
- Seul le Chef règle l'option (403 sinon) ; le rang doit appartenir à la guilde (404) ; le rang Chef ne peut pas être le rang par défaut (400).
- Arrivée d'un membre : rang par défaut s'il est toujours valide pour la guilde, sinon `lowestRank` (rang non-Chef le plus bas).
- `rankId: null` remet le mode automatique.

## Gotchas
- Une valeur périmée (rang supprimé ou d'une autre guilde) retombe sur `lowestRank` : elle ne bloque jamais un arrivant.
- Pas d'ON DELETE sur la FK : si une route de suppression de rang apparaît, mettre le défaut à NULL ou en cascade.
- Autoriser un jour le Chef comme défaut exige de changer ensemble `joinRank` et la route (400).

## Tests
`test/integration/guild-default-rank.test.ts` (automatique → Membre, 403 non-Chef, Officier par défaut appliqué au suivant, Chef refusé 400, rang étranger 404, retour automatique).

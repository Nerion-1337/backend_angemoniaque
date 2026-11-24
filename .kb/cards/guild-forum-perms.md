---
title: Guilde : forum v2 — permissions granulaires Voir/Écrire, héritage, non-lus, édition
slug: guild-forum-perms
status: done
updated: 2026-11-24
files:
  - src/routes/guilds.ts
  - test/integration/guild-forum-perms.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-forum-perms.test.ts
---
## Purpose
Droits du forum de guilde par rang : lecture (`visible_ranks`) et écriture (`write_ranks`) sur chaque catégorie et chaque sujet,
avec héritage sujet ← catégorie, filtrage des listes, refus des écritures sans droit, compteurs de non-lus.

## Business rules
- Catégorie : lecture vide à la création → `[rang du Chef]` ; écriture omise → égale à la lecture (« qui voit écrit ») ; écriture `[]` = personne sauf le Chef.
- Sujet : lecture `[]` = hérite de la catégorie ; écriture `NULL` = hérite de la catégorie ; écriture `[]` = personne sauf le Chef.
- Créer un sujet exige le droit d'écriture de la catégorie ; répondre exige l'écriture effective du sujet ; sinon 403. Le Chef passe toujours.
- Créer une catégorie et réordonner exigent `create_topics`.
- Régler les droits : Chef seul ; noms de rangs existants (400) ; écriture ⊆ lecture effective (400 ; pour un sujet qui hérite, la lecture de la catégorie).
- Sujet inconnu OU illisible pour l'appelant → 404.
- Non-lus : messages des AUTRES depuis la dernière ouverture, seulement dans les sujets lisibles ; badge de catégorie = somme ; ouvrir un sujet le marque lu ; seules les valeurs non nulles sont renvoyées.
- Renommer un rang réécrit lecture ET écriture des catégories et sujets (un `NULL` reste `NULL`).

## Gotchas
- Trois sens du « vide » volontaires : lecture `[]` = hérite, écriture `[]` = personne, écriture `NULL` = hérite. Ne jamais « nettoyer » l'un en l'autre.
- Le schéma Zod de `writeRanks` à la création d'un sujet est `optional()` sans défaut : un `.default([])` bloquerait l'écriture à tous.
- `checkPerms` doit rester `await` (sinon le 400 n'empêche pas l'UPDATE et le client reçoit 200).
- Le COUNT des non-lus est casté `::int` (sinon chaîne).

## Tests
`test/integration/guild-forum-perms.test.ts` (droit d'écriture de catégorie, héritage de lecture, surcharge d'écriture, écriture ⊄ lecture 400, non-Chef 403, non-lus 2 → 0 → 1, badge cumulé, édition).

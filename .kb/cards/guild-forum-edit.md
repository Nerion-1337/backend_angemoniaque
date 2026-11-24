---
title: Guilde : droits d'édition des catégories et sujets (auteur / create_topics / écriture catégorie)
slug: guild-forum-edit
status: done
updated: 2026-11-24
files:
  - src/routes/guilds.ts
  - test/integration/guild-forum-edit.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-forum-edit.test.ts
---
## Purpose
Droit de modifier un sujet du forum de guilde (titre, description) : auteur, gestionnaires, rangs qui écrivent dans la
catégorie parente et Chef ; modification des catégories réservée aux gestionnaires.

## Business rules
- Modifier un sujet : autorisé à l'AUTEUR (par id), aux détenteurs de `create_topics`, aux rangs du droit d'écriture de la CATÉGORIE parente, et au Chef ; sinon 403 « Vous ne pouvez pas modifier ce sujet ».
- Le droit d'écriture lu est celui de la catégorie, jamais la surcharge du sujet : poster et modifier sont deux droits distincts.
- Modifier une catégorie : `create_topics` seulement (le Chef passe).
- Sujet inconnu ou d'une autre guilde → 404 AVANT le contrôle de droit (pas de divulgation d'existence).
- Champ omis = conservé ; description `''` = effacée.
- Création d'un rang : `permissions` ne retient que les 4 clés connues ; `{}` ou `{create_topics:false}` = aucun droit.

## Gotchas
- L'auteur est reconnu par son id : renommer un personnage ne donne ni ne retire de droit.
- Le front ne fait que refléter la règle (crayon masqué) ; le serveur décide.

## Tests
`test/integration/guild-forum-edit.test.ts` (catégorie : Membre 200, rangs sans droit 403, Chef 200 ; sujet : auteur, gestionnaire, écriture de catégorie, refus 403, 404).

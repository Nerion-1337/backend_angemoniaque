---
title: Admin « Joueurs » (liste paginée + fiche éditable) et objets divins à familles libres
slug: admin-players-divine
status: done
updated: 2026-11-26
files:
  - src/routes/admin/players.ts
  - src/routes/admin/items.ts
  - src/game/content.ts
symbols:
  - src/routes/admin/players.ts:EDITABLE
  - src/routes/admin/players.ts:playerRoutes
  - src/routes/admin/items.ts:itemRoutes
  - src/game/content.ts:divineCap
tests:
  - test/integration/adminPlayersDivine.test.ts
  - test/content.test.ts
---
## Purpose
Section admin « Joueurs » (liste paginée par race, fiche éditable : caractéristiques, XP, or, rang, objets équipés / sac / coffre,
sorts, bâtiments, divins ; plus de montures) et objets divins gérés comme les autres objets, rattachés à des familles plafonnées.

## Business rules
- Liste : 20 par page (max 100), filtre race et recherche pseudo/e-mail, effectifs par race.
- Fiche : caractéristiques modifiées en valeur ABSOLUE, entiers ≥ 0 (négatif → 400) ; le rang doit appartenir à la race du joueur (400) ; changer de rang applique l'écart de base entre paliers (`applySpec`, card `rank-up`), sauf aux caractéristiques saisies dans la même requête (valeur saisie prioritaire).
- Ajout d'objet : au sac ou au coffre, empilé sur la ligne existante du même emplacement (jamais sur une pièce équipée) ; retrait d'une ligne par emplacement (404 si absent).
- Supprimer un bâtiment du joueur supprime aussi sa position sur la carte.
- Libérer un exemplaire divin le rend libre, sans gardien.
- Objet divin = objet du catalogue de rareté « divin » + famille ; une famille exige la rareté divin (400) et doit exister (404).
- Famille : clé `^[a-z][a-z0-9_]{1,29}$` ; plafond = nombre max d'exemplaires (NULL = illimité) ; plafond < exemplaires existants → 409.
- Relique, arcane, artefact ne sont pas supprimables (règles du jeu) ; une famille encore utilisée non plus (409).
- Exemplaires : créés dans la limite du plafond de la famille (409) ; un exemplaire détenu ne se supprime pas (409) ; un objet avec exemplaires ne se supprime pas (409).
- `divineCap` lit la famille, sinon `game_config.divine_caps`.
- Objets : `shop_races` (races qui le voient en boutique, [] = toutes) en plus de `shop` / `shop_stock` (card `craft-shop`).
- Fiche joueur : `map_worlds` (mondes dont il a la carte des ressources ; liste dédoublonnée et triée) modifiable par PUT ; objets : champ `two_handed`.

## Gotchas
- Seules relique/arcane/artefact donnent des rangs par race ; une famille libre est un objet unique sans effet de rang ; `monsters.guards_item` reste limité à ces 3.
- `character_items` n'a pas de clé : les retraits ciblent une ligne par `ctid`.
- Un nouveau personnage a déjà des objets de départ : tester l'empilement à partir de la quantité existante.

## Tests
`test/integration/adminPlayersDivine.test.ts` (reprise des exemplaires, famille libre + plafond, refus de suppression, pagination, filtre, 403, fiche complète) ; `test/content.test.ts` (`divineCap`).

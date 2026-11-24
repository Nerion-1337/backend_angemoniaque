---
title: Admin « Joueurs » (liste paginée + fiche éditable) et objets divins à familles libres
slug: admin-players-divine
status: done
updated: 2026-11-24
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
Deux fonctions du back-office : (1) la section **Joueurs** — liste paginée de tous les personnages par race et fiche
complète éditable (caractéristiques, XP, or, rang, objets du sac / équipés / coffre-fort, sorts, montures, bâtiments,
objets divins) ; (2) les **objets divins** gérés comme les autres objets (ligne `items` de rareté « divin ») rattachés à
une **famille** (relique / arcane / artefact + familles libres créées en admin, avec plafond), les exemplaires uniques
restant des lignes `divine_items`.

## How it works
- `GET /admin/players?race=&q=&page=&per=` → `{ total, page, per, pages, races:[{race,n}], rows }` (rows : pseudo, race,
  rang `specializations.name/current_rank`, position, XP, or, bloqué, e-mail ; tri race puis pseudo ; per ≤ 100).
- `GET /admin/players/{id}` → `{ character, ranks (de sa race), items (place = equipped | bag | chest), spells, mounts, buildings, divine }`.
- `PUT /admin/players/{id}` : valeurs ABSOLUES des colonnes `EDITABLE` (entiers ≥ 0) + `specialization_id` (doit être de la race) ; audit before/after.
- Objets : `POST /admin/players/{id}/items {itemId, qty, place: bag|chest}` (empile sur la ligne existante du même emplacement,
  hors équipement) ; `DELETE /admin/players/{id}/items/{itemId}?place=bag|chest|equipped` (une ligne, par `ctid`).
- `DELETE …/spells/{spellId}`, `…/mounts/{mountId}`, `…/buildings/{buildingId}` (supprime aussi la position), `POST …/divine/{divineId}/release`.
  Ajouts de sort / monture / divin : route historique `POST /admin/players/{id}/grant`.
- Divins : `GET/POST/PUT/DELETE /admin/content/divine-families[/{key}]` (clé `^[a-z][a-z0-9_]{1,29}$`, plafond `cap` NULL = illimité ;
  relique/arcane/artefact non supprimables ; plafond < exemplaires existants → 409). `items.divine_family` validé (`checkFamily`) :
  famille existante et rareté « divin ». `GET /admin/content/items` ajoute `copies`, `family_name`, `family_cap` et compte les
  exemplaires détenus dans `holders`. `POST /admin/content/divine {itemId, n}` crée n exemplaires de l'objet (famille = celle de
  l'objet, plafond de la famille) ; `{kind, n}` reste accepté (rattaché au premier objet de la famille). `DELETE /admin/content/divine/{id}`
  seulement si non détenu (nettoie `monster_loot`).
- `divineCap(kind)` lit `divine_families.cap` (ligne dont `key` = kind), repli `game_config.divine_caps`.

## Entry points
Front : `src/admin/PlayersTab.jsx`, `src/admin/ItemsTab.jsx` + `Divine.jsx` (card front `admin-players-divine-ui`).
`grantDivine` / `die` / portes (`game/divine.ts`, `routes/divine.ts`) inchangés : ils utilisent toujours `divine_items.kind`.

## Data flow
Lit/écrit `characters`, `character_items` (pas de PK : ciblage par `ctid`), `character_spells`, `character_mounts`, `buildings`
+ `positions`, `divine_items`, `divine_families`, `items` ; audit `player.*`, `divine_family.*`, `divine.*`. Schéma : infra
`db/16_familles_divines.sql` (card infra `divine-families-schema`).

## Tests
`test/integration/adminPlayersDivine.test.ts` : reprise (aucun exemplaire sans objet, 3 familles du jeu), nouvelle famille + objet
divin au format standard + plafond 409, suppressions refusées (famille utilisée / du jeu / plafond < exemplaires) ; liste paginée,
filtre race + recherche, 403 joueur ; fiche : PUT absolu (négatif → 400), sac empilé, coffre, sort, monture, divin attribué puis libéré.
`test/content.test.ts` : `divineCap` lit d'abord les familles, repli `game_config`.

## Gotchas
- `GET /admin/players` renvoie désormais un objet paginé (plus un tableau) : aucun appelant historique dans le front.
- Les règles de jeu par race (`KIND` dans `game/divine.ts`) ne connaissent que relique/arcane/artefact : une famille libre est un
  objet unique sans effet de rang. `monsters.guards_item` reste limité à ces 3 familles.
- Un nouveau personnage reçoit des objets de départ dans le sac : tout test d'empilement doit partir de la quantité existante.
- Supprimer un objet divin exige d'abord de supprimer ses exemplaires (409).

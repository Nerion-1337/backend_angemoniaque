---
title: Types de case éditables par monde (admin « Cases ») : coût, description, sort passif
slug: tile-types
status: done
updated: 2026-11-23
files:
  - src/game/tileTypes.ts
  - src/routes/admin/tiles.ts
symbols:
  - src/game/tileTypes.ts:loadTiles
  - src/game/tileTypes.ts:tileCost
  - src/game/tileTypes.ts:applyTileSpells
  - src/routes/admin/tiles.ts:tileRoutes
tests:
  - test/tileTypes.test.ts
  - test/integration/tiles.test.ts
---
## Purpose
Rend les **types de case** éditables par monde depuis l'admin (section « Cases ») : nom, description, coût d'énergie
d'un pas et, en option, un **sort appliqué en continu** (bonus/malus de PV à chaque tick horaire) aux personnages qui s'y tiennent.
La géométrie des cartes (quel type sur quelle case) reste générée dans le code (`humanMap`, `world2`, bruit procédural).

## How it works
- `tileTypes.ts` : cache mémoire `Map<"map:kind", TileType>` lu dans `tile_types` (+ nom/dégâts du sort), TTL 30 s ; `invalidateTiles()`
  après une écriture admin sur cette instance (les autres instances convergent en ≤ 30 s). Table absente → cache vide + avertissement unique.
- `tileCost(mapId, kind, def)` : coût admin du monde, sinon `def` (= `KIND_COST` via `t.cost`). `movement.ts` `stepCost` l'utilise
  (`a.mp.map_id`) ; `actor()` appelle `await loadTiles()` pour que `stepCost`/`pathCost` restent synchrones avec un cache chaud.
- `tileHpDelta(mode, damage)` : bonus = +|damage|, malus = -|damage| PV/heure ; `applyTileSpells()` (appelée par `hourlyTick`) groupe
  les personnages non bloqués par delta et fait `hp_current = LEAST(hp_max, GREATEST(1, hp_current+delta))`.
- `tilePublic(mapId, kind)` : `{kind, name, description, cost, spell:{name, mode, hpPerHour}|null}` pour le jeu.
- `routes/admin/tiles.ts` : `GET /admin/content/tiles` (toutes les lignes + `map_name`, `spell_name/kind/damage`),
  `PUT /admin/content/tiles/{mapId}/{kind}` (Zod : name 1..80, description ≤ 500, energyCost 0..99, spellId?, spellMode? ; sort sans mode → 400,
  sort inconnu → 404, type inconnu → 400 / absent du monde → 404) ; audit `tile.update` (before/after) + `bumpContent`.

## Entry points
- Admin : `GET/PUT /admin/content/tiles…` (front `src/admin/TilesTab.jsx`, card front `admin-tiles-ui`).
- Jeu : `GET /map/{mapId}/cell` renvoie `tile: tilePublic(...)` ; `GET /map/{mapId}/tile-types` (les 9 kinds, défauts si absents) pour l'estimation d'énergie du front.
- `movement.ts:stepCost` (tous les trajets : move/approach/gather/attaques à distance/construction) ; `routes/tick.ts:hourlyTick` → `applyTileSpells`.

## Data flow
Lit `tile_types` (+ `spells`), `characters` ⨝ `positions` ; écrit `tile_types` (admin), `characters.hp_current` (tick), `admin_audit`.
Schéma : migration infra `db/15_types_de_case.sql` (card infra `tile-types-schema`), seedée avec les valeurs du code → aucun changement de jeu à l'application.

## Tests
- `test/tileTypes.test.ts` (unit) : défauts = `KIND_COST`, coût propre à chaque monde dans `stepCost`, monture volante = 1, eau profonde
  infranchissable à pied quel que soit le coût, `tileHpDelta` et `tilePublic`.
- `test/integration/tiles.test.ts` (DB) : 9/9/5 types par monde, 403 joueur, validations 400/404, coût + nom édités visibles dans `/map/1/cell`
  et `/map/1/tile-types` et payés par `/actions/move`, malus -7 PV / bonus +7 / plancher 1 PV via `applyTileSpells`. Restaure les lignes et supprime son sort.

## Gotchas
- `deep` : le coût saisi est affiché mais l'eau profonde reste **interdite à pied** (règle `stepCost`), monture volante = 1 partout, aquatique inchangée.
- La brûlure du volcan (`burn.ts`, `BURN_DAMAGE`) est indépendante du sort de case.
- L'effet passif = `spells.damage` par heure : un sort à 0 dégât n'a aucun effet. Il ne s'applique qu'aux **personnages** (pas monstres/invocations).
- Base partagée en test : `features.test.ts` compte les sorts (4) → tout test qui crée un sort doit le supprimer.
- Les coûts sont aussi dupliqués côté front (`front/src/lib/tiles.js`, alimenté par `/map/{id}/tile-types`) : garder la même règle.


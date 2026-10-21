---
title: Procedural map & terrain: resources, movement rules, spawn, map/action routes
slug: map-terrain-gather
status: done
updated: 2026-10-21
files:
  - src/game/terrain.ts
  - src/game/humanMap.ts
  - src/game/resources.ts
  - src/game/burn.ts
  - src/game/movement.ts
  - src/game/spawn.ts
  - src/routes/map.ts
  - src/routes/actions.ts
  - src/routes/inventory.ts
symbols:
  - src/game/terrain.ts:terrain
  - src/game/terrain.ts:noiseAt
  - src/game/terrain.ts:inSafeZone
  - src/game/terrain.ts:FEATURES
  - src/game/resources.ts:RES_BY_ID
  - src/game/burn.ts:ignite
  - src/game/movement.ts:stepCost
  - src/game/movement.ts:travel
  - src/game/movement.ts:spend
  - src/game/movement.ts:actor
  - src/game/spawn.ts:freeCell
  - src/game/spawn.ts:spawn
  - src/routes/map.ts:mapRoutes
  - src/routes/actions.ts:actions
tests:
  - test/rules.test.ts
  - test/world.test.ts
  - test/integration/map-gather.test.ts
---
## Purpose
The world model of the game: **the Human world (map 1) is a hand-drawn 200×200 grid** (RLE-encoded in `humanMap.ts`) while the other worlds keep the original procedural noise. Every cell carries a kind (9 of them: plain/forest/mountain/arid/snow/ether/volcano/shallow/deep), a movement cost, a harvestable resource from a stable catalog and a burn flag (volcano). It defines the movement rules (on foot / ground mount / aquatic / flying), travel + energy payment, spawn, the "no PvP around the capital" safe zone, and the HTTP surface exposing a map area to clients (`/map/*`) and the move/gather/approach actions (`/actions/*`). The front keeps a byte-equivalent mirror for client-side previews.

## How it works
- `humanMap.ts` (generated): `W×H` RLE rows decoded once into a `Uint8Array` of codes; `CODES` maps each code to `[kind, resourceId]` (e.g. `Y` = yggdrasil in forest, `v` = volcano/verre_dragon). `FEATURES` locates the hotel (100,100, `safeRadius` 10), the 4 portals and the Minotaure tree.
- `terrain.ts`: for map 1 each cell is a frozen `{kind, cost, resourceId, resource (catalog display name), burn}`; elevation per kind (`VR` ranges) feeds `noiseAt(x, y, mapId)` (a 0..1 scalar, bilinearly interpolated, exact on integer cells). Other maps: the original `procNoise` (lattice 8), kind from thresholds, resource = deterministic hash-pick from the per-kind `POOL` (e.g. deep → `granit_marin/corail_abyssal/sable_noir/perle_ecume`). `KIND_COST` (plain 1, forest 2, mountain 3, arid 2, snow/ether/volcano 3, shallow 4, deep 99), `inSafeZone` (Chebyshev ≤ 10 of the hotel, map 1 only), `setWorld` (the front's "current world"; back always passes `mapId` explicitly).
- `resources.ts` (generated): `RESOURCES` catalog (id/name/group/color/rarity/where/count), `GROUPS` (bois→forest, minerai→mountain, abysses→deep, eaux→shallow, plaines→plain, arides→arid), `RES_BY_ID`. Harvesting stores the **stable id** (not the name) in `characters.resources`.
- `movement.ts`: `actor(db, ch)` = controlled summon (its own stats, no mount) or hero + active mount (bonus_see/bonus_range). `stepCost`: flying = 1 everywhere; aquatic = 1 on water / Infinity on land; on foot/ground = deep → Infinity, else the cell cost. `travel` walks the 8-direction straight line, enforces map bounds (409), refuses paths crossing an occupied cell (`item_id IS NULL` filter, 409 `Chemin bloqué`), stops at `stopAt`, pays via `spend()` (summon pays all; mount pays travel, hero pays actions; 409 when short), updates `positions`, and — new — **ignites the hero if the path crossed a volcano cell** (`ignite`: `burn_until = now()+3h`; `hourlyTick` then deals `BURN_DAMAGE=10`/h, HP floor 1).
- `actions.ts`: `POST /actions/move` = `travel` + log + WS `moved`. `POST /actions/gather` = harvest the target cell's resource in place (4 energy) or at range (travel first, +4): the water rule fires **before** travel (deep on foot → 409 `Rien à récolter ici`, deterministic), then `characters.resources = jsonb_set(resources, {resourceId}, +1)`. `POST /actions/approach` = `travel(stopAt=1)`.
- `map.ts`: one big join over `positions`; `GET /map/{id}/area` (r ≤ 25), `GET /map/{id}/cell` returns `{terrain(x, y, mapId), safe: inSafeZone(...), entity}` (+ `visibleGear` when `details=1`), `GET /map/{id}/landmarks`. `pub()` strips exact HP (4-level public state).
- Safe zone (PvP): `combat.ts` and `spells.ts` refuse any non-monster target when **either** side is inside a safe zone (403 `Zone sacrée : aucun combat entre joueurs`).
- `spawn.ts`: `freeCell` scans random cells around the race capital, refusing water **and volcano** cells; the radius expands by 2 per round when saturated (only a fully-occupied map fails 503). `spawn` places the character in a `positions` row.

## Entry points
- `POST /actions/move|gather|approach` (`routes/actions.ts`) — front `TileCard` action menu.
- `GET /map/{id}/area|cell|landmarks` (`routes/map.ts`) — front `GameCanvas` re-fetches on every WS event + 8 s poll.
- `spawn()` from `routes/characters.ts`; `freeCell` from `routes/divine.ts` (summon, r=3), `routes/admin.ts` (r=2), `game/divine.ts` (resurrection on map 3, r=20); `buildings.ts` reuses the same water/volcano check for placement.
- `travel`/`spend`/`actor` shared by `combat.ts` (long-range attacks) and `spells.ts`.
- `terrain.setWorld` is called by the front `GameCanvas` on every `me` refresh so the mirror defaults to the right world.
- Realtime: move/gather/approach broadcast `{type:'moved'}` via Redis `map:{id}` (multi-instance fan-out).

## Data flow
Reads: `positions` (placement of everything), `maps` (bounds), `characters/monsters/summons/buildings/character_mounts+mounts`, `specializations` (public health state). Writes: `positions` (travel endpoint), `characters.resources` JSONB (+1 per harvest, **keyed by stable catalog id**), `characters.burn_until` (volcano crossing), `history_action` (log, trimmed at 100). No per-cell storage: map 1 is the decoded `humanMap` grid, the other worlds are pure functions of (x, y).

## Tests
- `test/rules.test.ts` (unit): stat tiers, 8-direction walk, terrain determinism, **catalog name ⇄ stable id on all 3 maps**, resource group follows the terrain kind on procedural worlds, new kinds (arid cost 2, volcano burn = 10 = `BURN_DAMAGE`), water rules (shallow 4 on foot, deep forbidden, aquatic/flying mounts), damage/armor/pact/divine-energy rules.
- `test/world.test.ts` (unit, generated invariants): hotel exactly at (100,100) on a plain; safe radius 10 (map 1 only) with plain/forest only inside; 4 portals on firm land; every catalog resource present on the map; Yggdrasil = exactly 8 cells; `verre_dragon` only on volcano cells; shallow=4/deep=99 costs; elevation coherence with the original noise thresholds; procedural worlds deterministic.
- `test/integration/map-gather.test.ts` (skipped without `DATABASE_URL` + `REDIS_URL`; runs in CI and `stack exec backend`): full journey — create a human, move to a free plain cell (out-of-map 409), in-place + ranged gather (stable `resourceId` lands in `resources` via `/inventory`), deep-water gather on foot → 409 `Rien à récolter ici`, **safe zone: two fresh humans cannot fight each other (403 `Zone sacrée`) and `/cell` exposes `safe: true`**, and the privacy rule (no exact HP, `visibleGear` only).

## Gotchas
- **The terrain is duplicated in two repos** (`back/src/game/terrain.ts` ⇄ `front/src/lib/terrain.js`, plus the generated `humanMap`/`resources` pairs): any change must be mirrored in both repos; the generated files say so at the top — edit `tools/gen_human_map.py`, never the generated files. `test/rules.test.ts` (back) + `test/lib.test.js`/`test/world.test.js` (front) lock the mapping.
- `terrain(x, y)` without `mapId` uses the front's global `setWorld` state — the back always passes `mapId` explicitly; the front must `setWorld` on every `me` refresh (a character crossing worlds changes everything).
- `deep` cost 99 is display-only; the effective rule is `stepCost` (Infinity on foot). Never sum `t.cost` for travel.
- Harvest stores the **resource id** (e.g. `perle_ecume`), not the display name; the log line shows the name. Any new consumer of `characters.resources` must key by catalog id.
- Volcano: crossing a cell ignites the **hero only** (summons don't burn: `if (lava && !a.sm)`); `burn_until` is renewed on each crossing and the hourly tick deals 10/h with HP floor 1 — the burn is never lethal.
- The safe zone is purely positional (Chebyshev ≤ 10 of the hotel, map 1): both the attacker's and the target's position are checked, monsters are exempt; the front `TileCard` hides the attack option on the same rule — keep both in sync.
- `freeCell` refuses water **and volcano** cells; its radius now expands (saturated dev DBs) — don't rely on a character spawning near the capital.
- `/map/{id}/area` caps `r` at 25; map payloads never carry exact HP (rule enforced in `pub()`, see `combat-realtime`).
- 8-direction walk is a straight Chebyshev line — no pathfinding around obstacles: a blocked cell blocks the whole move.

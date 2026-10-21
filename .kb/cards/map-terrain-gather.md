---
title: Procedural map & terrain: resources, movement rules, spawn, map/action routes
slug: map-terrain-gather
status: done
updated: 2026-10-21
files:
  - src/game/terrain.ts
  - src/game/movement.ts
  - src/game/spawn.ts
  - src/routes/map.ts
  - src/routes/actions.ts
  - src/routes/inventory.ts
symbols:
  - src/game/terrain.ts:terrain
  - src/game/terrain.ts:noiseAt
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
  - test/integration/map-gather.test.ts
---
## Purpose
The world model of the game: a deterministic procedural terrain shared by every instance (no per-map storage), where each cell has a kind, a movement cost and a harvestable resource (`perle/eau/herbe/bois/pierre`). It defines the movement rules (on foot / ground mount / aquatic / flying), how characters and summons travel and pay energy, where new characters spawn, and the HTTP surface that exposes a map area to clients (`/map/*`) and lets a character move, gather and approach (`/actions/*`). The front keeps a byte-equivalent mirror (`front/src/lib/terrain.js`, `front/src/lib/energy.js`) for client-side previews.

## How it works
- `terrain.ts` : `noiseAt(x,y)` = bilinear-interpolated value noise on a hash `h(x,y)=fract(sin(x*12.9898+y*78.233)*43758.5453)` sampled every 8 cells — fully deterministic, same result on every process. `terrain(x,y)` maps the noise to 5 cells: `<0.14 deep (cost 99, perle)`, `<0.22 shallow (4, eau)`, `<0.58 plain (1, herbe)`, `<0.74 forest (2, bois)`, else `mountain (3, pierre)`.
- `movement.ts` : `actor(db, ch)` resolves who moves — the controlled summon (`summons` + `positions`, no mount, see/range its own) or the hero with their active mount (`character_mounts JOIN mounts`, bonus_see/bonus_range added to the hero's stats). `stepCost(t, a)` is the per-cell rule: flying mount → 1 everywhere; aquatic mount → 1 on water (`shallow`/`deep`), Infinity on land; on foot / ground mount → `deep` = Infinity (forbidden), else the cell cost (shallow = 4). `travel(db, ch, a, target, stopAt, actionCost)` walks the 8-direction straight line (`walk` in `rules.ts`), re-checks the `maps` width/height bounds (`409 'Hors de la carte'`), refuses a path crossing an occupied cell (`positions … item_id IS NULL`, `409 'Chemin bloqué'`), stops early at `stopAt` cells from the target, then `spend()` pays: the controlled summon always pays its own energy; a mount pays travel costs and the hero pays action costs; `409 'Énergie insuffisante'` when short. Finally it updates the `positions` row (character or summon) and returns `{cost, pos, mapId}`.
- `actions.ts` : `POST /actions/move` = `travel(stopAt=0)` + log + WS broadcast `moved` on the map. `POST /actions/gather` = harvest the resource of a cell: in place (cost 4) or at range (travel first, +4); a deep cell is only harvestable with an aquatic or flying mount (`409 'Rien à récolter ici'` otherwise — the water rule is checked BEFORE travel, so the error is deterministic regardless of the path). Each harvest does `characters.resources = jsonb_set(resources, {res}, +1)` and broadcasts `moved`. `POST /actions/approach` = `travel(stopAt=1)`: stop next to a target/structure.
- `map.ts` : one big `SEL` joining `positions` to characters/monsters/summons/buildings/active mounts; `GET /map/{mapId}/area?x&y&r` (r ≤ 25) returns entities in the square, `GET /map/{mapId}/cell?x&y[&details=1]` returns `{terrain, entity}` (with `visibleGear` for characters when `details=1`), `GET /map/{mapId}/landmarks` = invulnerable buildings. `pub()` strips exact HP from every character row and replaces it with the 4-level public health state (`getPublicHealthState`).
- `spawn.ts` : `spawn(db, charId, race)` places the character in a free cell near the race's capital building (`Hôtel de ville` / `Bastion Infernal` / `Sanctuaire de la Providence`, map 1/2); `freeCell` scans random cells in an expanding ring (radius grows by 2 when saturated; gives up only when the whole map is scanned) refusing water cells and cells with any `positions` row.

## Entry points
- `POST /actions/move`, `/actions/gather`, `/actions/approach` (`routes/actions.ts`) — called by the front `TileCard` action menu.
- `GET /map/{mapId}/area|cell|landmarks` (`routes/map.ts`) — `front GameCanvas` re-fetches the area on every WS event and on an 8 s poll.
- `spawn()` from `routes/characters.ts` (character creation); `freeCell` from `routes/divine.ts` (summon placement, r=3), `routes/admin.ts` (admin reposition, r=2), `game/divine.ts` (resurrection on map 3, r=20).
- `travel()` / `spend()` / `actor()` are the shared core of `combat.ts` (long-range attacks move first), `spells.ts` and `buildings.ts` (interact/approach flows).
- Realtime: every move/gather/approach broadcasts `{type:'moved'}` via `realtime/ws.ts` (Redis pub/sub `map:{id}`) so the other clients of the map re-render.

## Data flow
Reads: `positions` (where everything is), `characters`/`monsters`/`summons`/`buildings`/`character_mounts`+`mounts`, `maps` (bounds), `specializations` (public health state). Writes: `positions` (travel endpoint), `characters.resources` JSONB (`jsonb_set` +1 per harvest — the client's `GET /inventory/{id}` returns it), `history_action` (log, trimmed at 100). No map data is stored per cell: the world is a pure function of (x, y).

## Tests
- `test/rules.test.ts` (unit, no DB): terrain determinism, resource mapping per kind (`perle/eau/herbe/bois/pierre`), `stepCost` water rules (shallow = 4 on foot, deep forbidden, aquatic/flying mounts), relief distribution (all 5 kinds present in 100×100), 8-direction `walk`/`routeEnergy`, stat upgrade tiers, damage/armor/pact/divine-energy rules.
- `test/integration/map-gather.test.ts` (skipped without `DATABASE_URL` + `REDIS_URL`; runs in CI and `stack exec backend`): full journey — create a human, move to a free plain cell (with an out-of-map 409), in-place gather (resource lands in `resources` JSONB via `/inventory`), ranged gather (travel + 4 energy, position follows), deep-water gather on foot → 409 `'Rien à récolter ici'`, and the privacy rule: a zone row of another character exposes only `health` + `visibleGear`, never `chp`.

## Gotchas
- **The terrain is duplicated in two repos** (`back/src/game/terrain.ts` ⇄ `front/src/lib/terrain.js`, same for `movement.ts` ⇄ `front/src/lib/energy.js`): any threshold/cost/resource change must be mirrored, and `test/lib.test.js` (front) + `test/rules.test.ts` (back) lock the mapping. Keep the two files byte-equivalent in logic.
- `deep` has cost 99 as a *display* value but the effective rule is `stepCost` (Infinity on foot) — never compute travel cost from `t.cost` directly.
- The gather water rule fires **before** travel: a on-foot deep target is always `409 'Rien à récolter ici'`, even if the path to it would fail earlier elsewhere. Tests rely on that ordering.
- `travel` checks occupancy with `item_id IS NULL`: dropped items (`item_id` set) do NOT block a path, but characters/monsters/buildings/summons/mounts do. Reproducing "is this path clear" requires that filter (the integration test builds its occupied set from `/area` excluding `kind === 'item'`).
- `freeCell` saturates: the capital ring (r = 4, ~37 walkable cells in map 1) fills up quickly in a long-lived dev DB; the radius now expands to the whole map before failing 503. Repeated test runs on the same DB also hit `chk_char_limit` (3 characters per account, same race) — suites that recreate fixed accounts need a reset or a fresh account per run.
- `/map/{id}/area` caps `r` at 25; the cell/area responses never carry exact HP (rule enforced in `pub()`; do not add HP/gold to map payloads — see `combat-realtime`).
- 8-direction walk is a straight Chebyshev line (`walk` in `rules.ts`): no pathfinding around obstacles — a blocked cell blocks the whole move, it is not routed around.

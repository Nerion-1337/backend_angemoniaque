---
title: "Bestiaire (phase 2): loot roll, hourly spawns, combat death, admin routes & status"
slug: bestiaire
status: done
updated: 2026-11-20
files:
  - src/game/loot.ts
  - src/game/combatlib.ts
  - src/routes/admin/bestiary.ts
  - src/routes/admin/monsters.ts
  - src/game/spawn.ts
  - src/game/entity.ts
symbols:
  - src/game/loot.ts:rollLoot
  - src/game/combatlib.ts:monsterDeath
  - src/routes/admin/bestiary.ts:bestiaryRoutes
  - src/routes/admin/monsters.ts:monsterRoutes
  - src/game/spawn.ts:hourlySpawns
  - src/game/entity.ts:monsterOnMap
tests:
  - test/loot.test.ts
  - test/integration/bestiary.test.ts
---
## Purpose
Phase 2 (Bestiaire) game loop: monsters drop loot when killed (gold + weighted entries from
`monster_loot`: items, resources, designated divine items), wild instances are spawned on the
hourly tick from `spawn_rules` (probability + frequency + caps + free-cell), and the admin
back-office manages loot tables and spawn rules per monster plus a live bestiary status
dashboard (instances on maps + divine-item guardians).

## How it works
- **Admin CRUD** (`routes/admin/monsters.ts` `monsterRoutes`): `monster_loot` rows (item /
  resource / divine, `drop_rate` 0-100, `qty_min`/`qty_max`) and `spawn_rules` rows
  (map + rectangle, `max_instances`, `interval_h`, `probability`, `active`) under
  `/admin/content/monsters/{id}/loot` and `/.../spawns`; DELETE of a monster is 409 while it is
  placed, summoned, or guardian of divine items. The loot GET returns
  `ml.*, i.name item_name, di.kind divine_kind, di.id divine_ref` (`divine_items` has no name
  column — the front renders "divin {kind} n°{ref}").
- **Hourly spawn** (`game/spawn.ts` `hourlySpawns`, called from `hourlyTick` in
  `routes/tick.ts`): for each active `spawn_rules` row, if the `interval_h` window elapsed
  (`last_spawned_at`) and `Math.random()*100 < probability`, it counts existing instances —
  prototypes **or** their spawned copies (`m.data->>'prototype'=$1::text` + `m.id`, via
  `monsterOnMap`-style counts, per-map variant for `per_zone` caps against `entity_caps`) — and
  only spawns a new `monsters` row (copy of prototype stats, `data={spawned:true,
  prototype:proto.id, behavior}`) + `positions` row on a free cell of the rectangle
  (`freeCellRect`: water/volcano excluded, `uq_cell` uniqueness). `max_instances` and
  `entity_caps` (global / per_zone) stop spawning when reached.
- **Death + loot** (`game/combatlib.ts` `applyDamage` → `monsterDeath`): when a monster dies,
  wild instances (`data.spawned`) are despawned (delete row + position + their loot/guardians);
  anchored monsters regenerate — phase 3 made it optional: with a reincarnation delay
  (`data.reincarnate_h` of the instance, fallback `reincarnate_delay_h` of the prototype, >0 h)
  the corpse stays at 0 PV and a `monster_respawns` deadline is scheduled (`scheduleRespawn`,
  revived by `reincarnateDue` on the hourly tick); without delay, instant `hp_current=hp_max`
  (historical behavior). Loot is ALWAYS rolled at death — a re-attack on a dead body only
  refreshes the deadline (guard `hp_current<=0`, see card `monster-details`). `rollLoot`
  (source = `data.prototype` for wild instances): credits the monster's `gold_current` to the killer; for each `monster_loot`
  entry rolled at `drop_rate × game_config.drop_rate` — item → upsert into `character_items`
  (UPDATE qty, else INSERT), resource → increment `characters.resources` JSONB, divine →
  `grantDivine` (UPDATE of the holder, never an insert → no duplication; cap hit is logged,
  not blocking).
- **Status** (`routes/admin/bestiary.ts` `GET /admin/bestiary/status`): all placed monsters
  (`monsters ⋈ positions`, `pos_id`, flags `data->>'spawned'`/`data->>'placed'`,
  `data->>'prototype'`, `gold`, `reincarnate_h`, `respawn_due_at` via
  `LEFT JOIN monster_respawns`) and all divine items with guardian / holder, for the front
  dashboard. Phase 3 added `POST /admin/bestiary/place` (ad-hoc instance with chosen drops +
  reincarnation delay) and `DELETE /admin/bestiary/place/{posId}` (unplace) — see card
  `monster-details`.

## Entry points
- `hourlyTick` (`routes/tick.ts`, `setInterval` 1 h in `index.ts` + manual `POST /admin/tick`) →
  `hourlySpawns`.
- `applyDamage` in `routes/combat.ts` (`POST /combat/attack`) and `routes/spells.ts` →
  `monsterDeath`/`rollLoot` on monster death.
- `GET /admin/bestiary/status` (admin middleware) consumed by the front `Bestiary` panel
  (`front/src/admin/Bestiary.jsx`).
- Phase 3: `POST /admin/bestiary/place` / `DELETE /admin/bestiary/place/{posId}` (admin
  middleware); `reincarnateDue` at the end of `hourlyTick` (`routes/tick.ts`).
- Loot/spawn CRUD mounted through `routes/admin.ts` under `/admin/*`.

## Data flow
Reads: `spawn_rules`, `monsters` (stats + `data` JSONB), `entity_caps`, `maps`, `positions`,
`monster_loot`, `divine_items`, `game_config.drop_rate`. Writes: new `monsters`+`positions`
instances per tick, `monster_loot`/`spawn_rules` rows (admin CRUD, audited via `audit()` +
`bumpContent()` cache invalidation), `characters.gold` / `characters.resources` /
`character_items` on kill, `divine_items.holder_character_id` on divine transfer, and
`history_action` log lines ("Butin de X : …"). Wild instances leave no row behind on death.

## Tests
- `test/loot.test.ts` (unit, DB mocked): gold credit, 100 % entry upsert + resource increment +
  divine transfer call shape, 0 % never rolled, global `drop_rate` multiplier, wild instance
  rolls its prototype's loot.
- `test/integration/bestiary.test.ts` (needs `DATABASE_URL`, skipped otherwise): full pass —
  admin creates prototype + loot (item/resource/divine) + spawn rule + cost/cap; tick spawns up
  to `max_instances` on distinct cells; kill (admin-boosted agility/range player) yields gold,
  item, resource and the divine transfer without duplication; instance despawns and the next
  tick re-spawns; summoning respects `entity_costs` (409 under cost) and `entity_caps
  per_player`; status + audit trails present. An `afterAll` cleanup deletes the run's
  `spawn_rules`, `character_monster` rows, positions and monsters: without it the active rules
  (`interval_h` 0) accumulate across re-runs on a warm volume and flood the maps with wild
  instances on every tick.
- `test/monsterDetails.test.ts` + `test/integration/monsterDetails.test.ts` (card
  `monster-details`): the phase-3 death/reincarnation mechanics and the ad-hoc placement
  journey, kept hermetic across re-runs (the catalog counts asserted by `features.test.ts`).

## Gotchas
- **`m.data->>'prototype'` is a text extraction**: always compare against a text parameter
  (`=$1::text`) — an int parameter raises `operator does not exist: text = integer`.
- The spawn INSERT binds exactly 13 parameters (`$2` and `$7` are each used twice); a 14th
  element makes the tick 500 ("bind message supplies 14 parameters").
- `ON CONFLICT (character_id,item_id)` cannot be used on `character_items` (no unique
  constraint exists): `rollLoot` does UPDATE-then-INSERT on `rowCount`.
- `monsterDeath` deletes the wild instance's own `monster_loot`/`divine_items` rows, but loot is
  rolled **from the prototype** (`data.prototype`) — deleting the instance must never touch the
  prototype's tables.
- `maps.name_file` is the map title column (there is no `maps.name`).
- Divine transfer is UPDATE-only (`grantDivine`): a held item or reached `divine_caps` leaves
  the piece with its current holder and only logs — the kill flow must stay non-blocking.
- **Warm-volume test hygiene**: the bestiary integration test must keep its `afterAll`
  cleanup (spawn_rules / positions / character_monster / monsters by the run's `NAME` prefix),
  otherwise successive runs on the same Postgres accumulate active spawn rules and clog maps
  (other suites' moves/spawns then fail: "Chemin bloqué", no free cell).
- The back `Bestiary` status and the front panel assume `lootLabel` fields: `item_name`,
  `divine_kind` + `divine_ref` (never `divine_name`).

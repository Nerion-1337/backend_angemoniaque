# Graph Report - back  (2026-11-25)

## Corpus Check
- 133 files · ~83,339 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 642 nodes · 1959 edges · 23 communities (21 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e87fa9ea`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fail
- admin.ts
- app.ts
- with
- spellEffects.ts
- characters.ts
- combatlib.ts
- package.json
- world2.ts
- admin/deposits.ts
- terrain.ts
- map.ts
- routes/auth.ts
- rules.test.ts
- movement.ts
- index.ts
- core.ts
- terrain
- compilerOptions
- AGENTS.md — ia_agent / back
- game/entity.ts
- HttpError

## God Nodes (most connected - your core abstractions)
1. `fail()` - 83 edges
2. `vitest` - 55 edges
3. `terrain()` - 39 edges
4. `router()` - 33 edges
5. `def()` - 31 edges
6. `pool` - 30 edges
7. `P()` - 26 edges
8. `log()` - 23 edges
9. `ownChar()` - 20 edges
10. `tx()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `find()` --calls--> `levelAt()`  [EXTRACTED]
  test/levels.test.ts → src/game/levels.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/levels.test.ts → src/game/terrain.ts

## Import Cycles
- None detected.

## Communities (23 total, 2 thin omitted)

### Community 0 - "fail"
Cohesion: 0.07
Nodes (65): @hono/zod-openapi, bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots(), resStacks() (+57 more)

### Community 1 - "admin.ts"
Cohesion: 0.05
Nodes (62): pool, bumpContent(), cfgAll(), cfgNum(), divineCap(), attachDivine(), divineHeld(), inCirculation() (+54 more)

### Community 2 - "app.ts"
Cohesion: 0.09
Nodes (14): vitest, actions, buildings, combat, craft, divine, faiths, inventory (+6 more)

### Community 3 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 4 - "spellEffects.ts"
Cohesion: 0.10
Nodes (34): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), loadTarget(), Target, regenDeposits() (+26 more)

### Community 5 - "characters.ts"
Cohesion: 0.08
Nodes (34): checkActivation(), bagOf(), checkReq(), Cond, CondT, hasReq(), missingFor(), Mode (+26 more)

### Community 6 - "combatlib.ts"
Cohesion: 0.12
Nodes (20): applyDamage(), monsterDeath(), scheduleRespawn(), applySpec(), die(), grantDivine(), held(), KIND (+12 more)

### Community 7 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 8 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 9 - "admin/deposits.ts"
Cohesion: 0.15
Nodes (24): activate(), Activation, describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll() (+16 more)

### Community 10 - "terrain.ts"
Cohesion: 0.11
Nodes (21): CODES, FEATURES, H, ROWS, W, BY_CODE, CELLS, DEAD (+13 more)

### Community 11 - "map.ts"
Cohesion: 0.24
Nodes (13): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS, tileCost() (+5 more)

### Community 12 - "routes/auth.ts"
Cohesion: 0.17
Nodes (9): env, admin(), auth(), mod(), roleOf(), signToken(), authRoutes, Log (+1 more)

### Community 13 - "rules.test.ts"
Cohesion: 0.20
Nodes (13): applyArmor(), canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), getPublicHealthState(), pathEnergy(), routeEnergy() (+5 more)

### Community 14 - "movement.ts"
Cohesion: 0.22
Nodes (12): BLOCKING, BURN_HOURS, ignite(), blockedMsg(), isWater(), mountPassives(), onLand(), pathCost() (+4 more)

### Community 15 - "index.ts"
Cohesion: 0.20
Nodes (9): app, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket }, joinMap(), leave() (+1 more)

### Community 16 - "core.ts"
Cohesion: 0.18
Nodes (10): RARE3, RES3_BY_ID, RESOURCES3, GROUPS, RES_BY_ID, RESOURCES, MAP_HUMAN, coreRoutes (+2 more)

### Community 17 - "terrain"
Cohesion: 0.36
Nodes (9): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, terrain(), find() (+1 more)

### Community 18 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 19 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 20 - "game/entity.ts"
Cohesion: 0.53
Nodes (3): assertCap(), checkEntityCost(), monsterOnMap()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `admin.ts`, `app.ts`, `spellEffects.ts`, `characters.ts`, `combatlib.ts`, `admin/deposits.ts`, `routes/auth.ts`, `movement.ts`, `core.ts`, `game/entity.ts`, `HttpError`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.07389613360787005 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `fail`, `admin.ts`, `spellEffects.ts`, `combatlib.ts`, `package.json`, `world2.ts`, `admin/deposits.ts`, `map.ts`, `routes/auth.ts`, `rules.test.ts`, `movement.ts`, `index.ts`, `core.ts`, `terrain`, `game/entity.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `admin.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.054069938289744345 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `fail`, `admin.ts`, `app.ts`, `spellEffects.ts`, `world2.ts`, `admin/deposits.ts`, `terrain.ts`, `map.ts`, `rules.test.ts`, `movement.ts`, `core.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08788159111933395 - nodes in this community are weakly interconnected._
- **Should `with` be split into smaller, more focused modules?**
  _Cohesion score 0.04541062801932367 - nodes in this community are weakly interconnected._
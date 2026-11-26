# Graph Report - back  (2026-11-26)

## Corpus Check
- 146 files · ~95,731 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 729 nodes · 2208 edges · 27 communities (26 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `881362b5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- combat.ts
- app.ts
- routes/auth.ts
- route.ts
- with
- characters.ts
- terrain.ts
- world2.ts
- package.json
- items.ts
- tick.ts
- forum.ts
- game/deposits.ts
- pool
- admin.ts
- rules.test.ts
- fail
- tileTypes.ts
- admin/deposits.ts
- movement.ts
- terrain
- compilerOptions
- races.ts
- admin/entity.ts
- AGENTS.md — ia_agent / back
- game/entity.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 93 edges
2. `vitest` - 63 edges
3. `terrain()` - 40 edges
4. `router()` - 35 edges
5. `pool` - 33 edges
6. `def()` - 33 edges
7. `P()` - 27 edges
8. `log()` - 23 edges
9. `ownChar()` - 20 edges
10. `tx()` - 19 edges

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

## Communities (27 total, 1 thin omitted)

### Community 0 - "combat.ts"
Cohesion: 0.07
Nodes (58): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+50 more)

### Community 1 - "app.ts"
Cohesion: 0.06
Nodes (22): vitest, app, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket }, HttpError (+14 more)

### Community 2 - "routes/auth.ts"
Cohesion: 0.07
Nodes (43): hono, env, WEAK, b64(), botCheck(), clientIp(), COMMON, hit() (+35 more)

### Community 3 - "route.ts"
Cohesion: 0.12
Nodes (37): @hono/zod-openapi, bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots(), resStacks() (+29 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "characters.ts"
Cohesion: 0.08
Nodes (35): monsterDeath(), cfgNum(), applySpec(), die(), grantDivine(), held(), KIND, refreshSurcharge() (+27 more)

### Community 6 - "terrain.ts"
Cohesion: 0.08
Nodes (28): BURN_HOURS, CODES, FEATURES, H, ROWS, W, GROUPS, RES_BY_ID (+20 more)

### Community 7 - "world2.ts"
Cohesion: 0.10
Nodes (28): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+20 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (31): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+23 more)

### Community 9 - "items.ts"
Cohesion: 0.12
Nodes (23): Activation, Building, buildingRoutes, colsOf(), extras(), jsonable(), RARITIES, requireRow() (+15 more)

### Community 10 - "tick.ts"
Cohesion: 0.12
Nodes (18): scheduleRespawn(), regenDeposits(), revertTempRanks(), attachDivine(), divineHeld(), inCirculation(), respawnBlockers(), RespawnLimit (+10 more)

### Community 11 - "forum.ts"
Cohesion: 0.12
Nodes (21): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+13 more)

### Community 12 - "game/deposits.ts"
Cohesion: 0.18
Nodes (21): activate(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll(), depositAt() (+13 more)

### Community 13 - "pool"
Cohesion: 0.20
Nodes (12): pool, bumpContent(), cfgAll(), divineCap(), audit(), Place, check(), Recipe (+4 more)

### Community 14 - "admin.ts"
Cohesion: 0.12
Nodes (16): adminRoutes, bestiaryRoutes, itemRoutes, checkSummon(), LINK_TBL, monsterDetailRoutes, requireMonster(), SLOTS (+8 more)

### Community 15 - "rules.test.ts"
Cohesion: 0.18
Nodes (13): RARE3, RES3_BY_ID, RESOURCES3, applyArmor(), canUseDivineEnergy(), computeHitChance(), computePactStatTransfer(), pathEnergy() (+5 more)

### Community 16 - "fail"
Cohesion: 0.14
Nodes (13): fail(), ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member() (+5 more)

### Community 17 - "tileTypes.ts"
Cohesion: 0.27
Nodes (12): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS, tileCost() (+4 more)

### Community 18 - "admin/deposits.ts"
Cohesion: 0.18
Nodes (12): checkActivation(), KINDS, checkReq(), checkKit(), resourceExists(), check(), depositRoutes, KIND_FR (+4 more)

### Community 19 - "movement.ts"
Cohesion: 0.29
Nodes (10): BLOCKING, ignite(), blockedMsg(), isWater(), mountPassives(), onLand(), pathCost(), spendDivine() (+2 more)

### Community 20 - "terrain"
Cohesion: 0.36
Nodes (9): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, terrain(), find() (+1 more)

### Community 21 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 22 - "races.ts"
Cohesion: 0.25
Nodes (5): checkSpawn(), Race, raceRoutes, RankDiff, SPAWN_COLS

### Community 23 - "admin/entity.ts"
Cohesion: 0.29
Nodes (6): kindOf(), TABLE, Cap, Cost, entityRoutes, Mod

### Community 24 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 25 - "game/entity.ts"
Cohesion: 0.53
Nodes (3): assertCap(), checkEntityCost(), monsterOnMap()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `combat.ts`, `app.ts`, `routes/auth.ts`, `route.ts`, `characters.ts`, `world2.ts`, `items.ts`, `tick.ts`, `forum.ts`, `game/deposits.ts`, `pool`, `admin.ts`, `admin/deposits.ts`, `movement.ts`, `races.ts`, `admin/entity.ts`, `game/entity.ts`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07404664938911515 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `combat.ts`, `routes/auth.ts`, `characters.ts`, `terrain.ts`, `world2.ts`, `package.json`, `tick.ts`, `forum.ts`, `game/deposits.ts`, `pool`, `rules.test.ts`, `tileTypes.ts`, `movement.ts`, `terrain`, `game/entity.ts`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06189640035118525 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `combat.ts`, `app.ts`, `route.ts`, `terrain.ts`, `world2.ts`, `tick.ts`, `game/deposits.ts`, `pool`, `rules.test.ts`, `tileTypes.ts`, `movement.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `routes/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07017543859649122 - nodes in this community are weakly interconnected._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12390572390572391 - nodes in this community are weakly interconnected._
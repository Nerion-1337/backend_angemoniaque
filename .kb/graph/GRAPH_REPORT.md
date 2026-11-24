# Graph Report - back  (2026-11-24)

## Corpus Check
- 97 files · ~53,376 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 478 nodes · 1322 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `87c04cec`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fail
- admin.ts
- with
- package.json
- app.ts
- world2.ts
- terrain.ts
- game/divine.ts
- players.ts
- tileTypes.ts
- rules.test.ts
- movement.ts
- routes/auth.ts
- ws.ts
- compilerOptions
- clock.ts
- core.ts
- AGENTS.md — ia_agent / back
- game/entity.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 58 edges
2. `vitest` - 35 edges
3. `router()` - 30 edges
4. `def()` - 28 edges
5. `terrain()` - 27 edges
6. `pool` - 25 edges
7. `P()` - 24 edges
8. `ownChar()` - 18 edges
9. `tx()` - 16 edges
10. `log()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `checkFamily()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/items.ts → src/lib/db.ts
- `requireMonster()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/monsterDetails.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (20 total, 1 thin omitted)

### Community 0 - "fail"
Cohesion: 0.09
Nodes (51): @hono/zod-openapi, loadTarget(), targetAt(), activeMount(), actor(), spend(), checkKit(), grantKit() (+43 more)

### Community 1 - "admin.ts"
Cohesion: 0.07
Nodes (47): pool, bumpContent(), cfgAll(), cfgNum(), divineCap(), audit(), adminRoutes, bestiaryRoutes (+39 more)

### Community 2 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 3 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 4 - "app.ts"
Cohesion: 0.09
Nodes (14): vitest, HttpError, actions, buildings, combat, divine, faiths, inventory (+6 more)

### Community 5 - "world2.ts"
Cohesion: 0.11
Nodes (25): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+17 more)

### Community 6 - "terrain.ts"
Cohesion: 0.10
Nodes (23): CODES, FEATURES, H, ROWS, W, BURN_DAMAGE, BY_CODE, CELLS (+15 more)

### Community 7 - "game/divine.ts"
Cohesion: 0.16
Nodes (12): applyDamage(), monsterDeath(), scheduleRespawn(), Target, applySpec(), die(), grantDivine(), held() (+4 more)

### Community 8 - "players.ts"
Cohesion: 0.16
Nodes (16): CAPITAL, freeCell(), freeCellRect(), hourlySpawns(), reincarnateDue(), spawn(), spawnZone(), Edit (+8 more)

### Community 9 - "tileTypes.ts"
Cohesion: 0.22
Nodes (14): getPublicHealthState(), KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS (+6 more)

### Community 10 - "rules.test.ts"
Cohesion: 0.20
Nodes (13): applyArmor(), canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), effectiveRank(), pathEnergy(), routeEnergy() (+5 more)

### Community 11 - "movement.ts"
Cohesion: 0.23
Nodes (13): BURN_HOURS, ignite(), blockedMsg(), isWater(), pathCost(), stepCost(), travel(), h0() (+5 more)

### Community 12 - "routes/auth.ts"
Cohesion: 0.19
Nodes (8): admin(), auth(), mod(), roleOf(), signToken(), authRoutes, Log, Reg

### Community 13 - "ws.ts"
Cohesion: 0.23
Nodes (8): app, env, { injectWebSocket, upgradeWebSocket }, joinMap(), leave(), pub, sockets, sub

### Community 14 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 15 - "clock.ts"
Cohesion: 0.33
Nodes (5): catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), state

### Community 16 - "core.ts"
Cohesion: 0.33
Nodes (5): GROUPS, RES_BY_ID, RESOURCES, coreRoutes, RESCATALOG

### Community 17 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 18 - "game/entity.ts"
Cohesion: 0.53
Nodes (3): assertCap(), checkEntityCost(), monsterOnMap()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `admin.ts`, `app.ts`, `game/divine.ts`, `players.ts`, `movement.ts`, `routes/auth.ts`, `core.ts`, `game/entity.ts`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.09282700421940929 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `fail`, `admin.ts`, `package.json`, `world2.ts`, `terrain.ts`, `game/divine.ts`, `players.ts`, `tileTypes.ts`, `rules.test.ts`, `movement.ts`, `ws.ts`, `clock.ts`, `game/entity.ts`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Should `admin.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07475678443420379 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `fail` to `package.json`, `app.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `with` be split into smaller, more focused modules?**
  _Cohesion score 0.04541062801932367 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07954545454545454 - nodes in this community are weakly interconnected._
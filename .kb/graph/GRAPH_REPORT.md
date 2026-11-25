# Graph Report - back  (2026-11-25)

## Corpus Check
- 130 files · ~80,639 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 625 nodes · 1900 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ae050c79`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- route.ts
- app.ts
- ws.ts
- admin/deposits.ts
- fail
- combatlib.ts
- spells.ts
- with
- movement.ts
- world2.ts
- terrain.ts
- tileTypes.ts
- terrain
- compilerOptions
- world.test.ts
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 82 edges
2. `vitest` - 53 edges
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

## Communities (17 total, 1 thin omitted)

### Community 0 - "route.ts"
Cohesion: 0.05
Nodes (74): @hono/zod-openapi, pool, bumpContent(), cfgAll(), cfgNum(), divineCap(), Requirements, audit() (+66 more)

### Community 1 - "app.ts"
Cohesion: 0.08
Nodes (15): vitest, HttpError, admin(), auth(), mod(), roleOf(), signToken(), authRoutes (+7 more)

### Community 2 - "ws.ts"
Cohesion: 0.05
Nodes (45): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+37 more)

### Community 3 - "admin/deposits.ts"
Cohesion: 0.09
Nodes (44): activate(), Activation, describeActivation(), Group, groupMissing(), GroupT, hasActivation(), bagRoom() (+36 more)

### Community 4 - "fail"
Cohesion: 0.07
Nodes (42): checkActivation(), bagOf(), checkReq(), Cond, CondT, hasReq(), missingFor(), Mode (+34 more)

### Community 5 - "combatlib.ts"
Cohesion: 0.08
Nodes (30): applyDamage(), monsterDeath(), scheduleRespawn(), applySpec(), die(), grantDivine(), held(), KIND (+22 more)

### Community 6 - "spells.ts"
Cohesion: 0.11
Nodes (38): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), loadTarget(), Target, targetAt() (+30 more)

### Community 7 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 8 - "movement.ts"
Cohesion: 0.10
Nodes (32): BLOCKING, ignite(), activeMount(), actor(), blockedMsg(), isWater(), mountPassives(), onLand() (+24 more)

### Community 9 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 10 - "terrain.ts"
Cohesion: 0.10
Nodes (21): CODES, FEATURES, H, ROWS, W, RARE3, RES3_BY_ID, RESOURCES3 (+13 more)

### Community 11 - "tileTypes.ts"
Cohesion: 0.24
Nodes (13): KIND_COST, KIND_LABEL, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS (+5 more)

### Community 12 - "terrain"
Cohesion: 0.29
Nodes (11): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, h0(), procNoise() (+3 more)

### Community 13 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 14 - "world.test.ts"
Cohesion: 0.22
Nodes (7): BURN_HOURS, GROUPS, RES_BY_ID, RESOURCES, BURN_DAMAGE, MAP_HUMAN, all()

### Community 15 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `route.ts`, `app.ts`, `admin/deposits.ts`, `combatlib.ts`, `spells.ts`, `movement.ts`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.053728661275831084 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `route.ts`, `ws.ts`, `admin/deposits.ts`, `combatlib.ts`, `spells.ts`, `movement.ts`, `world2.ts`, `tileTypes.ts`, `terrain`, `world.test.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07532467532467532 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `route.ts`, `app.ts`, `admin/deposits.ts`, `combatlib.ts`, `spells.ts`, `movement.ts`, `world2.ts`, `terrain.ts`, `tileTypes.ts`, `world.test.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `ws.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05450733752620545 - nodes in this community are weakly interconnected._
- **Should `admin/deposits.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08525506638714186 - nodes in this community are weakly interconnected._
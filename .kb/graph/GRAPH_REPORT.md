# Graph Report - back  (2026-11-25)

## Corpus Check
- 116 files · ~68,430 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 563 nodes · 1670 edges · 23 communities (22 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0bafbc30`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fail
- app.ts
- spells.ts
- tick.ts
- with
- world2.ts
- terrain.ts
- characters.ts
- rules.test.ts
- routes/auth.ts
- tileTypes.ts
- guilds.ts
- actions.ts
- package.json
- movement.ts
- compilerOptions
- index.ts
- world.test.ts
- clock.ts
- dependencies
- AGENTS.md — ia_agent / back
- scripts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 76 edges
2. `vitest` - 45 edges
3. `router()` - 32 edges
4. `terrain()` - 30 edges
5. `def()` - 30 edges
6. `pool` - 29 edges
7. `P()` - 26 edges
8. `log()` - 20 edges
9. `ownChar()` - 19 edges
10. `tx()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `checkCreation()` --calls--> `fail()`  [EXTRACTED]
  src/routes/characters.ts → src/lib/db.ts
- `checkPerms()` --calls--> `fail()`  [EXTRACTED]
  src/routes/guilds.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (23 total, 1 thin omitted)

### Community 0 - "fail"
Cohesion: 0.06
Nodes (71): pool, bumpContent(), cfgAll(), divineCap(), checkReq(), Requirements, checkKit(), resourceExists() (+63 more)

### Community 1 - "app.ts"
Cohesion: 0.07
Nodes (30): ioredis@^5, @hono/zod-openapi, ioredis, vitest, assertCap(), checkEntityCost(), monsterOnMap(), dist() (+22 more)

### Community 2 - "spells.ts"
Cohesion: 0.10
Nodes (39): ATTACK_LABEL, attackAllowed(), AttackKind, BLOCKING, checkOccupantAttack(), occupiableAt(), loadTarget(), Target (+31 more)

### Community 3 - "tick.ts"
Cohesion: 0.10
Nodes (31): applyDamage(), monsterDeath(), scheduleRespawn(), cfgNum(), regenDeposits(), applySpec(), die(), grantDivine() (+23 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 6 - "terrain.ts"
Cohesion: 0.11
Nodes (20): CODES, FEATURES, H, ROWS, W, BY_CODE, CELLS, h0() (+12 more)

### Community 7 - "characters.ts"
Cohesion: 0.13
Nodes (22): activeMount(), actor(), bagOf(), Cond, CondT, hasReq(), missingFor(), Mode (+14 more)

### Community 8 - "rules.test.ts"
Cohesion: 0.16
Nodes (14): canUseDivineEnergy(), computeHitChance(), computePactStatTransfer(), pathEnergy(), routeEnergy(), StatRule, statUpgradeCost(), walk() (+6 more)

### Community 9 - "routes/auth.ts"
Cohesion: 0.18
Nodes (9): env, admin(), auth(), mod(), roleOf(), signToken(), authRoutes, Log (+1 more)

### Community 10 - "tileTypes.ts"
Cohesion: 0.27
Nodes (12): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS, tileCost() (+4 more)

### Community 11 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 12 - "actions.ts"
Cohesion: 0.23
Nodes (11): depositAt(), depositPublic(), harvestQty(), resName(), takeFromDeposit(), RES_BY_ID, getPublicHealthState(), actions (+3 more)

### Community 13 - "package.json"
Cohesion: 0.21
Nodes (12): devDependencies, tsx@^4, @types/node@^22, @types/pg@^8, typescript@^5, vitest@^2, name, type (+4 more)

### Community 14 - "movement.ts"
Cohesion: 0.36
Nodes (10): ignite(), blockedMsg(), isWater(), onLand(), pathCost(), spend(), stepCost(), travel() (+2 more)

### Community 15 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 16 - "index.ts"
Cohesion: 0.22
Nodes (8): @hono/node-server@^1, @hono/node-ws@^1, @hono/node-server, @hono/node-ws, app, { injectWebSocket, upgradeWebSocket }, joinMap(), leave()

### Community 17 - "world.test.ts"
Cohesion: 0.25
Nodes (6): BURN_HOURS, GROUPS, RESOURCES, BURN_DAMAGE, MAP_HUMAN, all()

### Community 18 - "clock.ts"
Cohesion: 0.36
Nodes (5): catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), state

### Community 19 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, hono@^4, @hono/zod-openapi@^0.16, pg@^8, zod@^3, hono, pg, zod

### Community 20 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 21 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `app.ts`, `spells.ts`, `tick.ts`, `characters.ts`, `rules.test.ts`, `routes/auth.ts`, `guilds.ts`, `actions.ts`, `movement.ts`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.06143488323164317 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `fail`, `spells.ts`, `tick.ts`, `world2.ts`, `rules.test.ts`, `tileTypes.ts`, `package.json`, `movement.ts`, `world.test.ts`, `clock.ts`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07002012072434607 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `app.ts` to `fail`, `tick.ts`, `characters.ts`, `package.json`, `dependencies`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09653092006033183 - nodes in this community are weakly interconnected._
- **Should `tick.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09574468085106383 - nodes in this community are weakly interconnected._
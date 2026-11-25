# Graph Report - back  (2026-11-25)

## Corpus Check
- 113 files · ~64,902 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 554 nodes · 1632 edges · 18 communities (17 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d83a16d6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.ts
- admin.ts
- fail
- with
- spells.ts
- tick.ts
- characters.ts
- world2.ts
- package.json
- terrain.ts
- actions.ts
- tileTypes.ts
- rules.test.ts
- movement.ts
- compilerOptions
- terrain
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 73 edges
2. `vitest` - 42 edges
3. `router()` - 33 edges
4. `def()` - 31 edges
5. `pool` - 30 edges
6. `terrain()` - 30 edges
7. `P()` - 27 edges
8. `ownChar()` - 19 edges
9. `log()` - 18 edges
10. `tx()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `checkFamily()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/items.ts → src/lib/db.ts
- `requireMonster()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/monsterDetails.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (18 total, 1 thin omitted)

### Community 0 - "app.ts"
Cohesion: 0.05
Nodes (35): hono@^4, hono, vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H (+27 more)

### Community 1 - "admin.ts"
Cohesion: 0.07
Nodes (51): pool, bumpContent(), cfgAll(), cfgNum(), divineCap(), audit(), adminRoutes, bestiaryRoutes (+43 more)

### Community 2 - "fail"
Cohesion: 0.09
Nodes (43): @hono/zod-openapi, assertCap(), checkEntityCost(), monsterOnMap(), dist(), fail(), log(), ownChar() (+35 more)

### Community 3 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 4 - "spells.ts"
Cohesion: 0.13
Nodes (32): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+24 more)

### Community 5 - "tick.ts"
Cohesion: 0.09
Nodes (28): monsterDeath(), scheduleRespawn(), regenDeposits(), applySpec(), die(), grantDivine(), held(), KIND (+20 more)

### Community 6 - "characters.ts"
Cohesion: 0.09
Nodes (31): activeMount(), bagOf(), checkReq(), Cond, CondT, hasReq(), missingFor(), Mode (+23 more)

### Community 7 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (30): dependencies, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3, devDependencies (+22 more)

### Community 9 - "terrain.ts"
Cohesion: 0.12
Nodes (18): CODES, FEATURES, H, ROWS, W, BY_CODE, CELLS, humanCell() (+10 more)

### Community 10 - "actions.ts"
Cohesion: 0.19
Nodes (13): depositAt(), depositPublic(), harvestQty(), resName(), takeFromDeposit(), RES_BY_ID, getPublicHealthState(), TILE_KINDS (+5 more)

### Community 11 - "tileTypes.ts"
Cohesion: 0.29
Nodes (11): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), tileCost(), tileHpDelta() (+3 more)

### Community 12 - "rules.test.ts"
Cohesion: 0.23
Nodes (10): canUseDivineEnergy(), computeHitChance(), computePactStatTransfer(), pathEnergy(), routeEnergy(), StatRule, statUpgradeCost(), walk() (+2 more)

### Community 13 - "movement.ts"
Cohesion: 0.26
Nodes (10): BLOCKING, BURN_HOURS, ignite(), blockedMsg(), isWater(), pathCost(), spend(), stepCost() (+2 more)

### Community 14 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 15 - "terrain"
Cohesion: 0.27
Nodes (8): GROUPS, RESOURCES, h0(), MAP_HUMAN, procNoise(), terrain(), find(), all()

### Community 16 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `app.ts`, `admin.ts`, `spells.ts`, `tick.ts`, `characters.ts`, `actions.ts`, `movement.ts`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05052631578947368 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `admin.ts`, `fail`, `spells.ts`, `tick.ts`, `world2.ts`, `package.json`, `tileTypes.ts`, `rules.test.ts`, `movement.ts`, `terrain`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `admin.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06521739130434782 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `fail` to `package.json`, `app.ts`, `characters.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.09262510974539069 - nodes in this community are weakly interconnected._
- **Should `with` be split into smaller, more focused modules?**
  _Cohesion score 0.04541062801932367 - nodes in this community are weakly interconnected._
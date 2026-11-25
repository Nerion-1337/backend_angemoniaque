# Graph Report - back  (2026-11-25)

## Corpus Check
- 119 files · ~72,456 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 576 nodes · 1723 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `129963bf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- route.ts
- app.ts
- rankUp.ts
- fail
- spells.ts
- with
- package.json
- world2.ts
- terrain.ts
- actions.ts
- tileTypes.ts
- rules.test.ts
- movement.ts
- compilerOptions
- terrain
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 80 edges
2. `vitest` - 47 edges
3. `router()` - 32 edges
4. `terrain()` - 31 edges
5. `def()` - 30 edges
6. `pool` - 29 edges
7. `P()` - 26 edges
8. `log()` - 22 edges
9. `ownChar()` - 19 edges
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
- `checkSummon()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/monsterDetails.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (17 total, 1 thin omitted)

### Community 0 - "route.ts"
Cohesion: 0.05
Nodes (75): @hono/zod-openapi, pool, bumpContent(), Requirements, RespawnLimit, audit(), tx(), def() (+67 more)

### Community 1 - "app.ts"
Cohesion: 0.06
Nodes (28): hono@^4, hono, vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H (+20 more)

### Community 2 - "rankUp.ts"
Cohesion: 0.06
Nodes (51): activate(), Activation, Group, groupMissing(), GroupT, hasActivation(), monsterDeath(), scheduleRespawn() (+43 more)

### Community 3 - "fail"
Cohesion: 0.06
Nodes (43): checkActivation(), assertCap(), checkEntityCost(), monsterOnMap(), activeMount(), checkReq(), MODES, checkKit() (+35 more)

### Community 4 - "spells.ts"
Cohesion: 0.13
Nodes (37): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+29 more)

### Community 5 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 6 - "package.json"
Cohesion: 0.08
Nodes (30): dependencies, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3, devDependencies (+22 more)

### Community 7 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 8 - "terrain.ts"
Cohesion: 0.11
Nodes (21): CODES, FEATURES, H, ROWS, W, BY_CODE, CELLS, h0() (+13 more)

### Community 9 - "actions.ts"
Cohesion: 0.19
Nodes (13): depositAt(), depositPublic(), harvestQty(), resName(), takeFromDeposit(), RES_BY_ID, getPublicHealthState(), TILE_KINDS (+5 more)

### Community 10 - "tileTypes.ts"
Cohesion: 0.29
Nodes (11): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), tileCost(), tileHpDelta() (+3 more)

### Community 11 - "rules.test.ts"
Cohesion: 0.23
Nodes (10): canUseDivineEnergy(), computeHitChance(), computePactStatTransfer(), pathEnergy(), routeEnergy(), StatRule, statUpgradeCost(), walk() (+2 more)

### Community 12 - "movement.ts"
Cohesion: 0.28
Nodes (10): BLOCKING, BURN_HOURS, ignite(), blockedMsg(), isWater(), onLand(), pathCost(), stepCost() (+2 more)

### Community 13 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 14 - "terrain"
Cohesion: 0.32
Nodes (6): GROUPS, RESOURCES, MAP_HUMAN, terrain(), find(), all()

### Community 15 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `route.ts`, `app.ts`, `rankUp.ts`, `spells.ts`, `actions.ts`, `movement.ts`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05387397677517609 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `rankUp.ts`, `fail`, `spells.ts`, `package.json`, `world2.ts`, `tileTypes.ts`, `rules.test.ts`, `movement.ts`, `terrain`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05627545353572751 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `route.ts` to `app.ts`, `rankUp.ts`, `fail`, `package.json`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `rankUp.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05674044265593561 - nodes in this community are weakly interconnected._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.061367621274108705 - nodes in this community are weakly interconnected._
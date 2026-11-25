# Graph Report - back  (2026-11-25)

## Corpus Check
- 118 files · ~70,470 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 572 nodes · 1711 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `81fa9776`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- route.ts
- app.ts
- fail
- spells.ts
- with
- combatlib.ts
- characters.ts
- terrain.ts
- package.json
- world2.ts
- actions.ts
- tileTypes.ts
- rules.test.ts
- movement.ts
- compilerOptions
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 79 edges
2. `vitest` - 46 edges
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
- `checkSpawn()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/races.ts → src/lib/db.ts
- `checkCreation()` --calls--> `fail()`  [EXTRACTED]
  src/routes/characters.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (17 total, 1 thin omitted)

### Community 0 - "route.ts"
Cohesion: 0.06
Nodes (62): pool, bumpContent(), cfgAll(), divineCap(), Requirements, audit(), def(), P() (+54 more)

### Community 1 - "app.ts"
Cohesion: 0.06
Nodes (26): vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket } (+18 more)

### Community 2 - "fail"
Cohesion: 0.07
Nodes (39): @hono/zod-openapi, assertCap(), checkEntityCost(), monsterOnMap(), computePactStatTransfer(), fail(), ownChar(), posOf() (+31 more)

### Community 3 - "spells.ts"
Cohesion: 0.11
Nodes (40): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+32 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "combatlib.ts"
Cohesion: 0.10
Nodes (30): monsterDeath(), scheduleRespawn(), cfgNum(), regenDeposits(), applySpec(), die(), grantDivine(), held() (+22 more)

### Community 6 - "characters.ts"
Cohesion: 0.09
Nodes (34): activate(), Activation, checkActivation(), Group, groupMissing(), GroupT, hasActivation(), activeMount() (+26 more)

### Community 7 - "terrain.ts"
Cohesion: 0.09
Nodes (27): CODES, FEATURES, H, ROWS, W, GROUPS, RESOURCES, BY_CODE (+19 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 9 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 10 - "actions.ts"
Cohesion: 0.21
Nodes (12): depositAt(), depositPublic(), harvestQty(), resName(), takeFromDeposit(), RES_BY_ID, getPublicHealthState(), trimLog() (+4 more)

### Community 11 - "tileTypes.ts"
Cohesion: 0.28
Nodes (11): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS, tileHpDelta() (+3 more)

### Community 12 - "rules.test.ts"
Cohesion: 0.23
Nodes (10): pathCost(), canUseDivineEnergy(), computeHitChance(), pathEnergy(), routeEnergy(), StatRule, statUpgradeCost(), walk() (+2 more)

### Community 13 - "movement.ts"
Cohesion: 0.30
Nodes (10): BLOCKING, BURN_HOURS, ignite(), blockedMsg(), isWater(), onLand(), stepCost(), travel() (+2 more)

### Community 14 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 15 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `route.ts`, `app.ts`, `spells.ts`, `combatlib.ts`, `characters.ts`, `actions.ts`, `movement.ts`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06460674157303371 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `route.ts`, `fail`, `spells.ts`, `combatlib.ts`, `terrain.ts`, `package.json`, `world2.ts`, `tileTypes.ts`, `rules.test.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05875251509054326 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `fail` to `route.ts`, `app.ts`, `combatlib.ts`, `characters.ts`, `package.json`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.06638714185883997 - nodes in this community are weakly interconnected._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10761705101327743 - nodes in this community are weakly interconnected._
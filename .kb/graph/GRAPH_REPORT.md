# Graph Report - back  (2026-11-25)

## Corpus Check
- 130 files · ~80,744 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 626 nodes · 1901 edges · 18 communities (17 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a61cbd10`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admin.ts
- app.ts
- spells.ts
- fail
- with
- admin/deposits.ts
- characters.ts
- world2.ts
- package.json
- terrain.ts
- movement.ts
- tileTypes.ts
- rules.test.ts
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

## Communities (18 total, 1 thin omitted)

### Community 0 - "admin.ts"
Cohesion: 0.05
Nodes (61): pool, Activation, bumpContent(), cfgAll(), cfgNum(), divineCap(), Requirements, audit() (+53 more)

### Community 1 - "app.ts"
Cohesion: 0.05
Nodes (32): vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket } (+24 more)

### Community 2 - "spells.ts"
Cohesion: 0.07
Nodes (56): ATTACK_LABEL, attackAllowed(), AttackKind, BLOCKING, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget() (+48 more)

### Community 3 - "fail"
Cohesion: 0.08
Nodes (50): @hono/zod-openapi, bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots(), resStacks() (+42 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "admin/deposits.ts"
Cohesion: 0.10
Nodes (34): activate(), checkActivation(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll() (+26 more)

### Community 6 - "characters.ts"
Cohesion: 0.09
Nodes (33): applySpec(), die(), grantDivine(), held(), KIND, refreshSurcharge(), required(), rollLoot() (+25 more)

### Community 7 - "world2.ts"
Cohesion: 0.10
Nodes (28): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+20 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 9 - "terrain.ts"
Cohesion: 0.10
Nodes (22): CODES, H, ROWS, W, RARE3, RES3_BY_ID, RESOURCES3, BY_CODE (+14 more)

### Community 10 - "movement.ts"
Cohesion: 0.22
Nodes (13): BURN_HOURS, ignite(), activeMount(), actor(), blockedMsg(), isWater(), mountPassives(), onLand() (+5 more)

### Community 11 - "tileTypes.ts"
Cohesion: 0.27
Nodes (12): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS, tileCost() (+4 more)

### Community 12 - "rules.test.ts"
Cohesion: 0.23
Nodes (11): canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), effectiveRank(), pathEnergy(), routeEnergy(), StatRule (+3 more)

### Community 13 - "terrain"
Cohesion: 0.36
Nodes (9): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, terrain(), find() (+1 more)

### Community 14 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 15 - "world.test.ts"
Cohesion: 0.29
Nodes (6): FEATURES, GROUPS, RES_BY_ID, RESOURCES, MAP_HUMAN, all()

### Community 16 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `admin.ts`, `app.ts`, `spells.ts`, `admin/deposits.ts`, `characters.ts`, `world2.ts`, `movement.ts`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `admin.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05123456790123457 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `admin.ts`, `spells.ts`, `fail`, `admin/deposits.ts`, `characters.ts`, `world2.ts`, `package.json`, `movement.ts`, `tileTypes.ts`, `rules.test.ts`, `terrain`, `world.test.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `app.ts`, `spells.ts`, `fail`, `admin/deposits.ts`, `characters.ts`, `world2.ts`, `terrain.ts`, `movement.ts`, `tileTypes.ts`, `rules.test.ts`, `world.test.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0694579681921454 - nodes in this community are weakly interconnected._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.07855855855855856 - nodes in this community are weakly interconnected._
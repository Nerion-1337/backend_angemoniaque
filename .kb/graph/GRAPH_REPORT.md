# Graph Report - back  (2026-11-26)

## Corpus Check
- 145 files · ~95,022 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 727 nodes · 2198 edges · 26 communities (25 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a0ccbcca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- combat.ts
- routes/auth.ts
- app.ts
- tick.ts
- with
- market.ts
- terrain.ts
- package.json
- world2.ts
- items.ts
- admin.ts
- forum.ts
- route.ts
- characters.ts
- movement.ts
- fail
- pool
- rules.test.ts
- tileTypes.ts
- guilds.ts
- terrain
- compilerOptions
- admin/entity.ts
- AGENTS.md — ia_agent / back
- game/entity.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 92 edges
2. `vitest` - 62 edges
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

## Communities (26 total, 1 thin omitted)

### Community 0 - "combat.ts"
Cohesion: 0.08
Nodes (57): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), monsterDeath() (+49 more)

### Community 1 - "routes/auth.ts"
Cohesion: 0.06
Nodes (49): hono, app, env, WEAK, { injectWebSocket, upgradeWebSocket }, b64(), botCheck(), clientIp() (+41 more)

### Community 2 - "app.ts"
Cohesion: 0.08
Nodes (14): vitest, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), HttpError, buildings, faiths (+6 more)

### Community 3 - "tick.ts"
Cohesion: 0.08
Nodes (32): cfgNum(), divineCap(), applySpec(), die(), grantDivine(), held(), KIND, refreshSurcharge() (+24 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "market.ts"
Cohesion: 0.11
Nodes (33): activate(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), bagRoom(), bagState() (+25 more)

### Community 6 - "terrain.ts"
Cohesion: 0.08
Nodes (30): BURN_HOURS, CODES, FEATURES, H, ROWS, W, RARE3, RES3_BY_ID (+22 more)

### Community 7 - "package.json"
Cohesion: 0.08
Nodes (31): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+23 more)

### Community 8 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 9 - "items.ts"
Cohesion: 0.11
Nodes (24): Activation, Building, buildingRoutes, colsOf(), extras(), jsonable(), RARITIES, requireRow() (+16 more)

### Community 10 - "admin.ts"
Cohesion: 0.09
Nodes (23): audit(), adminRoutes, bestiaryRoutes, coreRoutes, RESCATALOG, checkSummon(), LINK_TBL, monsterDetailRoutes (+15 more)

### Community 11 - "forum.ts"
Cohesion: 0.12
Nodes (21): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+13 more)

### Community 12 - "route.ts"
Cohesion: 0.22
Nodes (16): @hono/zod-openapi, ownChar(), tx(), def(), P(), router(), Tile, CHOICES (+8 more)

### Community 13 - "characters.ts"
Cohesion: 0.11
Nodes (22): bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES, nextRank() (+14 more)

### Community 14 - "movement.ts"
Cohesion: 0.16
Nodes (18): BLOCKING, ignite(), actor(), blockedMsg(), isWater(), mountPassives(), onLand(), pathCost() (+10 more)

### Community 15 - "fail"
Cohesion: 0.16
Nodes (16): checkActivation(), checkReq(), checkKit(), resourceExists(), fail(), check(), depositRoutes, KIND_FR (+8 more)

### Community 16 - "pool"
Cohesion: 0.18
Nodes (9): pool, bumpContent(), cfgAll(), Place, checkSpawn(), Race, raceRoutes, RankDiff (+1 more)

### Community 17 - "rules.test.ts"
Cohesion: 0.20
Nodes (13): canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), effectiveRank(), getPublicHealthState(), pathEnergy(), routeEnergy() (+5 more)

### Community 18 - "tileTypes.ts"
Cohesion: 0.25
Nodes (12): KIND_COST, KIND_LABEL, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS (+4 more)

### Community 19 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 20 - "terrain"
Cohesion: 0.36
Nodes (9): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, terrain(), find() (+1 more)

### Community 21 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 22 - "admin/entity.ts"
Cohesion: 0.29
Nodes (6): kindOf(), TABLE, Cap, Cost, entityRoutes, Mod

### Community 23 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 24 - "game/entity.ts"
Cohesion: 0.53
Nodes (3): assertCap(), checkEntityCost(), monsterOnMap()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `combat.ts`, `routes/auth.ts`, `app.ts`, `tick.ts`, `market.ts`, `items.ts`, `admin.ts`, `forum.ts`, `route.ts`, `characters.ts`, `movement.ts`, `pool`, `guilds.ts`, `admin/entity.ts`, `game/entity.ts`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07960014809329878 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `combat.ts`, `routes/auth.ts`, `tick.ts`, `market.ts`, `terrain.ts`, `package.json`, `world2.ts`, `forum.ts`, `movement.ts`, `pool`, `rules.test.ts`, `tileTypes.ts`, `terrain`, `game/entity.ts`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `routes/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061072261072261075 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `combat.ts`, `app.ts`, `tick.ts`, `market.ts`, `terrain.ts`, `world2.ts`, `route.ts`, `movement.ts`, `pool`, `rules.test.ts`, `tileTypes.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07706766917293233 - nodes in this community are weakly interconnected._
- **Should `tick.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08244680851063829 - nodes in this community are weakly interconnected._
# Graph Report - back  (2026-11-26)

## Corpus Check
- 145 files · ~94,906 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 726 nodes · 2197 edges · 21 communities (20 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d1ff236a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- pool
- combat.ts
- app.ts
- fail
- route.ts
- routes/auth.ts
- with
- tick.ts
- package.json
- admin/deposits.ts
- world2.ts
- terrain.ts
- forum.ts
- map.ts
- rules.test.ts
- game/divine.ts
- movement.ts
- terrain
- compilerOptions
- AGENTS.md — ia_agent / back

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

## Communities (21 total, 1 thin omitted)

### Community 0 - "pool"
Cohesion: 0.05
Nodes (60): pool, bumpContent(), cfgAll(), cfgNum(), divineCap(), audit(), adminRoutes, bestiaryRoutes (+52 more)

### Community 1 - "combat.ts"
Cohesion: 0.08
Nodes (54): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+46 more)

### Community 2 - "app.ts"
Cohesion: 0.07
Nodes (20): hono, vitest, HttpError, admin(), auth(), bearer(), dbRole(), mod() (+12 more)

### Community 3 - "fail"
Cohesion: 0.05
Nodes (49): checkActivation(), applySpec(), assertCap(), checkEntityCost(), monsterOnMap(), bagOf(), checkReq(), Cond (+41 more)

### Community 4 - "route.ts"
Cohesion: 0.13
Nodes (37): @hono/zod-openapi, bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots(), resStacks() (+29 more)

### Community 5 - "routes/auth.ts"
Cohesion: 0.07
Nodes (43): app, env, WEAK, { injectWebSocket, upgradeWebSocket }, b64(), botCheck(), clientIp(), COMMON (+35 more)

### Community 6 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 7 - "tick.ts"
Cohesion: 0.09
Nodes (24): catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), scheduleRespawn(), regenDeposits(), revertTempRanks(), attachDivine() (+16 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (31): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+23 more)

### Community 9 - "admin/deposits.ts"
Cohesion: 0.14
Nodes (26): activate(), Activation, describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll() (+18 more)

### Community 10 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 11 - "terrain.ts"
Cohesion: 0.09
Nodes (24): CODES, FEATURES, H, ROWS, W, GROUPS, RES_BY_ID, RESOURCES (+16 more)

### Community 12 - "forum.ts"
Cohesion: 0.14
Nodes (19): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+11 more)

### Community 13 - "map.ts"
Cohesion: 0.20
Nodes (16): getPublicHealthState(), KIND_COST, KIND_LABEL, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest() (+8 more)

### Community 14 - "rules.test.ts"
Cohesion: 0.18
Nodes (13): RARE3, RES3_BY_ID, RESOURCES3, canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), pathEnergy() (+5 more)

### Community 15 - "game/divine.ts"
Cohesion: 0.24
Nodes (11): monsterDeath(), die(), grantDivine(), held(), KIND, refreshSurcharge(), required(), SPEC_STATS (+3 more)

### Community 16 - "movement.ts"
Cohesion: 0.24
Nodes (11): BLOCKING, BURN_HOURS, ignite(), blockedMsg(), isWater(), mountPassives(), onLand(), pathCost() (+3 more)

### Community 17 - "terrain"
Cohesion: 0.36
Nodes (9): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, terrain(), find() (+1 more)

### Community 18 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 19 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `pool`, `combat.ts`, `app.ts`, `route.ts`, `routes/auth.ts`, `tick.ts`, `admin/deposits.ts`, `forum.ts`, `game/divine.ts`, `movement.ts`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Should `pool` be split into smaller, more focused modules?**
  _Cohesion score 0.05387861084063616 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `pool`, `combat.ts`, `fail`, `routes/auth.ts`, `tick.ts`, `package.json`, `admin/deposits.ts`, `world2.ts`, `terrain.ts`, `forum.ts`, `map.ts`, `rules.test.ts`, `game/divine.ts`, `movement.ts`, `terrain`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07887323943661972 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `combat.ts`, `app.ts`, `route.ts`, `tick.ts`, `admin/deposits.ts`, `world2.ts`, `terrain.ts`, `map.ts`, `rules.test.ts`, `game/divine.ts`, `movement.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06646825396825397 - nodes in this community are weakly interconnected._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.051203277009728626 - nodes in this community are weakly interconnected._
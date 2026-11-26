# Graph Report - back  (2026-11-26)

## Corpus Check
- 145 files · ~94,639 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 726 nodes · 2195 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2be55314`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fail
- combat.ts
- pool
- app.ts
- routes/auth.ts
- with
- tick.ts
- admin/deposits.ts
- terrain.ts
- package.json
- world2.ts
- rankUp.ts
- forum.ts
- rules.test.ts
- movement.ts
- tileTypes.ts
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

## Communities (20 total, 1 thin omitted)

### Community 0 - "fail"
Cohesion: 0.06
Nodes (73): @hono/zod-openapi, checkActivation(), bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots() (+65 more)

### Community 1 - "combat.ts"
Cohesion: 0.08
Nodes (57): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+49 more)

### Community 2 - "pool"
Cohesion: 0.06
Nodes (56): pool, bumpContent(), cfgAll(), cfgNum(), divineCap(), audit(), adminRoutes, bestiaryRoutes (+48 more)

### Community 3 - "app.ts"
Cohesion: 0.07
Nodes (19): hono, vitest, HttpError, admin(), auth(), bearer(), dbRole(), mod() (+11 more)

### Community 4 - "routes/auth.ts"
Cohesion: 0.07
Nodes (45): app, env, WEAK, { injectWebSocket, upgradeWebSocket }, b64(), botCheck(), clientIp(), COMMON (+37 more)

### Community 5 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 6 - "tick.ts"
Cohesion: 0.09
Nodes (23): catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), scheduleRespawn(), regenDeposits(), attachDivine(), divineHeld() (+15 more)

### Community 7 - "admin/deposits.ts"
Cohesion: 0.13
Nodes (27): activate(), Activation, describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll() (+19 more)

### Community 8 - "terrain.ts"
Cohesion: 0.09
Nodes (25): CODES, FEATURES, H, ROWS, W, GROUPS, RES_BY_ID, RESOURCES (+17 more)

### Community 9 - "package.json"
Cohesion: 0.08
Nodes (31): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+23 more)

### Community 10 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 11 - "rankUp.ts"
Cohesion: 0.12
Nodes (24): monsterDeath(), applySpec(), die(), grantDivine(), held(), KIND, refreshSurcharge(), required() (+16 more)

### Community 12 - "forum.ts"
Cohesion: 0.14
Nodes (19): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+11 more)

### Community 13 - "rules.test.ts"
Cohesion: 0.16
Nodes (15): RARE3, RES3_BY_ID, RESOURCES3, canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), getPublicHealthState() (+7 more)

### Community 14 - "movement.ts"
Cohesion: 0.23
Nodes (12): BLOCKING, BURN_HOURS, ignite(), blockedMsg(), isWater(), mountPassives(), onLand(), pathCost() (+4 more)

### Community 15 - "tileTypes.ts"
Cohesion: 0.27
Nodes (12): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS, tileCost() (+4 more)

### Community 16 - "terrain"
Cohesion: 0.36
Nodes (9): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, terrain(), find() (+1 more)

### Community 17 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 18 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `combat.ts`, `pool`, `app.ts`, `routes/auth.ts`, `tick.ts`, `admin/deposits.ts`, `rankUp.ts`, `forum.ts`, `movement.ts`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.056043956043956046 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `fail`, `combat.ts`, `pool`, `routes/auth.ts`, `tick.ts`, `admin/deposits.ts`, `terrain.ts`, `package.json`, `world2.ts`, `rankUp.ts`, `forum.ts`, `rules.test.ts`, `movement.ts`, `tileTypes.ts`, `terrain`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07675675675675675 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `fail`, `combat.ts`, `app.ts`, `tick.ts`, `admin/deposits.ts`, `terrain.ts`, `world2.ts`, `rules.test.ts`, `movement.ts`, `tileTypes.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `pool` be split into smaller, more focused modules?**
  _Cohesion score 0.058126619770455384 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06810035842293907 - nodes in this community are weakly interconnected._
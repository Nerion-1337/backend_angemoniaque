# Graph Report - back  (2026-11-27)

## Corpus Check
- 152 files · ~102,475 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 775 nodes · 2369 edges · 22 communities (21 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8302a638`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- spells.ts
- terrain.ts
- app.ts
- routes/auth.ts
- combat.ts
- with
- game/faithPact.ts
- game/deposits.ts
- package.json
- world2.ts
- pool
- items.ts
- forum.ts
- fail
- route.ts
- admin.ts
- guilds.ts
- rankUp.ts
- compilerOptions
- admin/deposits.ts
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 97 edges
2. `vitest` - 65 edges
3. `terrain()` - 40 edges
4. `router()` - 36 edges
5. `pool` - 35 edges
6. `def()` - 34 edges
7. `P()` - 28 edges
8. `log()` - 25 edges
9. `tx()` - 19 edges
10. `ownChar()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `find()` --calls--> `levelAt()`  [EXTRACTED]
  test/levels.test.ts → src/game/levels.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/levels.test.ts → src/game/terrain.ts

## Import Cycles
- None detected.

## Communities (22 total, 1 thin omitted)

### Community 0 - "spells.ts"
Cohesion: 0.05
Nodes (67): ATTACK_LABEL, attackAllowed(), AttackKind, BLOCKING, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget() (+59 more)

### Community 1 - "terrain.ts"
Cohesion: 0.05
Nodes (64): BURN_HOURS, ignite(), CODES, FEATURES, H, ROWS, W, actorAir() (+56 more)

### Community 2 - "app.ts"
Cohesion: 0.06
Nodes (24): hono, vitest, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), regenDeposits(), revertTempRanks() (+16 more)

### Community 3 - "routes/auth.ts"
Cohesion: 0.06
Nodes (46): app, env, WEAK, { injectWebSocket, upgradeWebSocket }, b64(), botCheck(), clientIp(), COMMON (+38 more)

### Community 4 - "combat.ts"
Cohesion: 0.08
Nodes (47): activeMount(), actor(), summonLoco(), actorElevation(), attackRange(), dist3(), groundReach(), mountElevation() (+39 more)

### Community 5 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 6 - "game/faithPact.ts"
Cohesion: 0.09
Nodes (32): cfgAll(), applyBuff(), Blessing, blessingCost(), CARD_SQL, defaultMaxPacts(), FAITH_DEFAULT, FaithCfg (+24 more)

### Community 7 - "game/deposits.ts"
Cohesion: 0.13
Nodes (28): activate(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), bagRoom(), bagState() (+20 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (31): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+23 more)

### Community 9 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 10 - "pool"
Cohesion: 0.13
Nodes (18): pool, bumpContent(), divineCap(), attachDivine(), divineHeld(), inCirculation(), respawnBlockers(), RespawnLimit (+10 more)

### Community 11 - "items.ts"
Cohesion: 0.11
Nodes (25): Activation, Building, buildingRoutes, colsOf(), extras(), jsonable(), kindOf(), RARITIES (+17 more)

### Community 12 - "forum.ts"
Cohesion: 0.12
Nodes (21): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+13 more)

### Community 13 - "fail"
Cohesion: 0.12
Nodes (22): checkActivation(), checkReq(), checkKit(), grantKit(), Kit, KitT, resourceExists(), startRank() (+14 more)

### Community 14 - "route.ts"
Cohesion: 0.22
Nodes (15): @hono/zod-openapi, resStacks(), dist(), ownChar(), tx(), def(), P(), router() (+7 more)

### Community 15 - "admin.ts"
Cohesion: 0.11
Nodes (17): coreRoutes, checkSummon(), LINK_TBL, monsterDetailRoutes, requireMonster(), SLOTS, Spell, spellRoutes (+9 more)

### Community 16 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 17 - "rankUp.ts"
Cohesion: 0.20
Nodes (13): bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES, nextRank() (+5 more)

### Community 18 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 19 - "admin/deposits.ts"
Cohesion: 0.25
Nodes (7): KINDS, depositRoutes, KIND_FR, named(), one(), Sector, Share

### Community 20 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `spells.ts`, `terrain.ts`, `app.ts`, `routes/auth.ts`, `combat.ts`, `game/faithPact.ts`, `game/deposits.ts`, `pool`, `items.ts`, `forum.ts`, `route.ts`, `admin.ts`, `guilds.ts`, `rankUp.ts`, `admin/deposits.ts`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05482456140350877 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `spells.ts`, `terrain.ts`, `routes/auth.ts`, `combat.ts`, `game/deposits.ts`, `package.json`, `world2.ts`, `pool`, `forum.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05163511187607573 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain.ts` to `spells.ts`, `app.ts`, `combat.ts`, `game/deposits.ts`, `world2.ts`, `pool`, `route.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061175666438824335 - nodes in this community are weakly interconnected._
- **Should `routes/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06370543541788427 - nodes in this community are weakly interconnected._
# Graph Report - back  (2026-11-25)

## Corpus Check
- 121 files · ~74,621 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 590 nodes · 1777 edges · 16 communities (15 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3bf1b661`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admin/deposits.ts
- terrain.ts
- fail
- app.ts
- with
- spells.ts
- tick.ts
- world2.ts
- package.json
- rankUp.ts
- game/deposits.ts
- routes/auth.ts
- index.ts
- compilerOptions
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 80 edges
2. `vitest` - 48 edges
3. `terrain()` - 33 edges
4. `router()` - 32 edges
5. `def()` - 30 edges
6. `pool` - 29 edges
7. `P()` - 26 edges
8. `log()` - 22 edges
9. `ownChar()` - 19 edges
10. `tx()` - 18 edges

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

## Communities (16 total, 1 thin omitted)

### Community 0 - "admin/deposits.ts"
Cohesion: 0.05
Nodes (65): pool, Activation, bumpContent(), cfgAll(), cfgNum(), divineCap(), KINDS, RESOURCES2 (+57 more)

### Community 1 - "terrain.ts"
Cohesion: 0.05
Nodes (65): BLOCKING, BURN_HOURS, ignite(), depositPublic(), CODES, FEATURES, H, ROWS (+57 more)

### Community 2 - "fail"
Cohesion: 0.09
Nodes (45): @hono/zod-openapi, assertCap(), checkEntityCost(), monsterOnMap(), activeMount(), actor(), dist(), fail() (+37 more)

### Community 3 - "app.ts"
Cohesion: 0.08
Nodes (17): vitest, HttpError, trimLog(), actions, buildings, characters, combat, craft (+9 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "spells.ts"
Cohesion: 0.14
Nodes (33): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+25 more)

### Community 6 - "tick.ts"
Cohesion: 0.09
Nodes (28): monsterDeath(), scheduleRespawn(), regenDeposits(), applySpec(), die(), grantDivine(), held(), KIND (+20 more)

### Community 7 - "world2.ts"
Cohesion: 0.10
Nodes (28): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, SIDES, ZONES2, grantKit() (+20 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 9 - "rankUp.ts"
Cohesion: 0.09
Nodes (26): checkActivation(), bagOf(), checkReq(), Cond, CondT, hasReq(), missingFor(), Mode (+18 more)

### Community 10 - "game/deposits.ts"
Cohesion: 0.22
Nodes (16): activate(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll(), depositAt() (+8 more)

### Community 11 - "routes/auth.ts"
Cohesion: 0.17
Nodes (9): env, admin(), auth(), mod(), roleOf(), signToken(), authRoutes, Log (+1 more)

### Community 12 - "index.ts"
Cohesion: 0.20
Nodes (9): app, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket }, joinMap(), leave() (+1 more)

### Community 13 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 14 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `admin/deposits.ts`, `terrain.ts`, `app.ts`, `spells.ts`, `tick.ts`, `world2.ts`, `rankUp.ts`, `game/deposits.ts`, `routes/auth.ts`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Should `admin/deposits.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05078855920876771 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `admin/deposits.ts`, `terrain.ts`, `fail`, `spells.ts`, `tick.ts`, `world2.ts`, `package.json`, `game/deposits.ts`, `routes/auth.ts`, `index.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05249569707401033 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `fail` to `package.json`, `app.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.09358178053830228 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08067375886524823 - nodes in this community are weakly interconnected._
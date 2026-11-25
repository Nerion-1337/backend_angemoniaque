# Graph Report - back  (2026-11-25)

## Corpus Check
- 113 files · ~65,401 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 554 nodes · 1620 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f8d808a9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- route.ts
- terrain.ts
- app.ts
- fail
- with
- spells.ts
- tick.ts
- world2.ts
- package.json
- routes/auth.ts
- compilerOptions
- devDependencies
- clock.ts
- AGENTS.md — ia_agent / back
- scripts
- index.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 72 edges
2. `vitest` - 43 edges
3. `router()` - 32 edges
4. `terrain()` - 30 edges
5. `def()` - 30 edges
6. `pool` - 29 edges
7. `P()` - 26 edges
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
- `checkSpawn()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/races.ts → src/lib/db.ts
- `actor()` --calls--> `occupiableAt()`  [EXTRACTED]
  src/game/movement.ts → src/game/buildingCell.ts

## Import Cycles
- None detected.

## Communities (17 total, 1 thin omitted)

### Community 0 - "route.ts"
Cohesion: 0.07
Nodes (58): pool, bumpContent(), Requirements, audit(), def(), P(), router(), bestiaryRoutes (+50 more)

### Community 1 - "terrain.ts"
Cohesion: 0.05
Nodes (64): BLOCKING, BURN_HOURS, ignite(), depositAt(), CODES, FEATURES, H, ROWS (+56 more)

### Community 2 - "app.ts"
Cohesion: 0.07
Nodes (41): @hono/zod-openapi, vitest, activeMount(), actor(), spend(), dist(), HttpError, log() (+33 more)

### Community 3 - "fail"
Cohesion: 0.06
Nodes (43): assertCap(), checkEntityCost(), monsterOnMap(), bagOf(), checkReq(), Cond, CondT, hasReq() (+35 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "spells.ts"
Cohesion: 0.11
Nodes (31): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), scheduleRespawn() (+23 more)

### Community 6 - "tick.ts"
Cohesion: 0.10
Nodes (29): monsterDeath(), cfgAll(), cfgNum(), divineCap(), regenDeposits(), applySpec(), die(), grantDivine() (+21 more)

### Community 7 - "world2.ts"
Cohesion: 0.10
Nodes (30): FEATURES2, H2, ROWS2, W2, depositPublic(), harvestQty(), resName(), takeFromDeposit() (+22 more)

### Community 8 - "package.json"
Cohesion: 0.16
Nodes (16): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+8 more)

### Community 9 - "routes/auth.ts"
Cohesion: 0.18
Nodes (9): env, admin(), auth(), mod(), roleOf(), signToken(), authRoutes, Log (+1 more)

### Community 10 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 11 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, tsx@^4, @types/node@^22, @types/pg@^8, typescript@^5, vitest@^2, tsx, @types/node (+2 more)

### Community 12 - "clock.ts"
Cohesion: 0.33
Nodes (5): catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), state

### Community 13 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 14 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 15 - "index.ts"
Cohesion: 0.40
Nodes (4): app, { injectWebSocket, upgradeWebSocket }, joinMap(), leave()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `route.ts`, `terrain.ts`, `app.ts`, `spells.ts`, `tick.ts`, `world2.ts`, `routes/auth.ts`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06758742286218043 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `route.ts`, `terrain.ts`, `fail`, `spells.ts`, `tick.ts`, `world2.ts`, `package.json`, `devDependencies`, `clock.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0531883632089333 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `app.ts` to `package.json`, `route.ts`, `fail`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07067901234567901 - nodes in this community are weakly interconnected._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
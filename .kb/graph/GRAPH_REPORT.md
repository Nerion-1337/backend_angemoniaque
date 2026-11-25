# Graph Report - back  (2026-11-25)

## Corpus Check
- 114 files · ~66,080 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 555 nodes · 1624 edges · 15 communities (13 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aebdccb9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- terrain.ts
- fail
- pool
- spells.ts
- characters.ts
- with
- world2.ts
- app.ts
- package.json
- routes/auth.ts
- index.ts
- compilerOptions
- AGENTS.md — ia_agent / back
- HttpError

## God Nodes (most connected - your core abstractions)
1. `fail()` - 72 edges
2. `vitest` - 44 edges
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
- `checkFamily()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/items.ts → src/lib/db.ts
- `requireMonster()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/monsterDetails.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (15 total, 2 thin omitted)

### Community 0 - "terrain.ts"
Cohesion: 0.06
Nodes (61): BLOCKING, BURN_HOURS, ignite(), depositAt(), CODES, FEATURES, H, ROWS (+53 more)

### Community 1 - "fail"
Cohesion: 0.09
Nodes (49): @hono/zod-openapi, assertCap(), checkEntityCost(), monsterOnMap(), activeMount(), actor(), spend(), dist() (+41 more)

### Community 2 - "pool"
Cohesion: 0.06
Nodes (52): pool, bumpContent(), cfgAll(), cfgNum(), divineCap(), grantDivine(), rollLoot(), invalidateTiles() (+44 more)

### Community 3 - "spells.ts"
Cohesion: 0.08
Nodes (44): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), monsterDeath() (+36 more)

### Community 4 - "characters.ts"
Cohesion: 0.07
Nodes (40): applySpec(), die(), held(), KIND, refreshSurcharge(), required(), bagOf(), checkReq() (+32 more)

### Community 5 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 6 - "world2.ts"
Cohesion: 0.08
Nodes (35): FEATURES2, H2, ROWS2, W2, depositPublic(), harvestQty(), resName(), takeFromDeposit() (+27 more)

### Community 7 - "app.ts"
Cohesion: 0.09
Nodes (14): vitest, actions, buildings, combat, craft, divine, faiths, inventory (+6 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (30): dependencies, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3, devDependencies (+22 more)

### Community 9 - "routes/auth.ts"
Cohesion: 0.15
Nodes (11): hono@^4, hono, env, admin(), auth(), mod(), roleOf(), signToken() (+3 more)

### Community 10 - "index.ts"
Cohesion: 0.20
Nodes (9): app, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket }, joinMap(), leave() (+1 more)

### Community 11 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 12 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `terrain.ts`, `pool`, `spells.ts`, `characters.ts`, `world2.ts`, `app.ts`, `routes/auth.ts`, `HttpError`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05561105561105561 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `terrain.ts`, `fail`, `pool`, `spells.ts`, `world2.ts`, `package.json`, `routes/auth.ts`, `index.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.08792792792792793 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `fail` to `package.json`, `characters.ts`, `app.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `pool` be split into smaller, more focused modules?**
  _Cohesion score 0.0609009009009009 - nodes in this community are weakly interconnected._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07787698412698413 - nodes in this community are weakly interconnected._
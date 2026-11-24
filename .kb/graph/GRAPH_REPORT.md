# Graph Report - back  (2026-11-24)

## Corpus Check
- 108 files · ~62,476 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 531 nodes · 1549 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bfa9829c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fail
- admin.ts
- terrain.ts
- app.ts
- ws.ts
- with
- spellEffects.ts
- world2.ts
- combatlib.ts
- rankUp.ts
- compilerOptions
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 69 edges
2. `vitest` - 40 edges
3. `router()` - 32 edges
4. `terrain()` - 30 edges
5. `def()` - 30 edges
6. `pool` - 28 edges
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

## Communities (13 total, 1 thin omitted)

### Community 0 - "fail"
Cohesion: 0.09
Nodes (51): @hono/zod-openapi, ignite(), targetAt(), assertCap(), checkEntityCost(), monsterOnMap(), activeMount(), actor() (+43 more)

### Community 1 - "admin.ts"
Cohesion: 0.06
Nodes (58): pool, bumpContent(), cfgAll(), cfgNum(), divineCap(), audit(), adminRoutes, bestiaryRoutes (+50 more)

### Community 2 - "terrain.ts"
Cohesion: 0.05
Nodes (59): BURN_HOURS, CODES, FEATURES, H, ROWS, W, pathCost(), stepCost() (+51 more)

### Community 3 - "app.ts"
Cohesion: 0.06
Nodes (24): vitest, HttpError, admin(), auth(), mod(), roleOf(), signToken(), actions (+16 more)

### Community 4 - "ws.ts"
Cohesion: 0.05
Nodes (45): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+37 more)

### Community 5 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 6 - "spellEffects.ts"
Cohesion: 0.12
Nodes (29): ATTACK_LABEL, attackAllowed(), AttackKind, BLOCKING, checkOccupantAttack(), occupiableAt(), loadTarget(), Target (+21 more)

### Community 7 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 8 - "combatlib.ts"
Cohesion: 0.14
Nodes (16): applyDamage(), monsterDeath(), scheduleRespawn(), die(), grantDivine(), held(), KIND, refreshSurcharge() (+8 more)

### Community 9 - "rankUp.ts"
Cohesion: 0.12
Nodes (21): applySpec(), bagOf(), checkReq(), hasReq(), missingFor(), nextRank(), num(), rankUp() (+13 more)

### Community 10 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 11 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `admin.ts`, `app.ts`, `spellEffects.ts`, `combatlib.ts`, `rankUp.ts`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.09050632911392405 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `fail`, `admin.ts`, `terrain.ts`, `ws.ts`, `spellEffects.ts`, `world2.ts`, `combatlib.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `admin.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06280701754385964 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `fail` to `app.ts`, `ws.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05333333333333334 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06298701298701298 - nodes in this community are weakly interconnected._
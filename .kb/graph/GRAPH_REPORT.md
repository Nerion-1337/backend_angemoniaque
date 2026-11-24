# Graph Report - back  (2026-11-24)

## Corpus Check
- 104 files · ~58,816 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 508 nodes · 1450 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `32c3e5da`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admin.ts
- fail
- app.ts
- terrain.ts
- with
- package.json
- characters.ts
- world2.ts
- combatlib.ts
- spellEffects.ts
- compilerOptions
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 64 edges
2. `vitest` - 38 edges
3. `router()` - 32 edges
4. `def()` - 30 edges
5. `pool` - 28 edges
6. `terrain()` - 28 edges
7. `P()` - 26 edges
8. `ownChar()` - 19 edges
9. `tx()` - 17 edges
10. `log()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `checkFamily()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/items.ts → src/lib/db.ts
- `requireMonster()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/monsterDetails.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "admin.ts"
Cohesion: 0.05
Nodes (63): pool, bumpContent(), cfgAll(), cfgNum(), divineCap(), checkKit(), resourceExists(), audit() (+55 more)

### Community 1 - "fail"
Cohesion: 0.09
Nodes (51): @hono/zod-openapi, ignite(), loadTarget(), targetAt(), assertCap(), checkEntityCost(), monsterOnMap(), activeMount() (+43 more)

### Community 2 - "app.ts"
Cohesion: 0.05
Nodes (32): vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket } (+24 more)

### Community 3 - "terrain.ts"
Cohesion: 0.07
Nodes (43): BURN_HOURS, CODES, FEATURES, H, ROWS, W, stepCost(), GROUPS (+35 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 6 - "characters.ts"
Cohesion: 0.11
Nodes (25): pathCost(), RES_BY_ID, canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), getPublicHealthState(), pathEnergy() (+17 more)

### Community 7 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 8 - "combatlib.ts"
Cohesion: 0.15
Nodes (17): applyDamage(), monsterDeath(), scheduleRespawn(), applySpec(), die(), grantDivine(), held(), KIND (+9 more)

### Community 9 - "spellEffects.ts"
Cohesion: 0.14
Nodes (22): Target, applyArmor(), freeCellRect(), hourlySpawns(), applyEffects(), CAPS, checkSafe(), Effects (+14 more)

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

- **Why does `fail()` connect `fail` to `admin.ts`, `app.ts`, `terrain.ts`, `characters.ts`, `combatlib.ts`, `spellEffects.ts`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Should `admin.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05434173669467787 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `admin.ts`, `fail`, `terrain.ts`, `package.json`, `characters.ts`, `world2.ts`, `combatlib.ts`, `spellEffects.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.09259259259259259 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `fail` to `app.ts`, `package.json`, `characters.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05081585081585081 - nodes in this community are weakly interconnected._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06829573934837092 - nodes in this community are weakly interconnected._
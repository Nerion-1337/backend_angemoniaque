# Graph Report - back  (2026-11-25)

## Corpus Check
- 120 files · ~73,597 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 585 nodes · 1748 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f3b13790`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- route.ts
- terrain.ts
- spells.ts
- app.ts
- with
- combatlib.ts
- fail
- world2.ts
- characters.ts
- package.json
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
- `checkCreation()` --calls--> `fail()`  [EXTRACTED]
  src/routes/characters.ts → src/lib/db.ts
- `ownMount()` --calls--> `fail()`  [EXTRACTED]
  src/routes/mounts.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "route.ts"
Cohesion: 0.06
Nodes (64): pool, bumpContent(), cfgAll(), divineCap(), audit(), def(), P(), router() (+56 more)

### Community 1 - "terrain.ts"
Cohesion: 0.05
Nodes (66): BLOCKING, BURN_HOURS, ignite(), depositAt(), CODES, FEATURES, H, ROWS (+58 more)

### Community 2 - "spells.ts"
Cohesion: 0.08
Nodes (53): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+45 more)

### Community 3 - "app.ts"
Cohesion: 0.06
Nodes (23): vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket } (+15 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "combatlib.ts"
Cohesion: 0.09
Nodes (30): monsterDeath(), scheduleRespawn(), cfgNum(), regenDeposits(), die(), grantDivine(), held(), KIND (+22 more)

### Community 6 - "fail"
Cohesion: 0.08
Nodes (32): @hono/zod-openapi, assertCap(), checkEntityCost(), monsterOnMap(), fail(), ownChar(), tx(), checkFamily() (+24 more)

### Community 7 - "world2.ts"
Cohesion: 0.08
Nodes (36): FEATURES2, H2, ROWS2, W2, cellRoll(), depositPublic(), harvestQty(), KINDS (+28 more)

### Community 8 - "characters.ts"
Cohesion: 0.08
Nodes (33): activate(), Activation, checkActivation(), Group, groupMissing(), GroupT, hasActivation(), applySpec() (+25 more)

### Community 9 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

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

- **Why does `fail()` connect `fail` to `route.ts`, `terrain.ts`, `spells.ts`, `app.ts`, `combatlib.ts`, `world2.ts`, `characters.ts`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06235069278547539 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `route.ts`, `terrain.ts`, `spells.ts`, `combatlib.ts`, `fail`, `world2.ts`, `package.json`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05182072829131653 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `fail` to `route.ts`, `spells.ts`, `app.ts`, `combatlib.ts`, `characters.ts`, `package.json`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07806841046277666 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06189640035118525 - nodes in this community are weakly interconnected._
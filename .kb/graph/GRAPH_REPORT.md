# Graph Report - back  (2026-11-25)

## Corpus Check
- 122 files · ~74,850 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 592 nodes · 1782 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7c365e93`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- route.ts
- spells.ts
- app.ts
- terrain.ts
- combatlib.ts
- with
- admin/deposits.ts
- fail
- package.json
- world2.ts
- characters.ts
- rules.test.ts
- compilerOptions
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 80 edges
2. `vitest` - 49 edges
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
- `checkSpawn()` --calls--> `fail()`  [EXTRACTED]
  src/routes/admin/races.ts → src/lib/db.ts
- `checkCreation()` --calls--> `fail()`  [EXTRACTED]
  src/routes/characters.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (15 total, 1 thin omitted)

### Community 0 - "route.ts"
Cohesion: 0.07
Nodes (59): @hono/zod-openapi, pool, bumpContent(), Requirements, audit(), def(), P(), router() (+51 more)

### Community 1 - "spells.ts"
Cohesion: 0.07
Nodes (60): ATTACK_LABEL, attackAllowed(), AttackKind, BLOCKING, checkOccupantAttack(), occupiableAt(), ignite(), loadTarget() (+52 more)

### Community 2 - "app.ts"
Cohesion: 0.06
Nodes (26): vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket } (+18 more)

### Community 3 - "terrain.ts"
Cohesion: 0.07
Nodes (42): BURN_HOURS, CODES, FEATURES, H, ROWS, W, GROUPS, RES_BY_ID (+34 more)

### Community 4 - "combatlib.ts"
Cohesion: 0.09
Nodes (35): applyDamage(), monsterDeath(), scheduleRespawn(), Target, cfgAll(), cfgNum(), divineCap(), regenDeposits() (+27 more)

### Community 5 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 6 - "admin/deposits.ts"
Cohesion: 0.11
Nodes (31): activate(), Activation, checkActivation(), describeActivation(), Group, groupMissing(), GroupT, hasActivation() (+23 more)

### Community 7 - "fail"
Cohesion: 0.09
Nodes (25): assertCap(), checkEntityCost(), monsterOnMap(), fail(), ownChar(), checkFamily(), checkSummon(), requireMonster() (+17 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 9 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 10 - "characters.ts"
Cohesion: 0.14
Nodes (20): bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES, nextRank() (+12 more)

### Community 11 - "rules.test.ts"
Cohesion: 0.14
Nodes (17): pathCost(), canUseDivineEnergy(), computeHitChance(), computePactStatTransfer(), getPublicHealthState(), pathEnergy(), routeEnergy(), StatRule (+9 more)

### Community 12 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 13 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `route.ts`, `spells.ts`, `app.ts`, `combatlib.ts`, `admin/deposits.ts`, `characters.ts`, `rules.test.ts`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06778711484593837 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `route.ts`, `spells.ts`, `terrain.ts`, `combatlib.ts`, `admin/deposits.ts`, `fail`, `package.json`, `world2.ts`, `rules.test.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07310126582278481 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `route.ts` to `spells.ts`, `app.ts`, `combatlib.ts`, `fail`, `package.json`, `characters.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05745814307458143 - nodes in this community are weakly interconnected._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07138047138047138 - nodes in this community are weakly interconnected._
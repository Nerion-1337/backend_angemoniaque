# Graph Report - back  (2026-11-25)

## Corpus Check
- 136 files · ~85,125 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 654 nodes · 2003 edges · 21 communities (20 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `260f52ba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.ts
- terrain.ts
- admin/deposits.ts
- combat.ts
- spells.ts
- routes/divine.ts
- with
- admin.ts
- package.json
- world2.ts
- items.ts
- characters.ts
- route.ts
- fail
- compilerOptions
- monsterDetails.ts
- AGENTS.md — ia_agent / back
- game/entity.ts
- admin/entity.ts
- players.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 84 edges
2. `vitest` - 57 edges
3. `terrain()` - 40 edges
4. `router()` - 33 edges
5. `def()` - 31 edges
6. `pool` - 30 edges
7. `P()` - 26 edges
8. `log()` - 23 edges
9. `ownChar()` - 20 edges
10. `tx()` - 18 edges

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

## Communities (21 total, 1 thin omitted)

### Community 0 - "app.ts"
Cohesion: 0.05
Nodes (28): vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket } (+20 more)

### Community 1 - "terrain.ts"
Cohesion: 0.06
Nodes (51): CODES, FEATURES, H, ROWS, W, FLY_LEVEL, heightParts(), levelAt() (+43 more)

### Community 2 - "admin/deposits.ts"
Cohesion: 0.08
Nodes (49): activate(), Activation, checkActivation(), describeActivation(), Group, groupMissing(), GroupT, hasActivation() (+41 more)

### Community 3 - "combat.ts"
Cohesion: 0.08
Nodes (42): BLOCKING, BURN_HOURS, ignite(), activeMount(), actor(), blockedMsg(), isWater(), mountPassives() (+34 more)

### Community 4 - "spells.ts"
Cohesion: 0.10
Nodes (41): bagRoom(), ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget() (+33 more)

### Community 5 - "routes/divine.ts"
Cohesion: 0.08
Nodes (33): monsterDeath(), scheduleRespawn(), cfgAll(), cfgNum(), divineCap(), applySpec(), die(), grantDivine() (+25 more)

### Community 6 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 7 - "admin.ts"
Cohesion: 0.11
Nodes (24): pool, bumpContent(), audit(), bestiaryRoutes, Place, coreRoutes, RESCATALOG, monsterDetailRoutes (+16 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 9 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 10 - "items.ts"
Cohesion: 0.11
Nodes (24): Building, buildingRoutes, colsOf(), extras(), jsonable(), kindOf(), RARITIES, requireRow() (+16 more)

### Community 11 - "characters.ts"
Cohesion: 0.12
Nodes (22): bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES, nextRank() (+14 more)

### Community 12 - "route.ts"
Cohesion: 0.21
Nodes (15): @hono/zod-openapi, tx(), def(), P(), router(), CHOICES, GROUP, inventory (+7 more)

### Community 13 - "fail"
Cohesion: 0.15
Nodes (14): fail(), ownChar(), god(), ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank() (+6 more)

### Community 14 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 15 - "monsterDetails.ts"
Cohesion: 0.25
Nodes (6): checkSummon(), LINK_TBL, requireMonster(), SLOTS, Spell, SUMMON_SQL

### Community 16 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 17 - "game/entity.ts"
Cohesion: 0.53
Nodes (3): assertCap(), checkEntityCost(), monsterOnMap()

### Community 18 - "admin/entity.ts"
Cohesion: 0.33
Nodes (5): TABLE, Cap, Cost, entityRoutes, Mod

### Community 19 - "players.ts"
Cohesion: 0.33
Nodes (5): Edit, EDITABLE, GRANT, playerRoutes, STATS

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `app.ts`, `admin/deposits.ts`, `combat.ts`, `spells.ts`, `routes/divine.ts`, `admin.ts`, `items.ts`, `characters.ts`, `route.ts`, `monsterDetails.ts`, `game/entity.ts`, `admin/entity.ts`, `players.ts`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05427905427905428 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `terrain.ts`, `admin/deposits.ts`, `combat.ts`, `spells.ts`, `routes/divine.ts`, `package.json`, `world2.ts`, `game/entity.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05970149253731343 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain.ts` to `app.ts`, `admin/deposits.ts`, `combat.ts`, `spells.ts`, `routes/divine.ts`, `admin.ts`, `world2.ts`, `route.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `admin/deposits.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0750151240169389 - nodes in this community are weakly interconnected._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08051948051948052 - nodes in this community are weakly interconnected._
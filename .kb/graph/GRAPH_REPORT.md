# Graph Report - back  (2026-11-26)

## Corpus Check
- 141 files · ~90,800 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 691 nodes · 2102 edges · 26 communities (25 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `84049391`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- terrain.ts
- combat.ts
- tick.ts
- app.ts
- route.ts
- with
- admin/deposits.ts
- items.ts
- world2.ts
- forum.ts
- pool
- races.ts
- fail
- package.json
- rankUp.ts
- ws.ts
- compilerOptions
- devDependencies
- monsterDetails.ts
- google.ts
- routes/auth.ts
- AGENTS.md — ia_agent / back
- scripts
- game/entity.ts
- middleware/auth.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 92 edges
2. `vitest` - 59 edges
3. `terrain()` - 40 edges
4. `router()` - 35 edges
5. `def()` - 33 edges
6. `pool` - 32 edges
7. `P()` - 27 edges
8. `log()` - 23 edges
9. `ownChar()` - 20 edges
10. `tx()` - 19 edges

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

## Communities (26 total, 1 thin omitted)

### Community 0 - "terrain.ts"
Cohesion: 0.05
Nodes (64): BLOCKING, BURN_HOURS, ignite(), CODES, FEATURES, H, ROWS, W (+56 more)

### Community 1 - "combat.ts"
Cohesion: 0.07
Nodes (61): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+53 more)

### Community 2 - "tick.ts"
Cohesion: 0.07
Nodes (40): monsterDeath(), scheduleRespawn(), bumpContent(), cfgAll(), cfgNum(), divineCap(), regenDeposits(), applySpec() (+32 more)

### Community 3 - "app.ts"
Cohesion: 0.07
Nodes (16): vitest, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), HttpError, actions, craft (+8 more)

### Community 4 - "route.ts"
Cohesion: 0.13
Nodes (33): @hono/zod-openapi, bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots(), resStacks() (+25 more)

### Community 5 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 6 - "admin/deposits.ts"
Cohesion: 0.12
Nodes (30): activate(), Activation, describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll() (+22 more)

### Community 7 - "items.ts"
Cohesion: 0.10
Nodes (26): RespawnLimit, Building, buildingRoutes, colsOf(), extras(), jsonable(), kindOf(), RARITIES (+18 more)

### Community 8 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 9 - "forum.ts"
Cohesion: 0.12
Nodes (21): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+13 more)

### Community 10 - "pool"
Cohesion: 0.14
Nodes (19): pool, audit(), adminRoutes, bestiaryRoutes, Place, coreRoutes, RESCATALOG, entityRoutes (+11 more)

### Community 11 - "races.ts"
Cohesion: 0.10
Nodes (20): checkActivation(), checkReq(), Requirements, checkKit(), grantKit(), Kit, KitT, resourceExists() (+12 more)

### Community 12 - "fail"
Cohesion: 0.14
Nodes (13): fail(), ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member() (+5 more)

### Community 13 - "package.json"
Cohesion: 0.16
Nodes (16): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+8 more)

### Community 14 - "rankUp.ts"
Cohesion: 0.19
Nodes (14): bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES, nextRank() (+6 more)

### Community 15 - "ws.ts"
Cohesion: 0.26
Nodes (8): app, env, { injectWebSocket, upgradeWebSocket }, joinMap(), leave(), pub, sockets, sub

### Community 16 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 17 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, tsx@^4, @types/node@^22, @types/pg@^8, typescript@^5, vitest@^2, tsx, @types/node (+2 more)

### Community 18 - "monsterDetails.ts"
Cohesion: 0.20
Nodes (8): checkSummon(), LINK_TBL, monsterDetailRoutes, requireMonster(), SLOTS, Spell, spellRoutes, SUMMON_SQL

### Community 19 - "google.ts"
Cohesion: 0.36
Nodes (7): signToken(), baseUrl(), callbackUrl(), googleAccount(), googleCfg(), googleRoutes, session()

### Community 20 - "routes/auth.ts"
Cohesion: 0.29
Nodes (3): authRoutes, Log, Reg

### Community 21 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 22 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 23 - "game/entity.ts"
Cohesion: 0.53
Nodes (3): assertCap(), checkEntityCost(), monsterOnMap()

### Community 24 - "middleware/auth.ts"
Cohesion: 0.60
Nodes (4): admin(), auth(), mod(), roleOf()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `terrain.ts`, `combat.ts`, `tick.ts`, `app.ts`, `route.ts`, `admin/deposits.ts`, `items.ts`, `forum.ts`, `pool`, `races.ts`, `rankUp.ts`, `monsterDetails.ts`, `google.ts`, `routes/auth.ts`, `game/entity.ts`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05364314400458979 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `terrain.ts`, `combat.ts`, `tick.ts`, `admin/deposits.ts`, `world2.ts`, `forum.ts`, `package.json`, `devDependencies`, `game/entity.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06962025316455696 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain.ts` to `combat.ts`, `tick.ts`, `app.ts`, `route.ts`, `admin/deposits.ts`, `world2.ts`, `pool`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `tick.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06980433632998413 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07380520266182698 - nodes in this community are weakly interconnected._
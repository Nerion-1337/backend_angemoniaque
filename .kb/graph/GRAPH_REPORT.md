# Graph Report - back  (2026-11-26)

## Corpus Check
- 142 files · ~91,360 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 693 nodes · 2106 edges · 28 communities (27 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e33c5033`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- combat.ts
- terrain.ts
- route.ts
- app.ts
- rankUp.ts
- with
- characters.ts
- admin/deposits.ts
- world2.ts
- forum.ts
- items.ts
- ws.ts
- package.json
- fail
- admin.ts
- routes/auth.ts
- google.ts
- pool
- compilerOptions
- devDependencies
- monsterDetails.ts
- races.ts
- admin/entity.ts
- admin/monsters.ts
- AGENTS.md — ia_agent / back
- scripts
- game/entity.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 92 edges
2. `vitest` - 60 edges
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

## Communities (28 total, 1 thin omitted)

### Community 0 - "combat.ts"
Cohesion: 0.07
Nodes (54): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), monsterDeath() (+46 more)

### Community 1 - "terrain.ts"
Cohesion: 0.06
Nodes (56): BLOCKING, BURN_HOURS, ignite(), CODES, FEATURES, H, ROWS, W (+48 more)

### Community 2 - "route.ts"
Cohesion: 0.10
Nodes (42): @hono/zod-openapi, bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots(), resStacks() (+34 more)

### Community 3 - "app.ts"
Cohesion: 0.08
Nodes (16): vitest, HttpError, trimLog(), actions, buildings, combat, craft, divine (+8 more)

### Community 4 - "rankUp.ts"
Cohesion: 0.07
Nodes (44): cfgNum(), divineCap(), regenDeposits(), applySpec(), die(), grantDivine(), held(), KIND (+36 more)

### Community 5 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 6 - "characters.ts"
Cohesion: 0.09
Nodes (26): RARE3, RES3_BY_ID, RESOURCES3, GROUPS, RES_BY_ID, RESOURCES, canUseDivineEnergy(), computeCharacterDamage() (+18 more)

### Community 7 - "admin/deposits.ts"
Cohesion: 0.13
Nodes (27): activate(), Activation, describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll() (+19 more)

### Community 8 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 9 - "forum.ts"
Cohesion: 0.16
Nodes (16): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+8 more)

### Community 10 - "items.ts"
Cohesion: 0.16
Nodes (16): Building, buildingRoutes, colsOf(), extras(), jsonable(), RARITIES, safeInsert(), safeUpdate() (+8 more)

### Community 11 - "ws.ts"
Cohesion: 0.16
Nodes (12): app, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket }, joinMap(), leave() (+4 more)

### Community 12 - "package.json"
Cohesion: 0.16
Nodes (16): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+8 more)

### Community 13 - "fail"
Cohesion: 0.18
Nodes (16): checkActivation(), checkReq(), checkKit(), resourceExists(), fail(), check(), check(), Recipe (+8 more)

### Community 14 - "admin.ts"
Cohesion: 0.14
Nodes (13): adminRoutes, bestiaryRoutes, depositRoutes, Edit, EDITABLE, GRANT, playerRoutes, STATS (+5 more)

### Community 15 - "routes/auth.ts"
Cohesion: 0.19
Nodes (8): env, admin(), auth(), mod(), roleOf(), authRoutes, Log, Reg

### Community 16 - "google.ts"
Cohesion: 0.22
Nodes (9): signToken(), authUrl(), baseUrl(), callbackUrl(), checkClaims(), googleAccount(), googleCfg(), googleRoutes (+1 more)

### Community 17 - "pool"
Cohesion: 0.35
Nodes (5): pool, bumpContent(), audit(), Place, Tile

### Community 18 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 19 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, tsx@^4, @types/node@^22, @types/pg@^8, typescript@^5, vitest@^2, tsx, @types/node (+2 more)

### Community 20 - "monsterDetails.ts"
Cohesion: 0.20
Nodes (8): checkSummon(), LINK_TBL, monsterDetailRoutes, requireMonster(), SLOTS, Spell, spellRoutes, SUMMON_SQL

### Community 21 - "races.ts"
Cohesion: 0.22
Nodes (6): Requirements, checkSpawn(), Race, raceRoutes, RankDiff, SPAWN_COLS

### Community 22 - "admin/entity.ts"
Cohesion: 0.25
Nodes (8): kindOf(), requireRow(), TABLE, Cap, Cost, entityRoutes, Mod, refId()

### Community 23 - "admin/monsters.ts"
Cohesion: 0.29
Nodes (5): Loot, Monster, monsterRoutes, Spawn, syncDivine()

### Community 24 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 25 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 26 - "game/entity.ts"
Cohesion: 0.53
Nodes (3): assertCap(), checkEntityCost(), monsterOnMap()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `combat.ts`, `terrain.ts`, `route.ts`, `app.ts`, `rankUp.ts`, `characters.ts`, `admin/deposits.ts`, `forum.ts`, `items.ts`, `admin.ts`, `routes/auth.ts`, `google.ts`, `pool`, `monsterDetails.ts`, `races.ts`, `admin/entity.ts`, `admin/monsters.ts`, `game/entity.ts`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07351351351351351 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `combat.ts`, `terrain.ts`, `rankUp.ts`, `characters.ts`, `admin/deposits.ts`, `world2.ts`, `ws.ts`, `package.json`, `google.ts`, `pool`, `devDependencies`, `game/entity.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0593607305936073 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain.ts` to `combat.ts`, `route.ts`, `app.ts`, `rankUp.ts`, `characters.ts`, `admin/deposits.ts`, `world2.ts`, `pool`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09831029185867896 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07532467532467532 - nodes in this community are weakly interconnected._
# Graph Report - back  (2026-11-26)

## Corpus Check
- 145 files · ~94,216 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 729 nodes · 2201 edges · 27 communities (25 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8ef1331d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- terrain.ts
- combatlib.ts
- market.ts
- combat.ts
- with
- items.ts
- app.ts
- spells.ts
- routes/auth.ts
- package.json
- world2.ts
- pool
- characters.ts
- forum.ts
- google.ts
- fail
- route.ts
- guilds.ts
- env.ts
- admin/deposits.ts
- compilerOptions
- clock.ts
- monsterDetails.ts
- middleware/auth.ts
- integration/reach.test.ts
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 93 edges
2. `vitest` - 62 edges
3. `terrain()` - 39 edges
4. `router()` - 34 edges
5. `pool` - 33 edges
6. `def()` - 32 edges
7. `P()` - 26 edges
8. `log()` - 23 edges
9. `ownChar()` - 19 edges
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

## Communities (27 total, 2 thin omitted)

### Community 0 - "terrain.ts"
Cohesion: 0.06
Nodes (56): cellRoll(), depositAt(), depositPublic(), pickShare(), regenDeposits(), CODES, FEATURES, H (+48 more)

### Community 1 - "combatlib.ts"
Cohesion: 0.06
Nodes (44): applyDamage(), monsterDeath(), scheduleRespawn(), Target, cfgAll(), cfgNum(), divineCap(), applySpec() (+36 more)

### Community 2 - "market.ts"
Cohesion: 0.09
Nodes (47): activate(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), bagRoom(), bagState() (+39 more)

### Community 3 - "combat.ts"
Cohesion: 0.08
Nodes (42): BLOCKING, BURN_HOURS, ignite(), activeMount(), blockedMsg(), isWater(), mountPassives(), onLand() (+34 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "items.ts"
Cohesion: 0.09
Nodes (31): Activation, bumpContent(), Building, buildingRoutes, colsOf(), extras(), jsonable(), kindOf() (+23 more)

### Community 6 - "app.ts"
Cohesion: 0.12
Nodes (6): vitest, HttpError, faiths, inventory, messages, pacts

### Community 7 - "spells.ts"
Cohesion: 0.14
Nodes (27): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), loadTarget(), targetAt(), applyEffects() (+19 more)

### Community 8 - "routes/auth.ts"
Cohesion: 0.11
Nodes (27): b64(), botCheck(), clientIp(), COMMON, hit(), issueChallenge(), leadingZeroBits(), matches() (+19 more)

### Community 9 - "package.json"
Cohesion: 0.08
Nodes (30): dependencies, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3, devDependencies (+22 more)

### Community 10 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 11 - "pool"
Cohesion: 0.13
Nodes (19): pool, audit(), adminRoutes, bestiaryRoutes, Place, coreRoutes, RESCATALOG, monsterDetailRoutes (+11 more)

### Community 12 - "characters.ts"
Cohesion: 0.12
Nodes (21): bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES, nextRank() (+13 more)

### Community 13 - "forum.ts"
Cohesion: 0.15
Nodes (19): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+11 more)

### Community 14 - "google.ts"
Cohesion: 0.16
Nodes (12): hono@^4, hono, signToken(), bootstrapRole(), authUrl(), baseUrl(), callbackUrl(), checkClaims() (+4 more)

### Community 15 - "fail"
Cohesion: 0.16
Nodes (15): checkActivation(), checkReq(), checkKit(), resourceExists(), fail(), checkSpawn(), Race, raceRoutes (+7 more)

### Community 16 - "route.ts"
Cohesion: 0.29
Nodes (10): @hono/zod-openapi, def(), P(), router(), Tile, tileRoutes, CHOICES, checkLimits() (+2 more)

### Community 17 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 18 - "env.ts"
Cohesion: 0.22
Nodes (6): app, env, WEAK, { injectWebSocket, upgradeWebSocket }, joinMap(), leave()

### Community 19 - "admin/deposits.ts"
Cohesion: 0.22
Nodes (9): KINDS, shareTotals(), check(), depositRoutes, KIND_FR, named(), one(), Sector (+1 more)

### Community 20 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 21 - "clock.ts"
Cohesion: 0.33
Nodes (5): catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), state

### Community 22 - "monsterDetails.ts"
Cohesion: 0.20
Nodes (8): checkSummon(), LINK_TBL, requireMonster(), SLOTS, Spell, SUMMON_SQL, GROUP, MONSTER_SLOTS

### Community 23 - "middleware/auth.ts"
Cohesion: 0.43
Nodes (5): admin(), auth(), bearer(), dbRole(), mod()

### Community 25 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `terrain.ts`, `combatlib.ts`, `market.ts`, `combat.ts`, `items.ts`, `app.ts`, `spells.ts`, `routes/auth.ts`, `pool`, `characters.ts`, `forum.ts`, `google.ts`, `route.ts`, `guilds.ts`, `admin/deposits.ts`, `monsterDetails.ts`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055855855855855854 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `terrain.ts`, `combatlib.ts`, `market.ts`, `combat.ts`, `spells.ts`, `routes/auth.ts`, `package.json`, `world2.ts`, `google.ts`, `env.ts`, `clock.ts`, `integration/reach.test.ts`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Should `combatlib.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06386946386946386 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain.ts` to `combatlib.ts`, `market.ts`, `combat.ts`, `app.ts`, `spells.ts`, `world2.ts`, `pool`, `integration/reach.test.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `market.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08672659968270756 - nodes in this community are weakly interconnected._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08245981830887492 - nodes in this community are weakly interconnected._
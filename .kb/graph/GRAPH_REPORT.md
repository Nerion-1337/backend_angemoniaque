# Graph Report - back  (2026-11-28)

## Corpus Check
- 155 files · ~107,862 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 809 nodes · 2505 edges · 25 communities (24 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8ca73ae4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- gates.ts
- combat.ts
- app.ts
- routes/auth.ts
- spells.ts
- routes/divine.ts
- with
- forum.ts
- route.ts
- monsterDetails.ts
- admin/deposits.ts
- package.json
- pool
- world2.ts
- terrain.ts
- fail
- xp.ts
- guilds.ts
- world.test.ts
- races.ts
- compilerOptions
- startKit.ts
- admin/entity.ts
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 103 edges
2. `vitest` - 67 edges
3. `terrain()` - 41 edges
4. `router()` - 36 edges
5. `pool` - 35 edges
6. `def()` - 34 edges
7. `P()` - 29 edges
8. `log()` - 27 edges
9. `tx()` - 20 edges
10. `hourlyTick()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `find()` --calls--> `levelAt()`  [EXTRACTED]
  test/levels.test.ts → src/game/levels.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/levels.test.ts → src/game/terrain.ts

## Import Cycles
- None detected.

## Communities (25 total, 1 thin omitted)

### Community 0 - "gates.ts"
Cohesion: 0.06
Nodes (67): bumpContent(), cfgAll(), cfgNum(), divineCap(), regenDeposits(), applyBuff(), Blessing, blessingCost() (+59 more)

### Community 1 - "combat.ts"
Cohesion: 0.07
Nodes (61): ignite(), actorAir(), activeMount(), actor(), blockedMsg(), isWater(), mountPassives(), onLand() (+53 more)

### Community 2 - "app.ts"
Cohesion: 0.07
Nodes (19): hono, vitest, FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK (+11 more)

### Community 3 - "routes/auth.ts"
Cohesion: 0.07
Nodes (40): app, env, WEAK, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket } (+32 more)

### Community 4 - "spells.ts"
Cohesion: 0.09
Nodes (43): ATTACK_LABEL, attackAllowed(), AttackKind, BLOCKING, checkOccupantAttack(), occupiableAt(), loadTarget(), Target (+35 more)

### Community 5 - "routes/divine.ts"
Cohesion: 0.08
Nodes (34): applyDamage(), monsterDeath(), scheduleRespawn(), applySpec(), DEAD_MAP, deathLoss(), die(), grantDivine() (+26 more)

### Community 6 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 7 - "forum.ts"
Cohesion: 0.09
Nodes (29): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, signToken(), bootstrapRole() (+21 more)

### Community 8 - "route.ts"
Cohesion: 0.15
Nodes (25): @hono/zod-openapi, bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots(), resStacks() (+17 more)

### Community 9 - "monsterDetails.ts"
Cohesion: 0.09
Nodes (27): colsOf(), extras(), jsonable(), RARITIES, safeInsert(), safeUpdate(), URL_KIND, USABLE_KINDS (+19 more)

### Community 10 - "admin/deposits.ts"
Cohesion: 0.13
Nodes (27): activate(), Activation, describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll() (+19 more)

### Community 11 - "package.json"
Cohesion: 0.08
Nodes (31): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+23 more)

### Community 12 - "pool"
Cohesion: 0.11
Nodes (24): pool, invalidateTiles(), audit(), adminRoutes, bestiaryRoutes, Place, buildingRoutes, coreRoutes (+16 more)

### Community 13 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 14 - "terrain.ts"
Cohesion: 0.11
Nodes (20): CODES, H, ROWS, W, BY_CODE, CELLS, DEAD, DEAD_RES (+12 more)

### Community 15 - "fail"
Cohesion: 0.17
Nodes (16): checkActivation(), assertCap(), checkEntityCost(), monsterOnMap(), checkReq(), checkKit(), resourceExists(), fail() (+8 more)

### Community 16 - "xp.ts"
Cohesion: 0.22
Nodes (13): charRank(), COMBAT_KEYS, combatDefaults(), CombatXp, DEFAULT_RANK_DIFF, gainXp(), hitXp(), rankCombat() (+5 more)

### Community 17 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 18 - "world.test.ts"
Cohesion: 0.20
Nodes (8): BURN_HOURS, FEATURES, GROUPS, RES_BY_ID, RESOURCES, BURN_DAMAGE, MAP_HUMAN, all()

### Community 19 - "races.ts"
Cohesion: 0.18
Nodes (8): Requirements, checkSpawn(), COMBAT_XP, CombatDefaults, Race, raceRoutes, RankDiff, SPAWN_COLS

### Community 20 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 21 - "startKit.ts"
Cohesion: 0.25
Nodes (7): RARE3, RES3_BY_ID, RESOURCES3, grantKit(), Kit, KitT, startRank()

### Community 22 - "admin/entity.ts"
Cohesion: 0.25
Nodes (8): kindOf(), requireRow(), TABLE, Cap, Cost, entityRoutes, Mod, refId()

### Community 23 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `gates.ts`, `combat.ts`, `app.ts`, `routes/auth.ts`, `spells.ts`, `routes/divine.ts`, `forum.ts`, `route.ts`, `monsterDetails.ts`, `admin/deposits.ts`, `pool`, `guilds.ts`, `races.ts`, `startKit.ts`, `admin/entity.ts`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Should `gates.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05583308845136644 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `gates.ts`, `combat.ts`, `routes/auth.ts`, `spells.ts`, `routes/divine.ts`, `forum.ts`, `admin/deposits.ts`, `package.json`, `world2.ts`, `fail`, `xp.ts`, `world.test.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06596035543403965 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `app.ts` to `combat.ts`, `spells.ts`, `route.ts`, `admin/deposits.ts`, `pool`, `world2.ts`, `terrain.ts`, `world.test.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07122736418511066 - nodes in this community are weakly interconnected._
- **Should `routes/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06623376623376623 - nodes in this community are weakly interconnected._
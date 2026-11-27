# Graph Report - back  (2026-11-27)

## Corpus Check
- 150 files · ~98,963 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 762 nodes · 2309 edges · 29 communities (27 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2c7d132b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- spells.ts
- combatlib.ts
- ws.ts
- with
- app.ts
- game/deposits.ts
- game/faithPact.ts
- route.ts
- terrain.ts
- items.ts
- world2.ts
- routes/auth.ts
- pool
- forum.ts
- google.ts
- fail
- map.ts
- rules.test.ts
- guilds.ts
- movement.ts
- rankUp.ts
- monsterDetails.ts
- terrain
- compilerOptions
- admin/deposits.ts
- integration/reach.test.ts
- AGENTS.md — ia_agent / back
- statCosts.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 95 edges
2. `vitest` - 64 edges
3. `terrain()` - 39 edges
4. `router()` - 36 edges
5. `pool` - 34 edges
6. `def()` - 34 edges
7. `P()` - 27 edges
8. `log()` - 23 edges
9. `tx()` - 19 edges
10. `ownChar()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `find()` --calls--> `levelAt()`  [EXTRACTED]
  test/levels.test.ts → src/game/levels.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/levels.test.ts → src/game/terrain.ts

## Import Cycles
- None detected.

## Communities (29 total, 2 thin omitted)

### Community 0 - "spells.ts"
Cohesion: 0.07
Nodes (59): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), loadTarget(), Target, targetAt() (+51 more)

### Community 1 - "combatlib.ts"
Cohesion: 0.08
Nodes (34): applyDamage(), monsterDeath(), scheduleRespawn(), divineCap(), applySpec(), die(), grantDivine(), held() (+26 more)

### Community 2 - "ws.ts"
Cohesion: 0.06
Nodes (43): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+35 more)

### Community 3 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 4 - "app.ts"
Cohesion: 0.10
Nodes (9): vitest, HttpError, characters, craft, inventory, market, messages, monsters (+1 more)

### Community 5 - "game/deposits.ts"
Cohesion: 0.12
Nodes (31): activate(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), bagRoom(), bagState() (+23 more)

### Community 6 - "game/faithPact.ts"
Cohesion: 0.10
Nodes (31): cfgAll(), applyBuff(), Blessing, blessingCost(), CARD_SQL, defaultMaxPacts(), FAITH_DEFAULT, FaithCfg (+23 more)

### Community 7 - "route.ts"
Cohesion: 0.16
Nodes (22): @hono/zod-openapi, resStacks(), grantKit(), Kit, KitT, startRank(), ownChar(), posOf() (+14 more)

### Community 8 - "terrain.ts"
Cohesion: 0.09
Nodes (26): BURN_HOURS, CODES, FEATURES, H, ROWS, W, GROUPS, RES_BY_ID (+18 more)

### Community 9 - "items.ts"
Cohesion: 0.10
Nodes (26): Activation, RespawnLimit, Building, buildingRoutes, colsOf(), extras(), jsonable(), kindOf() (+18 more)

### Community 10 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 11 - "routes/auth.ts"
Cohesion: 0.12
Nodes (26): b64(), botCheck(), clientIp(), COMMON, hit(), issueChallenge(), leadingZeroBits(), matches() (+18 more)

### Community 12 - "pool"
Cohesion: 0.13
Nodes (20): pool, bumpContent(), cfgNum(), audit(), adminRoutes, bestiaryRoutes, Place, TABLE (+12 more)

### Community 13 - "forum.ts"
Cohesion: 0.12
Nodes (21): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+13 more)

### Community 14 - "google.ts"
Cohesion: 0.14
Nodes (16): hono, env, WEAK, admin(), auth(), bearer(), dbRole(), mod() (+8 more)

### Community 15 - "fail"
Cohesion: 0.14
Nodes (16): checkActivation(), assertCap(), checkEntityCost(), monsterOnMap(), checkReq(), checkKit(), resourceExists(), fail() (+8 more)

### Community 16 - "map.ts"
Cohesion: 0.20
Nodes (16): getPublicHealthState(), KIND_COST, KIND_LABEL, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest() (+8 more)

### Community 17 - "rules.test.ts"
Cohesion: 0.18
Nodes (15): RARE3, RES3_BY_ID, RESOURCES3, applyArmor(), canUseDivineEnergy(), computeHitChance(), effectiveRank(), multisOf() (+7 more)

### Community 18 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 19 - "movement.ts"
Cohesion: 0.27
Nodes (11): BLOCKING, ignite(), blockedMsg(), isWater(), mountPassives(), onLand(), pathCost(), spend() (+3 more)

### Community 20 - "rankUp.ts"
Cohesion: 0.20
Nodes (13): bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES, nextRank() (+5 more)

### Community 21 - "monsterDetails.ts"
Cohesion: 0.17
Nodes (10): checkSummon(), LINK_TBL, monsterDetailRoutes, requireMonster(), SLOTS, Spell, spellRoutes, SUMMON_SQL (+2 more)

### Community 22 - "terrain"
Cohesion: 0.36
Nodes (9): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, terrain(), find() (+1 more)

### Community 23 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 24 - "admin/deposits.ts"
Cohesion: 0.29
Nodes (5): depositRoutes, KIND_FR, Sector, Share, mapUpgradePrice()

### Community 26 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 27 - "statCosts.ts"
Cohesion: 0.33
Nodes (5): M, Rule, stat(), statCostRoutes, UPGRADABLE

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `spells.ts`, `combatlib.ts`, `app.ts`, `game/deposits.ts`, `game/faithPact.ts`, `route.ts`, `items.ts`, `routes/auth.ts`, `pool`, `forum.ts`, `google.ts`, `guilds.ts`, `movement.ts`, `rankUp.ts`, `monsterDetails.ts`, `admin/deposits.ts`, `statCosts.ts`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0745945945945946 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `spells.ts`, `combatlib.ts`, `ws.ts`, `game/deposits.ts`, `terrain.ts`, `world2.ts`, `routes/auth.ts`, `pool`, `forum.ts`, `google.ts`, `fail`, `map.ts`, `rules.test.ts`, `movement.ts`, `terrain`, `integration/reach.test.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `combatlib.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08446455505279035 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `spells.ts`, `combatlib.ts`, `app.ts`, `game/deposits.ts`, `route.ts`, `terrain.ts`, `world2.ts`, `pool`, `map.ts`, `rules.test.ts`, `movement.ts`, `integration/reach.test.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `ws.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05551020408163265 - nodes in this community are weakly interconnected._
- **Should `with` be split into smaller, more focused modules?**
  _Cohesion score 0.04541062801932367 - nodes in this community are weakly interconnected._
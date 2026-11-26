# Graph Report - back  (2026-11-26)

## Corpus Check
- 149 files · ~97,686 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 757 nodes · 2293 edges · 27 communities (26 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- terrain.ts
- combatlib.ts
- route.ts
- rules.test.ts
- with
- items.ts
- app.ts
- combat.ts
- routes/auth.ts
- package.json
- world2.ts
- pool
- characters.ts
- forum.ts
- tileTypes.ts
- races.ts
- pool
- guilds.ts
- movement.ts
- admin/deposits.ts
- compilerOptions
- terrain
- monsterDetails.ts
- admin/entity.ts
- admin/monsters.ts
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 95 edges
2. `vitest` - 63 edges
3. `terrain()` - 39 edges
4. `router()` - 36 edges
5. `def()` - 34 edges
6. `pool` - 32 edges
7. `P()` - 27 edges
8. `log()` - 23 edges
9. `ownChar()` - 19 edges
10. `tx()` - 19 edges

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

## Communities (27 total, 1 thin omitted)

### Community 0 - "terrain.ts"
Cohesion: 0.08
Nodes (28): BURN_HOURS, CODES, FEATURES, H, ROWS, W, GROUPS, RES_BY_ID (+20 more)

### Community 1 - "combatlib.ts"
Cohesion: 0.05
Nodes (73): ATTACK_LABEL, attackAllowed(), AttackKind, BLOCKING, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget() (+65 more)

### Community 2 - "route.ts"
Cohesion: 0.09
Nodes (50): @hono/zod-openapi, bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots(), resStacks() (+42 more)

### Community 3 - "rules.test.ts"
Cohesion: 0.14
Nodes (16): RARE3, RES3_BY_ID, RESOURCES3, applyArmor(), canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), pathEnergy() (+8 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "items.ts"
Cohesion: 0.15
Nodes (17): Activation, Building, buildingRoutes, colsOf(), extras(), jsonable(), RARITIES, safeInsert() (+9 more)

### Community 6 - "app.ts"
Cohesion: 0.06
Nodes (27): vitest, app, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), assertCap(), checkEntityCost() (+19 more)

### Community 7 - "combat.ts"
Cohesion: 0.29
Nodes (14): activeMount(), actor(), summonLoco(), actorElevation(), dist3(), groundReach(), mountElevation(), powerAt() (+6 more)

### Community 8 - "routes/auth.ts"
Cohesion: 0.07
Nodes (43): hono, env, WEAK, b64(), botCheck(), clientIp(), COMMON, hit() (+35 more)

### Community 9 - "package.json"
Cohesion: 0.08
Nodes (31): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+23 more)

### Community 10 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 11 - "pool"
Cohesion: 0.13
Nodes (18): audit(), adminRoutes, bestiaryRoutes, Place, coreRoutes, RESCATALOG, faithPactRoutes, Edit (+10 more)

### Community 12 - "characters.ts"
Cohesion: 0.12
Nodes (21): bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES, nextRank() (+13 more)

### Community 13 - "forum.ts"
Cohesion: 0.12
Nodes (21): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+13 more)

### Community 14 - "tileTypes.ts"
Cohesion: 0.27
Nodes (12): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS, tileCost() (+4 more)

### Community 15 - "races.ts"
Cohesion: 0.25
Nodes (5): checkSpawn(), Race, raceRoutes, RankDiff, SPAWN_COLS

### Community 16 - "pool"
Cohesion: 0.23
Nodes (8): pool, bumpContent(), cfgNum(), check(), Recipe, recipeRoutes, scrollOf(), TABLE

### Community 17 - "guilds.ts"
Cohesion: 0.14
Nodes (13): fail(), dup(), ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank() (+5 more)

### Community 18 - "movement.ts"
Cohesion: 0.30
Nodes (11): ignite(), blockedMsg(), isWater(), mountPassives(), onLand(), pathCost(), spend(), spendDivine() (+3 more)

### Community 19 - "admin/deposits.ts"
Cohesion: 0.11
Nodes (34): activate(), checkActivation(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll() (+26 more)

### Community 20 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 21 - "terrain"
Cohesion: 0.42
Nodes (8): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, terrain(), find()

### Community 22 - "monsterDetails.ts"
Cohesion: 0.17
Nodes (10): checkSummon(), LINK_TBL, monsterDetailRoutes, requireMonster(), SLOTS, Spell, spellRoutes, SUMMON_SQL (+2 more)

### Community 23 - "admin/entity.ts"
Cohesion: 0.25
Nodes (8): kindOf(), requireRow(), TABLE, Cap, Cost, entityRoutes, Mod, refId()

### Community 24 - "admin/monsters.ts"
Cohesion: 0.25
Nodes (6): RespawnLimit, Loot, Monster, monsterRoutes, Spawn, syncDivine()

### Community 25 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `guilds.ts` to `combatlib.ts`, `route.ts`, `items.ts`, `app.ts`, `combat.ts`, `routes/auth.ts`, `pool`, `characters.ts`, `forum.ts`, `races.ts`, `pool`, `movement.ts`, `admin/deposits.ts`, `monsterDetails.ts`, `admin/entity.ts`, `admin/monsters.ts`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08258258258258258 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `terrain.ts`, `combatlib.ts`, `rules.test.ts`, `combat.ts`, `routes/auth.ts`, `package.json`, `world2.ts`, `forum.ts`, `tileTypes.ts`, `pool`, `movement.ts`, `admin/deposits.ts`, `terrain`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `combatlib.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.050101010101010104 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `terrain.ts`, `combatlib.ts`, `route.ts`, `rules.test.ts`, `app.ts`, `world2.ts`, `pool`, `tileTypes.ts`, `movement.ts`, `admin/deposits.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09121909633418585 - nodes in this community are weakly interconnected._
- **Should `rules.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13852813852813853 - nodes in this community are weakly interconnected._
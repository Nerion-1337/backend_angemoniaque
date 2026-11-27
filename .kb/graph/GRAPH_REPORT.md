# Graph Report - back  (2026-11-27)

## Corpus Check
- 152 files · ~101,618 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 771 nodes · 2361 edges · 25 communities (24 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8d2f1ffa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fail
- app.ts
- combat.ts
- routes/auth.ts
- characters.ts
- with
- tick.ts
- terrain.ts
- package.json
- world2.ts
- items.ts
- forum.ts
- route.ts
- src_lib_route_z
- pool
- map.ts
- admin/monsters.ts
- guilds.ts
- terrain
- activation.ts
- monsterDetails.ts
- compilerOptions
- game/deposits.ts
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 97 edges
2. `vitest` - 65 edges
3. `terrain()` - 40 edges
4. `router()` - 36 edges
5. `pool` - 35 edges
6. `def()` - 34 edges
7. `P()` - 28 edges
8. `log()` - 24 edges
9. `tx()` - 19 edges
10. `ownChar()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `find()` --calls--> `levelAt()`  [EXTRACTED]
  test/levels.test.ts → src/game/levels.ts
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/levels.test.ts → src/game/terrain.ts

## Import Cycles
- None detected.

## Communities (25 total, 1 thin omitted)

### Community 0 - "fail"
Cohesion: 0.06
Nodes (69): ATTACK_LABEL, attackAllowed(), AttackKind, BLOCKING, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget() (+61 more)

### Community 1 - "app.ts"
Cohesion: 0.06
Nodes (20): hono, vitest, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), HttpError, admin() (+12 more)

### Community 2 - "combat.ts"
Cohesion: 0.08
Nodes (48): BURN_HOURS, ignite(), actorAir(), activeMount(), actor(), blockedMsg(), isWater(), mountPassives() (+40 more)

### Community 3 - "routes/auth.ts"
Cohesion: 0.07
Nodes (43): app, env, WEAK, { injectWebSocket, upgradeWebSocket }, b64(), botCheck(), clientIp(), COMMON (+35 more)

### Community 4 - "characters.ts"
Cohesion: 0.06
Nodes (46): applySpec(), bagOf(), checkReq(), Cond, CondT, hasReq(), missingFor(), Mode (+38 more)

### Community 5 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 6 - "tick.ts"
Cohesion: 0.08
Nodes (37): cfgAll(), regenDeposits(), applyBuff(), Blessing, blessingCost(), CARD_SQL, defaultMaxPacts(), FAITH_DEFAULT (+29 more)

### Community 7 - "terrain.ts"
Cohesion: 0.08
Nodes (27): CODES, FEATURES, H, ROWS, W, RARE3, RES3_BY_ID, RESOURCES3 (+19 more)

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (31): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+23 more)

### Community 9 - "world2.ts"
Cohesion: 0.11
Nodes (25): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+17 more)

### Community 10 - "items.ts"
Cohesion: 0.11
Nodes (24): Activation, checkActivation(), Building, buildingRoutes, colsOf(), extras(), jsonable(), kindOf() (+16 more)

### Community 11 - "forum.ts"
Cohesion: 0.12
Nodes (21): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+13 more)

### Community 12 - "route.ts"
Cohesion: 0.23
Nodes (15): @hono/zod-openapi, bagRoom(), bagState(), chestState(), DEFAULT_STACK, extraSlots(), resSlots(), resStacks() (+7 more)

### Community 13 - "src_lib_route_z"
Cohesion: 0.13
Nodes (17): audit(), adminRoutes, bestiaryRoutes, Place, coreRoutes, RESCATALOG, Edit, EDITABLE (+9 more)

### Community 14 - "pool"
Cohesion: 0.17
Nodes (13): pool, bumpContent(), cfgNum(), depositRoutes, KIND_FR, named(), one(), Sector (+5 more)

### Community 15 - "map.ts"
Cohesion: 0.24
Nodes (13): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS, tileCost() (+5 more)

### Community 16 - "admin/monsters.ts"
Cohesion: 0.20
Nodes (11): divineCap(), attachDivine(), divineHeld(), inCirculation(), respawnBlockers(), RespawnLimit, reincarnateDue(), Loot (+3 more)

### Community 17 - "guilds.ts"
Cohesion: 0.14
Nodes (10): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), need(), PERMS (+2 more)

### Community 18 - "terrain"
Cohesion: 0.26
Nodes (12): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, h0(), procNoise() (+4 more)

### Community 19 - "activation.ts"
Cohesion: 0.40
Nodes (11): activate(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), resName(), checkHarvest() (+3 more)

### Community 20 - "monsterDetails.ts"
Cohesion: 0.17
Nodes (10): checkSummon(), LINK_TBL, monsterDetailRoutes, requireMonster(), SLOTS, Spell, spellRoutes, SUMMON_SQL (+2 more)

### Community 21 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 22 - "game/deposits.ts"
Cohesion: 0.33
Nodes (8): cellRoll(), depositAt(), depositPublic(), harvestQty(), KINDS, pickShare(), shareTotals(), takeFromDeposit()

### Community 23 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `app.ts`, `combat.ts`, `routes/auth.ts`, `characters.ts`, `tick.ts`, `items.ts`, `forum.ts`, `route.ts`, `src_lib_route_z`, `pool`, `admin/monsters.ts`, `guilds.ts`, `activation.ts`, `monsterDetails.ts`, `game/deposits.ts`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.056806227645697455 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `fail`, `combat.ts`, `routes/auth.ts`, `characters.ts`, `tick.ts`, `terrain.ts`, `package.json`, `world2.ts`, `forum.ts`, `pool`, `map.ts`, `terrain`, `game/deposits.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06377151799687011 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `fail`, `app.ts`, `combat.ts`, `terrain.ts`, `world2.ts`, `route.ts`, `src_lib_route_z`, `map.ts`, `game/deposits.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07704918032786885 - nodes in this community are weakly interconnected._
- **Should `routes/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06883116883116883 - nodes in this community are weakly interconnected._
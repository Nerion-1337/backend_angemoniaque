# Graph Report - back  (2026-11-25)

## Corpus Check
- 136 files · ~85,434 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 655 nodes · 2006 edges · 27 communities (25 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7701c8b1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- combat.ts
- characters.ts
- admin/deposits.ts
- with
- app.ts
- package.json
- terrain.ts
- world2.ts
- route.ts
- items.ts
- pool
- map.ts
- rules.test.ts
- admin.ts
- fail
- guilds.ts
- movement.ts
- routes/auth.ts
- ws.ts
- terrain
- xp.ts
- compilerOptions
- clock.ts
- races.ts
- AGENTS.md — ia_agent / back
- HttpError

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

## Communities (27 total, 2 thin omitted)

### Community 0 - "combat.ts"
Cohesion: 0.08
Nodes (51): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), monsterDeath() (+43 more)

### Community 1 - "characters.ts"
Cohesion: 0.06
Nodes (53): cfgNum(), regenDeposits(), applySpec(), die(), grantDivine(), held(), KIND, refreshSurcharge() (+45 more)

### Community 2 - "admin/deposits.ts"
Cohesion: 0.10
Nodes (39): activate(), Activation, describeActivation(), Group, groupMissing(), GroupT, hasActivation(), bagRoom() (+31 more)

### Community 3 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 4 - "app.ts"
Cohesion: 0.10
Nodes (11): vitest, buildings, combat, craft, faiths, inventory, messages, monsters (+3 more)

### Community 5 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 6 - "terrain.ts"
Cohesion: 0.09
Nodes (25): CODES, FEATURES, H, ROWS, W, GROUPS, RES_BY_ID, RESOURCES (+17 more)

### Community 7 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 8 - "route.ts"
Cohesion: 0.18
Nodes (20): @hono/zod-openapi, ownChar(), posOf(), tx(), def(), P(), router(), Edit (+12 more)

### Community 9 - "items.ts"
Cohesion: 0.11
Nodes (24): Building, buildingRoutes, colsOf(), extras(), jsonable(), kindOf(), RARITIES, requireRow() (+16 more)

### Community 10 - "pool"
Cohesion: 0.17
Nodes (14): pool, bumpContent(), cfgAll(), divineCap(), audit(), Place, TABLE, RESCATALOG (+6 more)

### Community 11 - "map.ts"
Cohesion: 0.21
Nodes (15): getPublicHealthState(), KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS (+7 more)

### Community 12 - "rules.test.ts"
Cohesion: 0.18
Nodes (14): RARE3, RES3_BY_ID, RESOURCES3, canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), effectiveRank() (+6 more)

### Community 13 - "admin.ts"
Cohesion: 0.12
Nodes (15): adminRoutes, bestiaryRoutes, coreRoutes, checkSummon(), LINK_TBL, monsterDetailRoutes, requireMonster(), SLOTS (+7 more)

### Community 14 - "fail"
Cohesion: 0.18
Nodes (14): checkActivation(), assertCap(), checkEntityCost(), monsterOnMap(), checkReq(), resourceExists(), fail(), check() (+6 more)

### Community 15 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 16 - "movement.ts"
Cohesion: 0.24
Nodes (11): BLOCKING, BURN_HOURS, ignite(), blockedMsg(), isWater(), mountPassives(), onLand(), pathCost() (+3 more)

### Community 17 - "routes/auth.ts"
Cohesion: 0.19
Nodes (8): admin(), auth(), mod(), roleOf(), signToken(), authRoutes, Log, Reg

### Community 18 - "ws.ts"
Cohesion: 0.23
Nodes (8): app, env, { injectWebSocket, upgradeWebSocket }, joinMap(), leave(), pub, sockets, sub

### Community 19 - "terrain"
Cohesion: 0.36
Nodes (9): FLY_LEVEL, heightParts(), levelAt(), memo, ring(), ROCK, terrain(), find() (+1 more)

### Community 20 - "xp.ts"
Cohesion: 0.35
Nodes (8): charRank(), DEFAULT_RANK_DIFF, gainXp(), rankPercent(), rankTable(), targetRank(), weaponXp(), XpTarget

### Community 21 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 22 - "clock.ts"
Cohesion: 0.33
Nodes (5): catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), state

### Community 23 - "races.ts"
Cohesion: 0.22
Nodes (6): Requirements, checkSpawn(), Race, raceRoutes, RankDiff, SPAWN_COLS

### Community 24 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `combat.ts`, `characters.ts`, `admin/deposits.ts`, `app.ts`, `route.ts`, `items.ts`, `pool`, `admin.ts`, `guilds.ts`, `movement.ts`, `routes/auth.ts`, `races.ts`, `HttpError`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `combat.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08257229832572298 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `combat.ts`, `characters.ts`, `admin/deposits.ts`, `package.json`, `terrain.ts`, `world2.ts`, `pool`, `map.ts`, `rules.test.ts`, `fail`, `movement.ts`, `ws.ts`, `terrain`, `xp.ts`, `clock.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Should `characters.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05789235639981909 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain` to `combat.ts`, `characters.ts`, `admin/deposits.ts`, `app.ts`, `terrain.ts`, `world2.ts`, `route.ts`, `pool`, `map.ts`, `rules.test.ts`, `movement.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `admin/deposits.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09574468085106383 - nodes in this community are weakly interconnected._
- **Should `with` be split into smaller, more focused modules?**
  _Cohesion score 0.04541062801932367 - nodes in this community are weakly interconnected._
# Graph Report - back  (2026-11-28)

## Corpus Check
- 157 files · ~110,263 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 824 nodes · 2543 edges · 26 communities (25 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a66f545e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- route.ts
- terrain.ts
- gates.ts
- spells.ts
- db.ts
- routes/auth.ts
- characters.ts
- with
- combat.ts
- package.json
- world2.ts
- forum.ts
- items.ts
- fail
- src_lib_route_z
- guilds.ts
- admin.ts
- admin/buildings.ts
- pool
- compilerOptions
- admin/deposits.ts
- admin/entity.ts
- AGENTS.md — ia_agent / back
- game/entity.ts
- statCosts.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 106 edges
2. `vitest` - 68 edges
3. `terrain()` - 42 edges
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

## Communities (26 total, 1 thin omitted)

### Community 0 - "route.ts"
Cohesion: 0.08
Nodes (60): @hono/zod-openapi, activate(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), bagRoom() (+52 more)

### Community 1 - "terrain.ts"
Cohesion: 0.06
Nodes (58): BLOCKING, BURN_HOURS, ignite(), CODES, FEATURES, H, ROWS, W (+50 more)

### Community 2 - "gates.ts"
Cohesion: 0.06
Nodes (63): cfgAll(), regenDeposits(), deathLoss(), applyBuff(), Blessing, blessingCost(), CARD_SQL, defaultMaxPacts() (+55 more)

### Community 3 - "spells.ts"
Cohesion: 0.07
Nodes (51): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), monsterDeath() (+43 more)

### Community 4 - "db.ts"
Cohesion: 0.07
Nodes (18): vitest, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), HttpError, actions, buildings (+10 more)

### Community 5 - "routes/auth.ts"
Cohesion: 0.06
Nodes (48): hono@^4, hono, app, env, WEAK, { injectWebSocket, upgradeWebSocket }, b64(), botCheck() (+40 more)

### Community 6 - "characters.ts"
Cohesion: 0.06
Nodes (46): applySpec(), bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES (+38 more)

### Community 7 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 8 - "combat.ts"
Cohesion: 0.12
Nodes (28): activeMount(), summonLoco(), actorElevation(), attackRange(), dist3(), groundReach(), mountElevation(), powerAt() (+20 more)

### Community 9 - "package.json"
Cohesion: 0.08
Nodes (30): dependencies, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3, devDependencies (+22 more)

### Community 10 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 11 - "forum.ts"
Cohesion: 0.12
Nodes (21): ANON, Cat, isStaff(), postDenied(), readDenied(), Viewer, Body, CAT_COLS (+13 more)

### Community 12 - "items.ts"
Cohesion: 0.13
Nodes (19): colsOf(), extras(), jsonable(), RARITIES, safeInsert(), safeUpdate(), URL_KIND, USABLE_KINDS (+11 more)

### Community 13 - "fail"
Cohesion: 0.16
Nodes (15): checkActivation(), checkReq(), Requirements, checkKit(), resourceExists(), fail(), check(), checkSpawn() (+7 more)

### Community 14 - "src_lib_route_z"
Cohesion: 0.18
Nodes (11): audit(), P(), bestiaryRoutes, Place, Edit, EDITABLE, GRANT, playerRoutes (+3 more)

### Community 15 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 16 - "admin.ts"
Cohesion: 0.15
Nodes (12): adminRoutes, faithPactRoutes, checkSummon(), LINK_TBL, monsterDetailRoutes, requireMonster(), SLOTS, Spell (+4 more)

### Community 17 - "admin/buildings.ts"
Cohesion: 0.24
Nodes (10): Activation, divineCap(), attachDivine(), divineHeld(), inCirculation(), respawnBlockers(), RespawnLimit, reincarnateDue() (+2 more)

### Community 18 - "pool"
Cohesion: 0.29
Nodes (6): pool, bumpContent(), Recipe, recipeRoutes, scrollOf(), TABLE

### Community 19 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 20 - "admin/deposits.ts"
Cohesion: 0.22
Nodes (8): KINDS, depositRoutes, KIND_FR, named(), one(), Sector, Share, mapUpgradePrice()

### Community 21 - "admin/entity.ts"
Cohesion: 0.25
Nodes (8): kindOf(), requireRow(), TABLE, Cap, Cost, entityRoutes, Mod, refId()

### Community 22 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 23 - "game/entity.ts"
Cohesion: 0.53
Nodes (3): assertCap(), checkEntityCost(), monsterOnMap()

### Community 24 - "statCosts.ts"
Cohesion: 0.33
Nodes (5): M, Rule, stat(), statCostRoutes, UPGRADABLE

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `route.ts`, `terrain.ts`, `gates.ts`, `spells.ts`, `db.ts`, `routes/auth.ts`, `characters.ts`, `combat.ts`, `forum.ts`, `items.ts`, `src_lib_route_z`, `guilds.ts`, `admin.ts`, `admin/buildings.ts`, `pool`, `admin/deposits.ts`, `admin/entity.ts`, `game/entity.ts`, `statCosts.ts`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07724764686790003 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `db.ts` to `route.ts`, `terrain.ts`, `gates.ts`, `spells.ts`, `routes/auth.ts`, `characters.ts`, `combat.ts`, `package.json`, `world2.ts`, `forum.ts`, `pool`, `game/entity.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05945945945945946 - nodes in this community are weakly interconnected._
- **Why does `terrain()` connect `terrain.ts` to `route.ts`, `spells.ts`, `db.ts`, `characters.ts`, `world2.ts`, `src_lib_route_z`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `gates.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055905220288781934 - nodes in this community are weakly interconnected._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07198748043818466 - nodes in this community are weakly interconnected._
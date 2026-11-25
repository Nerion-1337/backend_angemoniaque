# Graph Report - back  (2026-11-25)

## Corpus Check
- 126 files · ~78,525 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 608 nodes · 1849 edges · 24 communities (23 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `07f1d41c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- terrain.ts
- rankUp.ts
- app.ts
- with
- spells.ts
- game/deposits.ts
- characters.ts
- world2.ts
- pool
- items.ts
- route.ts
- fail
- package.json
- guilds.ts
- routes/auth.ts
- ws.ts
- compilerOptions
- devDependencies
- clock.ts
- admin/entity.ts
- admin/deposits.ts
- AGENTS.md — ia_agent / back
- scripts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 80 edges
2. `vitest` - 51 edges
3. `terrain()` - 33 edges
4. `router()` - 32 edges
5. `def()` - 30 edges
6. `pool` - 29 edges
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
- `checkCreation()` --calls--> `fail()`  [EXTRACTED]
  src/routes/characters.ts → src/lib/db.ts
- `checkPerms()` --calls--> `fail()`  [EXTRACTED]
  src/routes/guilds.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (24 total, 1 thin omitted)

### Community 0 - "terrain.ts"
Cohesion: 0.05
Nodes (56): BLOCKING, BURN_HOURS, ignite(), CODES, FEATURES, H, ROWS, W (+48 more)

### Community 1 - "rankUp.ts"
Cohesion: 0.06
Nodes (45): monsterDeath(), scheduleRespawn(), cfgAll(), cfgNum(), divineCap(), regenDeposits(), applySpec(), die() (+37 more)

### Community 2 - "app.ts"
Cohesion: 0.08
Nodes (16): vitest, assertCap(), checkEntityCost(), monsterOnMap(), HttpError, posOf(), buildings, combat (+8 more)

### Community 3 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 4 - "spells.ts"
Cohesion: 0.14
Nodes (34): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), applyDamage(), loadTarget(), Target (+26 more)

### Community 5 - "game/deposits.ts"
Cohesion: 0.11
Nodes (34): activate(), describeActivation(), Group, groupMissing(), GroupT, hasActivation(), bagRoom(), bagState() (+26 more)

### Community 6 - "characters.ts"
Cohesion: 0.11
Nodes (24): MODES, RARE3, RES3_BY_ID, RESOURCES3, canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer() (+16 more)

### Community 7 - "world2.ts"
Cohesion: 0.11
Nodes (26): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+18 more)

### Community 8 - "pool"
Cohesion: 0.13
Nodes (21): pool, Activation, bumpContent(), audit(), adminRoutes, bestiaryRoutes, Place, Building (+13 more)

### Community 9 - "items.ts"
Cohesion: 0.12
Nodes (19): colsOf(), extras(), jsonable(), RARITIES, safeInsert(), safeUpdate(), URL_KIND, USABLE_KINDS (+11 more)

### Community 10 - "route.ts"
Cohesion: 0.24
Nodes (15): @hono/zod-openapi, resStacks(), ownChar(), tx(), def(), P(), router(), CHOICES (+7 more)

### Community 11 - "fail"
Cohesion: 0.13
Nodes (18): checkActivation(), checkReq(), checkKit(), resourceExists(), fail(), check(), checkFamily(), checkSummon() (+10 more)

### Community 12 - "package.json"
Cohesion: 0.16
Nodes (16): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+8 more)

### Community 13 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 14 - "routes/auth.ts"
Cohesion: 0.19
Nodes (8): admin(), auth(), mod(), roleOf(), signToken(), authRoutes, Log, Reg

### Community 15 - "ws.ts"
Cohesion: 0.26
Nodes (8): app, env, { injectWebSocket, upgradeWebSocket }, joinMap(), leave(), pub, sockets, sub

### Community 16 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 17 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, tsx@^4, @types/node@^22, @types/pg@^8, typescript@^5, vitest@^2, tsx, @types/node (+2 more)

### Community 18 - "clock.ts"
Cohesion: 0.36
Nodes (5): catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), state

### Community 19 - "admin/entity.ts"
Cohesion: 0.25
Nodes (8): kindOf(), requireRow(), TABLE, Cap, Cost, entityRoutes, Mod, refId()

### Community 20 - "admin/deposits.ts"
Cohesion: 0.29
Nodes (5): depositRoutes, KIND_FR, Sector, Share, mapUpgradePrice()

### Community 21 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 22 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `terrain.ts`, `rankUp.ts`, `app.ts`, `spells.ts`, `game/deposits.ts`, `characters.ts`, `pool`, `items.ts`, `route.ts`, `guilds.ts`, `routes/auth.ts`, `admin/entity.ts`, `admin/deposits.ts`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05442428730099963 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `terrain.ts`, `rankUp.ts`, `spells.ts`, `game/deposits.ts`, `characters.ts`, `world2.ts`, `package.json`, `devDependencies`, `clock.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `rankUp.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06299603174603174 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `route.ts` to `rankUp.ts`, `app.ts`, `package.json`, `characters.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07811447811447811 - nodes in this community are weakly interconnected._
- **Should `with` be split into smaller, more focused modules?**
  _Cohesion score 0.04541062801932367 - nodes in this community are weakly interconnected._
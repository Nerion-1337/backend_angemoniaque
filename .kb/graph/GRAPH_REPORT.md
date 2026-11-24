# Graph Report - back  (2026-11-24)

## Corpus Check
- 100 files · ~55,594 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 489 nodes · 1376 edges · 14 communities (13 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7baaa4db`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fail
- terrain.ts
- app.ts
- db.ts
- with
- routes/divine.ts
- characters.ts
- package.json
- tileTypes.ts
- guilds.ts
- compilerOptions
- AGENTS.md — ia_agent / back
- game/entity.ts

## God Nodes (most connected - your core abstractions)
1. `fail()` - 62 edges
2. `vitest` - 36 edges
3. `router()` - 32 edges
4. `def()` - 30 edges
5. `terrain()` - 28 edges
6. `pool` - 27 edges
7. `P()` - 26 edges
8. `ownChar()` - 19 edges
9. `tx()` - 17 edges
10. `log()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `checkCreation()` --calls--> `fail()`  [EXTRACTED]
  src/routes/characters.ts → src/lib/db.ts
- `checkPerms()` --calls--> `fail()`  [EXTRACTED]
  src/routes/guilds.ts → src/lib/db.ts

## Import Cycles
- None detected.

## Communities (14 total, 1 thin omitted)

### Community 0 - "fail"
Cohesion: 0.07
Nodes (65): pool, bumpContent(), checkKit(), resourceExists(), audit(), fail(), def(), P() (+57 more)

### Community 1 - "terrain.ts"
Cohesion: 0.05
Nodes (54): FEATURES2, H2, ROWS2, W2, BURN_HOURS, CODES, FEATURES, H (+46 more)

### Community 2 - "app.ts"
Cohesion: 0.05
Nodes (30): vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket } (+22 more)

### Community 3 - "db.ts"
Cohesion: 0.13
Nodes (33): @hono/zod-openapi, ignite(), loadTarget(), targetAt(), activeMount(), actor(), blockedMsg(), isWater() (+25 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "routes/divine.ts"
Cohesion: 0.10
Nodes (27): applyDamage(), monsterDeath(), scheduleRespawn(), Target, cfgAll(), cfgNum(), divineCap(), applySpec() (+19 more)

### Community 6 - "characters.ts"
Cohesion: 0.09
Nodes (29): applyArmor(), canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), effectiveRank(), getPublicHealthState(), pathEnergy() (+21 more)

### Community 7 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 8 - "tileTypes.ts"
Cohesion: 0.24
Nodes (13): KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest(), TILE_KINDS, tileCost() (+5 more)

### Community 9 - "guilds.ts"
Cohesion: 0.13
Nodes (11): ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank(), lowestRank(), member(), need() (+3 more)

### Community 10 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 11 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 12 - "game/entity.ts"
Cohesion: 0.53
Nodes (3): assertCap(), checkEntityCost(), monsterOnMap()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `app.ts`, `db.ts`, `routes/divine.ts`, `characters.ts`, `guilds.ts`, `game/entity.ts`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.07016229712858926 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `fail`, `terrain.ts`, `db.ts`, `routes/divine.ts`, `characters.ts`, `package.json`, `tileTypes.ts`, `game/entity.ts`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0506558118498417 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `db.ts` to `fail`, `app.ts`, `routes/divine.ts`, `characters.ts`, `package.json`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05257936507936508 - nodes in this community are weakly interconnected._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12979591836734694 - nodes in this community are weakly interconnected._
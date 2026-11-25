# Graph Report - back  (2026-11-25)

## Corpus Check
- 124 files · ~76,414 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 599 nodes · 1809 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `92b430ce`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- fail
- app.ts
- ws.ts
- spells.ts
- with
- route.ts
- world2.ts
- combatlib.ts
- admin/deposits.ts
- terrain.ts
- characters.ts
- guilds.ts
- tileTypes.ts
- movement.ts
- rules.test.ts
- core.ts
- compilerOptions
- AGENTS.md — ia_agent / back
- terrain

## God Nodes (most connected - your core abstractions)
1. `fail()` - 80 edges
2. `vitest` - 50 edges
3. `terrain()` - 33 edges
4. `router()` - 32 edges
5. `def()` - 30 edges
6. `pool` - 29 edges
7. `P()` - 26 edges
8. `log()` - 22 edges
9. `ownChar()` - 19 edges
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

## Communities (20 total, 1 thin omitted)

### Community 0 - "fail"
Cohesion: 0.06
Nodes (67): pool, checkActivation(), bumpContent(), cfgAll(), cfgNum(), divineCap(), checkReq(), Requirements (+59 more)

### Community 1 - "app.ts"
Cohesion: 0.07
Nodes (19): vitest, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), HttpError, actions, buildings (+11 more)

### Community 2 - "ws.ts"
Cohesion: 0.05
Nodes (48): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+40 more)

### Community 3 - "spells.ts"
Cohesion: 0.09
Nodes (42): ATTACK_LABEL, attackAllowed(), AttackKind, checkOccupantAttack(), occupiableAt(), loadTarget(), Target, targetAt() (+34 more)

### Community 4 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 5 - "route.ts"
Cohesion: 0.17
Nodes (27): @hono/zod-openapi, activeMount(), actor(), spend(), dist(), log(), ownChar(), posOf() (+19 more)

### Community 6 - "world2.ts"
Cohesion: 0.11
Nodes (27): FEATURES2, H2, ROWS2, W2, RES2_BY_ID, RESOURCES2, SIDES, ZONES2 (+19 more)

### Community 7 - "combatlib.ts"
Cohesion: 0.14
Nodes (19): applyDamage(), monsterDeath(), scheduleRespawn(), die(), grantDivine(), held(), KIND, refreshSurcharge() (+11 more)

### Community 8 - "admin/deposits.ts"
Cohesion: 0.13
Nodes (25): activate(), Activation, describeActivation(), Group, groupMissing(), GroupT, hasActivation(), cellRoll() (+17 more)

### Community 9 - "terrain.ts"
Cohesion: 0.11
Nodes (18): CODES, FEATURES, H, ROWS, W, BY_CODE, CELLS, DEAD (+10 more)

### Community 10 - "characters.ts"
Cohesion: 0.15
Nodes (19): applySpec(), bagOf(), Cond, CondT, hasReq(), missingFor(), Mode, MODES (+11 more)

### Community 11 - "guilds.ts"
Cohesion: 0.10
Nodes (14): assertCap(), checkEntityCost(), monsterOnMap(), ALL, checkPerms(), DEFAULT_RANKS, guilds, joinRank() (+6 more)

### Community 12 - "tileTypes.ts"
Cohesion: 0.20
Nodes (16): depositPublic(), getPublicHealthState(), KIND_COST, applyTileSpells(), invalidateTiles(), key(), loadTiles(), setTilesForTest() (+8 more)

### Community 13 - "movement.ts"
Cohesion: 0.23
Nodes (12): BLOCKING, BURN_HOURS, ignite(), blockedMsg(), isWater(), onLand(), pathCost(), stepCost() (+4 more)

### Community 14 - "rules.test.ts"
Cohesion: 0.22
Nodes (11): applyArmor(), canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), effectiveRank(), pathEnergy(), routeEnergy() (+3 more)

### Community 15 - "core.ts"
Cohesion: 0.19
Nodes (9): RARE3, RES3_BY_ID, RESOURCES3, GROUPS, RES_BY_ID, RESOURCES, MAP_HUMAN, coreRoutes (+1 more)

### Community 16 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 17 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

### Community 18 - "terrain"
Cohesion: 0.50
Nodes (5): h0(), procNoise(), terrain(), find(), all()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `app.ts`, `ws.ts`, `spells.ts`, `route.ts`, `combatlib.ts`, `admin/deposits.ts`, `characters.ts`, `guilds.ts`, `movement.ts`, `core.ts`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `fail` be split into smaller, more focused modules?**
  _Cohesion score 0.05526675786593707 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `fail`, `ws.ts`, `spells.ts`, `world2.ts`, `combatlib.ts`, `admin/deposits.ts`, `guilds.ts`, `tileTypes.ts`, `movement.ts`, `rules.test.ts`, `core.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0672316384180791 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `route.ts` to `app.ts`, `ws.ts`, `characters.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `ws.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05021173623714459 - nodes in this community are weakly interconnected._
- **Should `spells.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08944793850454227 - nodes in this community are weakly interconnected._
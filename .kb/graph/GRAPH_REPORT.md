# Graph Report - back  (2026-11-24)

## Corpus Check
- 111 files · ~63,693 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 4)

## Summary
- 544 nodes · 1604 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c1a099b2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- route.ts
- app.ts
- terrain.ts
- spellEffects.ts
- fail
- spells.ts
- with
- package.json
- rules.test.ts
- tileTypes.ts
- compilerOptions
- AGENTS.md — ia_agent / back

## God Nodes (most connected - your core abstractions)
1. `fail()` - 73 edges
2. `vitest` - 41 edges
3. `router()` - 33 edges
4. `def()` - 31 edges
5. `pool` - 30 edges
6. `terrain()` - 30 edges
7. `P()` - 27 edges
8. `ownChar()` - 19 edges
9. `log()` - 18 edges
10. `tx()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `find()` --calls--> `terrain()`  [EXTRACTED]
  test/rules.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world2.test.ts → src/game/terrain.ts
- `all()` --calls--> `terrain()`  [EXTRACTED]
  test/world.test.ts → src/game/terrain.ts
- `loadTarget()` --calls--> `occupiableAt()`  [EXTRACTED]
  src/game/combatlib.ts → src/game/buildingCell.ts
- `hourlyBuildingSpells()` --calls--> `occupiableAt()`  [EXTRACTED]
  src/game/spellTick.ts → src/game/buildingCell.ts

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "route.ts"
Cohesion: 0.08
Nodes (56): pool, bumpContent(), audit(), def(), P(), router(), bestiaryRoutes, Place (+48 more)

### Community 1 - "app.ts"
Cohesion: 0.05
Nodes (32): vitest, app, env, catchUp(), hoursDue(), MAX_CATCHUP_H, startClock(), { injectWebSocket, upgradeWebSocket } (+24 more)

### Community 2 - "terrain.ts"
Cohesion: 0.05
Nodes (54): FEATURES2, H2, ROWS2, W2, BURN_HOURS, CODES, FEATURES, H (+46 more)

### Community 3 - "spellEffects.ts"
Cohesion: 0.07
Nodes (44): applyDamage(), loadTarget(), monsterDeath(), scheduleRespawn(), Target, cfgAll(), cfgNum(), divineCap() (+36 more)

### Community 4 - "fail"
Cohesion: 0.06
Nodes (43): applySpec(), assertCap(), checkEntityCost(), monsterOnMap(), bagOf(), checkReq(), hasReq(), missingFor() (+35 more)

### Community 5 - "spells.ts"
Cohesion: 0.11
Nodes (37): @hono/zod-openapi, ATTACK_LABEL, attackAllowed(), AttackKind, BLOCKING, checkOccupantAttack(), occupiableAt(), ignite() (+29 more)

### Community 6 - "with"
Cohesion: 0.05
Nodes (45): DATABASE_URL, PGPASSWORD, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, REDIS_URL, jobs, publish (+37 more)

### Community 7 - "package.json"
Cohesion: 0.08
Nodes (32): dependencies, hono@^4, @hono/node-server@^1, @hono/node-ws@^1, @hono/zod-openapi@^0.16, ioredis@^5, pg@^8, zod@^3 (+24 more)

### Community 8 - "rules.test.ts"
Cohesion: 0.11
Nodes (23): applyArmor(), canUseDivineEnergy(), computeCharacterDamage(), computeHitChance(), computePactStatTransfer(), effectiveRank(), getPublicHealthState(), pathEnergy() (+15 more)

### Community 9 - "tileTypes.ts"
Cohesion: 0.17
Nodes (18): depositAt(), depositPublic(), harvestQty(), resName(), takeFromDeposit(), KIND_COST, applyTileSpells(), invalidateTiles() (+10 more)

### Community 10 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitAny, outDir, skipLibCheck, strict (+2 more)

### Community 11 - "AGENTS.md — ia_agent / back"
Cohesion: 0.33
Nodes (5): AGENTS.md — ia_agent / back, Conventions de code et architecture des routes, Rôle de ce dépôt, Stack et commandes, Travail dans ce dépôt

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fail()` connect `fail` to `route.ts`, `app.ts`, `spellEffects.ts`, `spells.ts`, `rules.test.ts`, `tileTypes.ts`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08058608058608059 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `app.ts` to `terrain.ts`, `spellEffects.ts`, `fail`, `spells.ts`, `package.json`, `rules.test.ts`, `tileTypes.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05136986301369863 - nodes in this community are weakly interconnected._
- **Why does `@hono/zod-openapi` connect `spells.ts` to `route.ts`, `app.ts`, `fail`, `package.json`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `terrain.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0506558118498417 - nodes in this community are weakly interconnected._
- **Should `spellEffects.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07373271889400922 - nodes in this community are weakly interconnected._
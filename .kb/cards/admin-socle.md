---
title: Socle admin (Étape 2 phase 1) : rôles, CRUD contenu, règles transverses, production, audit
slug: admin-socle
status: done
updated: 2026-11-24
files:
  - src/routes/admin.ts
  - src/routes/admin/core.ts
  - src/routes/admin/races.ts
  - src/routes/admin/monsters.ts
  - src/routes/admin/items.ts
  - src/routes/admin/mounts.ts
  - src/routes/admin/buildings.ts
  - src/routes/admin/entity.ts
  - src/routes/admin/players.ts
  - src/routes/admin/common.ts
  - src/game/content.ts
  - src/game/divine.ts
  - src/middleware/auth.ts
  - src/lib/audit.ts
  - src/routes/tick.ts
symbols:
  - src/routes/admin.ts:adminRoutes
  - src/game/content.ts:cfgAll
  - src/game/divine.ts:grantDivine
  - src/lib/audit.ts:audit
  - src/routes/tick.ts:hourlyTick
  - src/routes/tick.ts:applyBuildingProduction
tests:
  - test/content.test.ts
  - test/divine.test.ts
  - test/tickprod.test.ts
  - test/integration/admin.test.ts
---
## Purpose
Phase 1 (socle) of the admin back-office (Étape 2): a data-driven admin layer on top of the game content.
Introduces account roles (player/mod/admin), generic CRUD for races/ranks, monsters, items, mounts and
buildings, the cross-cutting rule tables (costs / caps / modifiers), global config cache, audit trail, and
hourly building production. It is the foundation phases 2-5 (loot/spawn, map editor, player moderation,
live-ops) build on.

## How it works
- **Roles**: `accounts.role` (player/mod/admin) is signed into the JWT (`middleware/auth.ts` `signToken(sub,role)`).
  The `admin` middleware on `/admin/*` requires role==='admin'; a `mod` middleware (role mod|admin) exists for
  phase 4. `/auth/me` and login/register return `role` + legacy `admin` bool.
- **Aggregator**: `routes/admin.ts` mounts sub-routers (core, races, monsters, items, mounts, buildings,
  entity, players, bestiary, spell + monster-detail) under one `adminRoutes` router.
  Phase 3 mounted `spellRoutes` (global spell catalog CRUD) and `monsterDetailRoutes`
  (monster spells / equipment / auras subcollections) — see card `monster-details`. All content CRUD lives in `routes/admin/*.ts`.
  The beasts-of-burden loot/spawn subroutes of `monsters.ts` (`/admin/content/monsters/{id}/loot|spawns`,
  GET/POST/PUT/DELETE) belong to phase 2 — see the `bestiaire` card.
- **Generic entity CRUD** (`common.ts` `safeInsert`/`safeUpdate`): INSERT/UPDATE are restricted to real DB
  columns (checked via information_schema) so unknown keys are ignored (no SQL injection). `monsters`,
  `items`, `mounts`, `buildings` each expose GET list / POST / GET {id} / PUT {id} / DELETE {id}.
  `GET {id}` also joins the cross-cutting `costs`, `caps`, `modifiers` via `extras()`.
- **Cross-cutting rules** (`entity.ts`): `entity_costs` / `entity_caps` / `entity_modifiers` tables, keyed
  by (kind, ref_id). The URL segment is the PLURAL table name (`/admin/content/monsters/{id}/costs`); the
  stored `kind` is the singular class (monster/item/mount/building) via `URL_KIND`/`kindOf` in common.ts.
  Caps have scope global/per_player/per_zone. Modifiers carry stat, value, is_percent, effect_key, is_active.
- **Divine items** (`items.ts`): arcana/relics/artifacts are unique pieces. Creation is capped by
  `game_config.divine_caps`; a piece has exactly one holder (`holder_character_id`). `grantDivine`
  (`game/divine.ts`) transfers the holder (UPDATE, never INSERT) and checks the cap on the recipient, so a
  unique item is never duplicated.
- **Global config cache** (`game/content.ts`): `cfgAll()` reads `game_config` once and caches; `bumpContent()`
  (called by every admin mutation) invalidates it. `cfgNum(key, def)` + `divineCap(kind)` read from the cache.
- **Audit** (`lib/audit.ts`): every admin mutation calls `audit(c, action, target, targetId, before, after)`
  which inserts into `admin_audit`; `GET /admin/audit` lists them (actor resolved via accounts/characters).
- **Hourly production** (`routes/tick.ts`): `applyBuildingProduction()` reads `buildings.data.production` /
  `.collection` (per-hour yield per resource) and credits the owner's `characters.resources`, capped by
  `data.storage`. Runs inside `hourlyTick()` (also the manual `POST /admin/tick`), which also calls
  `hourlySpawns` (bestiaire, phase 2 — see the `bestiaire` card).
- **XP tick fix**: `hourlyTick()` XP/gold bonus is now a correlated subquery in the SET clause. The old
  `LATERAL (...) b` referencing the target table `c` was INVALID SQL, so the hourly tick silently failed.

- **Section « Cases » (2026-11-24, card `tile-types`)** : `routes/admin.ts` monte aussi `tileRoutes` (`/admin/content/tiles`) ; `hourlyTick` appelle `applyTileSpells()` (sort passif des types de case, ±PV/h, plancher 1) avant l'expiration des buffs.

- **2026-11-24 (card `admin-players-divine`)** : `GET /admin/players` devient paginé (`{total,page,per,pages,races,rows}`) + fiche `GET/PUT /admin/players/{id}` et routes d'ajout/retrait ; objets divins : familles `divine_families` (`/admin/content/divine-families`), `items.divine_family`, exemplaires liés à un objet (`POST /admin/content/divine {itemId,n}`, `DELETE /admin/content/divine/{id}`) ; `divineCap` lit les familles.

- **2026-11-24 (card `races-spawn-clock`)** : races = zone d'apparition (`spawn_*`) + limites (`max_per_account`, `max_total`) ; `/admin/dashboard` expose `clock.last_tick_at` ; `/admin/tick` = tick supplémentaire hors horloge.

## Entry points
- `src/app.ts` mounts `adminRoutes` (gated by `admin` middleware on `/admin/*`).
- `src/index.ts` `setInterval(hourlyTick, 3600e3)` + `POST /admin/tick` (manual trigger).
- `grantDivine` (game/divine.ts) is the safe transfer used by the admin grant endpoint and (phase 2) loot.
  The same file holds the rank-surcharge mechanics (`KIND`, `held`, `applySpec`, `refreshSurcharge`) and
  `die` (character death → World of the Dead + guarded divine pieces).
- `cfgNum`/`divineCap` (game/content.ts) are consumed by the tick and divine creation.

## Data flow
- Reads/writes: `accounts.role`, `races`, `specializations` (ranks), `monsters`, `items`, `mounts`,
  `buildings`, `divine_items`, `entity_costs/caps/modifiers`, `game_config`, `admin_audit`,
  `characters.resources`.
- Every content mutation: write row -> `bumpContent()` (config cache) -> `audit()`.
- Effect: `buildings.data.production|collection|storage` drive the hourly tick; `game_config` multipliers
  (xp_rate etc.) scale the tick; `divine_caps` caps unique-item creation.

## Tests
- `test/content.test.ts` (unit): config cache hit/miss + `bumpContent` invalidation, `divineCap`.
- `test/divine.test.ts` (unit): `grantDivine` cap + no-duplication transfer.
- `test/tickprod.test.ts` (unit): `buildingGains` merges production+collection per resource.
- `test/integration/admin.test.ts` (full pass): roles gating, races/ranks CRUD, monster CRUD + cross-cutting
  rules, item+divine cap & transfer, mount+building creation and hourly production/cap, audit trail, legacy
  endpoints.

- **Phase 4** : `items.ts` (liste `GET /admin/content/items`) renvoie `rarity_n` (rareté
  normalisée des valeurs historiques libres) et `holders` (détenteurs via `character_items`),
  et filtre `?rarity=` (normalisé) / `?slot=` ; les constantes partagées `RARITIES`/`USABLE_KINDS`
  vivent dans `common.ts` (miroir front : `src/admin/rarity.js`).

## Gotchas
- **URL vs stored kind**: the route param is the PLURAL table name; `entity_*` tables store the SINGULAR
  class. Use `URL_KIND`/`kindOf` (common.ts) to convert. Front mirrors this in `entityFields.js URL_KIND`.
- **`safeInsert`/`safeUpdate` only touch real columns**: a field not in the table is silently dropped (this is
  intentional, not a bug). Adding a new editable column means adding it to the Zod schema AND the table.
- **`POST /characters` returns only `id`** (not the full row) — integration `mk` helpers must compute the
  pseudo locally and fall back to the first existing character (3-per-account cap, shared admin account).
- **The old LATERAL tick SQL was broken**: never reintroduce a `LATERAL` that references the UPDATE target
  table; use a correlated subquery in the SET clause instead.
- **Divine items are unique**: only transfer the holder, never insert; creation is capped by `divine_caps`.
- `tsconfig` is non-strict; handlers are loosely typed (`any`). Keep that style.

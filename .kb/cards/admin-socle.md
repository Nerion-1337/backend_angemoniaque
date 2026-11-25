---
title: Socle admin (Étape 2 phase 1) : rôles, CRUD contenu, règles transverses, production, audit
slug: admin-socle
status: done
updated: 2026-11-25
files:
  - src/routes/admin.ts
  - src/routes/admin/core.ts
  - src/routes/admin/races.ts
  - src/routes/admin/monsters.ts
  - src/routes/admin/items.ts
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
Socle du back-office (Étape 2) : rôles de compte, CRUD générique du contenu (races, rangs, monstres — dont les montures, card `monster-mounts` —, objets, bâtiments),
règles transverses (coûts, plafonds, modificateurs), cache de configuration, journal d'audit, production horaire des bâtiments.
Les phases suivantes (bestiaire, cases, joueurs, divins, races) s'y branchent (cards dédiées).

## Business rules
- Rôles `player | mod | admin` dans `accounts.role`, signés dans le JWT ; `/admin/*` réservé à `admin`, `mod` pour la modération.
- Les INSERT/UPDATE génériques (`safeInsert`/`safeUpdate`) ne touchent que les colonnes réelles de la table : une clé inconnue est ignorée.
- Règles transverses indexées par (kind singulier, ref_id) ; l'URL utilise le nom de table PLURIEL (`URL_KIND`/`kindOf`). Plafonds : `global | per_player | per_zone`.
- Toute mutation admin : écriture → `bumpContent()` (invalide le cache `game_config`) → `audit(action, cible, avant, après)` dans `admin_audit`.
- Tick horaire (via l'horloge, ou `POST /admin/tick` = tick SUPPLÉMENTAIRE) : XP/or × `xp_rate`, régénération PV/énergie/énergie divine (`recovery`), production des bâtiments plafonnée par `data.storage`, spawns, brûlure, sorts de case, expiration des buffs.
- La production d'un bâtiment (`data.production` + `data.collection`, par ressource et par heure) crédite `characters.resources` du propriétaire.
- Liste des objets : `rarity_n` = rareté normalisée des valeurs historiques libres ; filtres `?rarity=` / `?slot=` ; `RARITIES`/`USABLE_KINDS` dans `common.ts` (miroir front `rarity.js`).
- `GET /admin/dashboard` : compteurs, personnages par race, `clock.last_tick_at`.
- Le tick rétablit toute capacité modifiée temporairement (liste `CAPS` du moteur de sorts) et ramène la réserve au max ; il applique ensuite dégâts sur la durée et sorts passifs (card `spell-engine`).
- Le tick rétablit aussi les rangs temporaires échus (card `rank-up`).
- Le tick régénère aussi les gisements de ressources (card `deposits`).

## Gotchas
- Jamais de `LATERAL` référençant la table cible d'un UPDATE (l'ancien tick échouait silencieusement) : sous-requête corrélée dans le SET.
- Nouvelle colonne éditable = schéma Zod ET colonne en base, sinon elle est ignorée sans erreur.
- `POST /characters` ne renvoie que `id` : les aides de test calculent le pseudo localement.

## Tests
`test/content.test.ts` (cache + `divineCap`), `test/divine.test.ts` (transfert sans duplication), `test/tickprod.test.ts` (`buildingGains`), `test/integration/admin.test.ts` (rôles, CRUD, règles transverses, divins, production, audit).

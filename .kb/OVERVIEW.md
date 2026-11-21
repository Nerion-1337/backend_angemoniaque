# Project overview
_Généré par `kb overview` — ne pas éditer ici ; notes manuelles dans `.kb/NOTES.md`._

# Project notes (maintenus à la main / par l'agent)

## Stack & conventions
- Hono 4 + `@hono/zod-openapi` + Zod : chaque endpoint = schéma Zod dédié (params, body, statuts) via `def()` (`src/lib/route.ts`)
- Modules de routes petits par domaine (`src/routes/*`) ; errors traduits une fois dans `app.onError`
- Postgres via `DATABASE_URL` (pool force `search_path=game_schema`) ; Redis via `REDIS_URL` (pub/sub `map:{id}` pour le WS)
- tsconfig `strict: false` — garder le typage lâche existant ; aucune nouvelle dépendance sans accord

## Commandes utiles
- tests : `npm test` (Vitest ; les tests d'intégration sont skipés sans `DATABASE_URL` — ils tournent en CI / `make test-int`)
- dev : `npm run dev` (tsx watch) ; types+lint : `npm run check`
- Docker test target : `npm run typecheck && npm test` (utilisé par le hook pre-commit et CI)
- kb : backend d'embedding `hash` (offline) dans `.kb/config.json`

## Features (14)
- **admin-socle** [done] (.kb/cards/admin-socle.md) Socle admin (Étape 2 phase 1) : rôles, CRUD contenu, règles transverses, production, audit — Phase 1 (socle) of the admin back-office (Étape 2): a data-driven admin layer on top of the game content. — files: src/routes/admin.ts, src/routes/admin/core.ts, src/routes/admin/races.ts, src/routes/admin/monsters.ts (+11)
- **bestiaire** [done] (.kb/cards/bestiaire.md) Bestiaire (phase 2): loot roll, hourly spawns, combat death, admin routes & status — Phase 2 (Bestiaire) game loop: monsters drop loot when killed (gold + weighted entries from `monster_loot`: items, resources, designated divine items), wild instances are spawned on the hourly tick fr — files: src/game/loot.ts, src/game/combatlib.ts, src/routes/admin/bestiary.ts, src/routes/admin/monsters.ts (+2)
- **combat-realtime** [done] (.kb/cards/combat-realtime.md) Realtime combat events: broadcast combat outcomes to map spectators — Makes combat outcomes visible in real time to every other player on the same map: every resolved attack (direct `/combat/attack` or the "Trait de Lumière" attack spell) publishes a `combat` event on t — files: src/lib/events.ts, src/routes/combat.ts, src/routes/spells.ts
- **guild-default-rank** [done] (.kb/cards/guild-default-rank.md) Guilde : rang par défaut des nouveaux arrivants (option unique default_rank_id) — The guild leader can pick **one** rank as the default assigned to newcomers (accepted applicants and accepted invitations). — files: src/routes/guilds.ts, test/integration/guild-default-rank.test.ts
- **guild-forum-edit** [done] (.kb/cards/guild-forum-edit.md) Guilde : droits d'édition des catégories et sujets (auteur / create_topics / écriture catégorie) — Server half of the forum edit-rights pass: `POST /guilds/topics/{id}/edit` is no longer `create_topics`-only — it is allowed for the **topic author**, holders of `create_topics` (management roles), ho — files: src/routes/guilds.ts, test/integration/guild-forum-edit.test.ts
- **guild-forum-manage** [done] (.kb/cards/guild-forum-manage.md) Guilde : suppression en cascade et transfert de sujet du forum — Gestion du forum côté serveur : supprimer une **catégorie** (emporte ses sujets, leurs messages et leurs états de lecture) ou un **sujet** (messages + lectures), réservés au Chef ; transférer un sujet — files: src/routes/guilds.ts, test/integration/guild-forum-manage.test.ts
- **guild-forum-order** [done] (.kb/cards/guild-forum-order.md) Guilde : ordre d'affichage et réorganisation du forum — Lets the guild's authorized creators ("create_topics" — create categories and topics) reorder how the forum is displayed: categories can be moved up and down at the guild level, topics within a catego — files: src/routes/guilds.ts, test/integration/guild-forum.test.ts
- **guild-forum-perms** [done] (.kb/cards/guild-forum-perms.md) Guilde : forum v2 — permissions granulaires Voir/Écrire, héritage, non-lus, édition — Server half of the forum revamp: every category and topic carries **two distinct per-rank authorizations** — **read** (`visible_ranks`, who sees it / may open it) and **write** (`write_ranks`, who may — files: src/routes/guilds.ts, test/integration/guild-forum-perms.test.ts
- **guild-ranks-integrity** [done] (.kb/cards/guild-ranks-integrity.md) Guilde : intégrité du dernier Chef + renommage des rangs — Guild-rank integrity plus rank renaming: a guild must never be left without a Chef, so the **last holder of the Chef rank** (`guild_ranks.is_leader = true`) cannot leave the guild nor be demoted to a  — files: src/routes/guilds.ts, test/integration/guild-ranks.test.ts
- **guild-ranks-order** [done] (.kb/cards/guild-ranks-order.md) Guilde : ordre persisté des rangs, label Chef renommable, visibilités par défaut dynamiques — Server half of the "Rangs & privilèges" revamp: guild ranks have a persistent display order (`sort_order`, migration `infra/db/05_rank_order.sql`); reordering is leader-only; new ranks are created at  — files: src/routes/guilds.ts, test/integration/guild-ranks-order.test.ts
- **hono-skeleton** [done] (.kb/cards/hono-skeleton.md) Hono + Zod OpenAPI skeleton: entry, router, auth, realtime WS — The Hono + `@hono/zod-openapi` skeleton that serves the game REST API on port 3000: one OpenAPI app factory, per-domain route modules (`src/routes/*`) with per-endpoint Zod schemas, JWT auth middlewar — files: src/index.ts, src/app.ts, src/config/env.ts, src/lib/route.ts (+5)
- **map-terrain-gather** [done] (.kb/cards/map-terrain-gather.md) Procedural map & terrain: resources, movement rules, spawn, map/action routes — The world model of the game: **the Human world (map 1) is a hand-drawn 200×200 grid** (RLE-encoded in `humanMap.ts`) while the other worlds keep the original procedural noise. — files: src/game/terrain.ts, src/game/humanMap.ts, src/game/resources.ts, src/game/burn.ts (+5)
- **monster-details** [done] (.kb/cards/monster-details.md) Détails de monstre (phase 3) : compétences/sorts, équipement par slot, auras, placement spontané & réincarnation — Étape 2 phase 3 (et 3b — capacités) du bestiaire : l'admin complète la fiche d'un type de monstre — **capacités** actives (sorts qu'il peut LANCER, à la demande) et passives (sorts appliqués **en cont — files: src/routes/admin/monsterDetails.ts, src/routes/admin/bestiary.ts, src/game/combatlib.ts, src/game/spawn.ts (+2)
- **world2-angel-demon** [done] (.kb/cards/world2-angel-demon.md) Monde Anges & Démons (carte 2, 300x300) : zones, ressources, logique partagée — La carte 2 est une grille de **zones** 300x300 : démons à l'ouest, anges à l'est, bande neutre du Voile au centre. — files: src/game/world2.ts, src/game/resources2.ts, src/game/angelDemonMap.ts, src/game/terrain.ts (+1)

## File map
- `package.json`
- `src/app.ts` — app
- `src/config/env.ts` — env
- `src/db/pool.ts` — (header), pool
- `src/game/angelDemonMap.ts` — ⚠ GÉNÉRÉ par tools/gen_angel_demon_map.py — monde Anges & Démons : ne pas éditer à la main. — W2, ROWS2, FEATURES2
- `src/game/burn.ts` — Durée d'une brûlure après passage sur une case de volcan (renouvelée à chaque passage). Dégâts : BURN_DAMAGE p — (header), BURN_HOURS, ignite
- `src/game/combatlib.ts` — Applique des dégâts ; gère la mort (joueur → Monde des Morts + objets divins, boss → butin au vainqueur, invoc — (header), Target, loadTarget, targetAt, applyDamage, scheduleRespawn, monsterDeath
- `src/game/content.ts` — Cache des paramètres globaux (game_config) et invalideur du cache de contenu : — (header), cfg, cfgAll, cfgNum, bumpContent, divineCap
- `src/game/divine.ts` — Surcharge divine : plus d'objets que requis => rang supérieur gratuit, quota ignoré. — (header), KIND, required, held, applySpec, refreshSurcharge, die, grantDivine
- `src/game/entity.ts` — Règles transverses (tables entity_costs / entity_caps, Étape 2) : — checkEntityCost, monsterOnMap, assertCap
- `src/game/humanMap.ts` — ⚠ GÉNÉRÉ par tools/gen_human_map.py à partir de la carte de référence — ne pas éditer à la main. — W, ROWS, CODES, FEATURES
- `src/game/loot.ts` — Butin au death d'un monstre : or du monstre + entrées monster_loot tirées à la probabilité — rollLoot
- `src/game/movement.ts` — Acteur courant : l'invocation contrôlée, sinon le héros (monté ou non). — (header), MOUNT_SQL, activeMount, isWater, actor, stepCost, blockedMsg, spend, pathCost, travel
- `src/game/resources.ts` — ⚠ GÉNÉRÉ par tools/gen_human_map.py — catalogue des ressources et légende de la carte. — RESOURCES, GROUPS, RES_BY_ID
- `src/game/resources2.ts` — ⚠ GÉNÉRÉ par tools/gen_angel_demon_map.py — catalogue du monde Anges & Démons (zones, ressources, apparence 3D — SIDES, RESOURCES2, ZONES2, RES2_BY_ID
- `src/game/rules.ts` — Coût XP du prochain point : base × multiplicateur du palier (hypothèse : palier = floor(achats / numb_up), pla — StatRule, statUpgradeCost, pathEnergy, totalEnergy, effectiveRank, inVision, walk, routeEnergy, computeCharacterDamage, getPublicHealthState, computePactStatTransfer, canUseDivineEnergy, computeHitChance, applyArmor
- `src/game/spawn.ts` — Le rayon s’élargit si l’aire est saturée (capitale encombrée en base de dev) : on préfère — freeCell, CAPITAL, spawn, hourlySpawns, reincarnateDue, freeCellRect
- `src/game/stats.ts` — Caractéristiques effectives : base + bonus d'équipement ; dégâts = arme × (Force − Force requise) ; armure = s — gearStats, maxSummons
- `src/game/terrain.ts` — ⚠ GÉNÉRÉ par tools/gen_human_map.py — copie identique dans backend/src/game/terrain.ts et frontend/src/lib/ter — (header), MAP_HUMAN, WORLD, setWorld, BURN_DAMAGE, KIND_COST, KIND_LABEL, mk, hash, CELLS, BY_CODE, VOID, inMap, humanCell, VR, V, vAt, h0, procNoise, POOL, PROC, noiseAt, terrain, SAFE_ZONES, inSafeZone
- `src/game/world2.ts` — ⚠ GÉNÉRÉ par tools/gen_angel_demon_map.py — copie identique dans backend/src/game/world2.ts et frontend/src/li — (header), MAP_ANGDEM, COST, ihash, CELLS, mk, ZBY, VOID, inMap, pick, terrain2, VR, V, vAt, noise2, lerpHex, FRONTIER_X, waterTint
- `src/index.ts`
- `src/lib/audit.ts` — Traile d'audit : qui a modifié quoi, avant/après. Appelé après chaque mutation d'administration. — (header), audit
- `src/lib/db.ts` — (header), HttpError, fail, tx, ownChar, posOf, dist, log, trimLog
- `src/lib/events.ts` — Événements de combat pour les spectateurs de la carte : données publiques uniquement — combatEvent
- `src/lib/route.ts` — Déclare une route OpenAPI en une ligne ; le handler retourne l'objet JSON (erreurs via fail()). — (header), def, P, router
- `src/middleware/auth.ts` — (header), signToken, roleOf, auth, admin, mod
- `src/realtime/ws.ts` — (header), pub, sockets, joinMap, leave, broadcast
- `src/routes/actions.ts` — Récolte : sur place, ou à distance (trajet + 4 énergie). — (header), actions, XY
- `src/routes/admin.ts` — Espace administrateur — monté dans app.ts sous la garde `admin` (rôle du JWT). — (header), adminRoutes
- `src/routes/admin/bestiary.ts` — Statut bestiaire pour le dashboard (Étape 2 phase 2) : — bestiaryRoutes, Place
- `src/routes/admin/buildings.ts` — (header), buildingRoutes, Building
- `src/routes/admin/common.ts` — Table par type d'entité + colonnes « sûres » (INSERT/UPDATE ne touchent que celles-ci, vérifiées en base). — (header), TABLE, RARITIES, USABLE_KINDS, URL_KIND, kindOf, colsOf, jsonable, safeInsert, safeUpdate, requireRow, extras
- `src/routes/admin/core.ts` — Catalogue des ressources des deux mondes (menus déroulants admin) — dédoublonné par id. — (header), RESCATALOG, coreRoutes
- `src/routes/admin/entity.ts` — Règles transverses (D2) : coûts en ressources, plafonds (caps), modificateurs bonus/malus & effets. — (header), entityRoutes, refId, Cost, Cap, Mod
- `src/routes/admin/items.ts` — Libre : les anciennes données conservent leurs valeurs (l'UI admin propose les 5 — (header), itemRoutes, Item, usable
- `src/routes/admin/monsterDetails.ts` — Étape 2 — Phase 3b : catalogue global de sorts (base de sorts du jeu), capacités des — (header), spellRoutes, Spell, usable, monsterDetailRoutes, requireMonster, SLOTS
- `src/routes/admin/monsters.ts` — (header), monsterRoutes, Monster, Loot, Spawn
- `src/routes/admin/mounts.ts` — (header), mountRoutes, Mount
- `src/routes/admin/players.ts` — Endpoints hérités de l'admin historique — complétés en phase 4 (modération, rôles mod). — (header), playerRoutes, STATS, GRANT
- `src/routes/admin/races.ts` — (header), raceRoutes, Race
- `src/routes/auth.ts` — (header), authRoutes, hash, check, Reg, Log
- `src/routes/buildings.ts` — (header), buildings, BUILD_COST
- `src/routes/characters.ts` — Kit de départ (équipement, sorts, monture) comme dans le dépôt d'origine — characters
- `src/routes/combat.ts` — Attaquant : l'invocation contrôlée (ses stats) ou le héros (équipement). La monture peut cracher son souffle s — (header), combat, ATTACK_COST, attacker
- `src/routes/divine.ts` — divine
- `src/routes/faiths.ts` — (header), faiths, CHOICES, god
- `src/routes/guilds.ts` — Membre de guilde avec son rang : le Chef a tous les droits. — (header), guilds, PERMS, ALL, words, member, need, lowestRank, joinRank, lastChef, effRead, checkPerms, Ranks, leaderRankName, topicOf
- `src/routes/inventory.ts` — (header), inventory, GROUP
- `src/routes/map.ts` — Confidentialité : jamais les PV exacts d'un autre joueur, seulement son état de forme. — (header), mapRoutes, SEL, pub
- `src/routes/market.ts` — (header), market, TBL, BAG_MAX, atCapital, bagCount
- `src/routes/messages.ts` — (header), messages, VISION
- `src/routes/monsters.ts` — Invocation d'un monstre du bestiaire (sort/action) : l'invocation est soumise aux règles — monsters
- `src/routes/mounts.ts` — mounts
- … 31 autres fichiers (utiliser `kb search`)

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

## Features (18)
- **admin-players-divine** [done] (.kb/cards/admin-players-divine.md) Admin « Joueurs » (liste paginée + fiche éditable) et objets divins à familles libres — Section admin « Joueurs » (liste paginée par race, fiche éditable : caractéristiques, XP, or, rang, objets équipés / sac / coffre, sorts, montures, bâtiments, divins) et objets divins gérés comme les  — files: src/routes/admin/players.ts, src/routes/admin/items.ts, src/game/content.ts
- **admin-socle** [done] (.kb/cards/admin-socle.md) Socle admin (Étape 2 phase 1) : rôles, CRUD contenu, règles transverses, production, audit — Socle du back-office (Étape 2) : rôles de compte, CRUD générique du contenu (races, rangs, monstres, objets, montures, bâtiments), règles transverses (coûts, plafonds, modificateurs), cache de configu — files: src/routes/admin.ts, src/routes/admin/core.ts, src/routes/admin/races.ts, src/routes/admin/monsters.ts (+11)
- **bestiaire** [done] (.kb/cards/bestiaire.md) Bestiaire (phase 2): loot roll, hourly spawns, combat death, admin routes & status — Boucle du bestiaire (phase 2) : un monstre tué donne son butin (or + entrées pondérées de `monster_loot` : objets, ressources, exemplaires divins), des instances sauvages apparaissent au tick horaire  — files: src/game/loot.ts, src/game/combatlib.ts, src/routes/admin/bestiary.ts, src/routes/admin/monsters.ts (+2)
- **combat-realtime** [done] (.kb/cards/combat-realtime.md) Realtime combat events: broadcast combat outcomes to map spectators — Rend chaque combat visible en temps réel aux autres joueurs de la carte : toute attaque résolue (directe ou sort d'attaque) publie un événement `combat` public sur le canal Redis de la carte, et les c — files: src/lib/events.ts, src/routes/combat.ts, src/routes/spells.ts
- **craft-shop** [done] (.kb/cards/craft-shop.md) Boutique par race et parchemins de fabrication (objet, sort, bâtiment) — Boutique de l'hôtel de ville filtrée par race (objets et sorts) et fabrication par parchemin : un parchemin dans le sac + les ressources de sa recette donnent un objet, un sort appris ou un bâtiment ( — files: src/routes/craft.ts, src/routes/admin/recipes.ts, src/routes/market.ts
- **guild-default-rank** [done] (.kb/cards/guild-default-rank.md) Guilde : rang par défaut des nouveaux arrivants (option unique default_rank_id) — Le Chef choisit UN rang par défaut attribué aux nouveaux membres (candidature acceptée ou invitation acceptée) ; sans choix, le nouveau membre reçoit le rang non-Chef le plus bas (comportement histori — files: src/routes/guilds.ts, test/integration/guild-default-rank.test.ts
- **guild-forum-edit** [done] (.kb/cards/guild-forum-edit.md) Guilde : droits d'édition des catégories et sujets (auteur / create_topics / écriture catégorie) — Droit de modifier un sujet du forum de guilde (titre, description) : auteur, gestionnaires, rangs qui écrivent dans la catégorie parente et Chef ; modification des catégories réservée aux gestionnaire — files: src/routes/guilds.ts, test/integration/guild-forum-edit.test.ts
- **guild-forum-manage** [done] (.kb/cards/guild-forum-manage.md) Guilde : suppression en cascade et transfert de sujet du forum — Gestion du forum de guilde : suppression d'une catégorie (avec ses sujets, messages et états de lecture) ou d'un sujet, réservée au Chef ; transfert d'un sujet vers une autre catégorie pour les gestio — files: src/routes/guilds.ts, test/integration/guild-forum-manage.test.ts
- **guild-forum-order** [done] (.kb/cards/guild-forum-order.md) Guilde : ordre d'affichage et réorganisation du forum — Ordre d'affichage du forum de guilde (catégories, et sujets dans une catégorie), persistant et identique pour tous les membres. — files: src/routes/guilds.ts, test/integration/guild-forum.test.ts
- **guild-forum-perms** [done] (.kb/cards/guild-forum-perms.md) Guilde : forum v2 — permissions granulaires Voir/Écrire, héritage, non-lus, édition — Droits du forum de guilde par rang : lecture (`visible_ranks`) et écriture (`write_ranks`) sur chaque catégorie et chaque sujet, avec héritage sujet ← catégorie, filtrage des listes, refus des écritur — files: src/routes/guilds.ts, test/integration/guild-forum-perms.test.ts
- **guild-ranks-integrity** [done] (.kb/cards/guild-ranks-integrity.md) Guilde : intégrité du dernier Chef + renommage des rangs — Intégrité des rangs de guilde : une guilde n'est jamais sans Chef ; le Chef renomme les rangs (y compris le sien) avec répercussion sur les droits du forum ; la liste des membres expose leur rang de j — files: src/routes/guilds.ts, test/integration/guild-ranks.test.ts
- **guild-ranks-order** [done] (.kb/cards/guild-ranks-order.md) Guilde : ordre persisté des rangs, label Chef renommable, visibilités par défaut dynamiques — Ordre d'affichage persistant des rangs de guilde, réordonnancement par le Chef, nouveaux rangs en fin de liste, et visibilité par défaut du forum qui suit le nom réel du rang Chef. — files: src/routes/guilds.ts, test/integration/guild-ranks-order.test.ts
- **hono-skeleton** [done] (.kb/cards/hono-skeleton.md) Hono + Zod OpenAPI skeleton: entry, router, auth, realtime WS — Socle de l'API du jeu : application Hono + `@hono/zod-openapi` (port 3000), un module de routes par domaine, authentification JWT, passerelle WebSocket diffusée par Redis, horloge du monde. — files: src/index.ts, src/app.ts, src/config/env.ts, src/lib/route.ts (+5)
- **map-terrain-gather** [done] (.kb/cards/map-terrain-gather.md) Procedural map & terrain: resources, movement rules, spawn, map/action routes — Modèle du monde : Monde des Hommes (carte 1, grille 200×200 dessinée), autres mondes générés ; chaque case a un type (9), un coût, une ressource récoltable et un drapeau de brûlure. — files: src/game/terrain.ts, src/game/humanMap.ts, src/game/resources.ts, src/game/burn.ts (+5)
- **monster-details** [done] (.kb/cards/monster-details.md) Détails de monstre (phase 3) : compétences/sorts, équipement par slot, auras, placement spontané & réincarnation — Fiche détaillée d'un type de monstre (phase 3) : capacités actives/passives, équipement par partie du corps, placement d'instances sur les cartes avec leurs butins, déplacement, liaison à un personnag — files: src/routes/admin/monsterDetails.ts, src/routes/admin/bestiary.ts, src/game/combatlib.ts, src/game/spawn.ts (+2)
- **races-spawn-clock** [done] (.kb/cards/races-spawn-clock.md) Races (apparition, limites, équipement de départ, races libres, admin sans limite) et horloge du monde persistante — Races : zone d'apparition, limites de personnages, équipement de départ et races libres jouables ; compte admin sans limite. — files: src/game/clock.ts, src/routes/characters.ts, src/game/spawn.ts, src/routes/admin/races.ts (+2)
- **tile-types** [done] (.kb/cards/tile-types.md) Types de case éditables par monde (admin « Cases ») : coût, description, sort passif — Types de case éditables par monde (admin « Cases ») : nom, description, coût d'énergie d'un pas et sort passif appliqué en continu aux personnages qui s'y tiennent. — files: src/game/tileTypes.ts, src/routes/admin/tiles.ts
- **world2-angel-demon** [done] (.kb/cards/world2-angel-demon.md) Monde Anges & Démons (carte 2, 300x300) : zones, ressources, logique partagée — Monde 2 (Anges & Démons) : grille de zones 300×300 — démons à l'ouest, anges à l'est, bande neutre du Voile au centre. — files: src/game/world2.ts, src/game/resources2.ts, src/game/angelDemonMap.ts, src/game/terrain.ts (+1)

## File map
- `package.json`
- `src/app.ts` — app
- `src/config/env.ts` — env
- `src/db/pool.ts` — (header), pool
- `src/game/angelDemonMap.ts` — ⚠ GÉNÉRÉ par tools/gen_angel_demon_map.py — monde Anges & Démons : ne pas éditer à la main. — W2, ROWS2, FEATURES2
- `src/game/burn.ts` — Durée d'une brûlure après passage sur une case de volcan (renouvelée à chaque passage). Dégâts : BURN_DAMAGE p — (header), BURN_HOURS, ignite
- `src/game/clock.ts` — Horloge du monde persistante (table game_clock, migration 17). — MAX_CATCHUP_H, LOCK, hoursDue, catchUp, startClock
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
- `src/game/spawn.ts` — Le rayon s’élargit si l’aire est saturée (capitale encombrée en base de dev) : on préfère — freeCell, CAPITAL, spawnZone, spawn, hourlySpawns, reincarnateDue, freeCellRect
- `src/game/startKit.ts` — Équipement de départ d'une race (races.start_kit, migration 18) : rang, or, XP, ressources, objets (sac / coff — Kit, KitT, resourceExists, checkKit, startRank, grantKit
- `src/game/stats.ts` — Caractéristiques effectives : base + bonus d'équipement ; dégâts = arme × (Force − Force requise) ; armure = s — gearStats, maxSummons
- `src/game/terrain.ts` — ⚠ GÉNÉRÉ par tools/gen_human_map.py — copie identique dans backend/src/game/terrain.ts et frontend/src/lib/ter — (header), MAP_HUMAN, WORLD, setWorld, BURN_DAMAGE, KIND_COST, KIND_LABEL, mk, hash, CELLS, BY_CODE, VOID, inMap, humanCell, VR, V, vAt, h0, procNoise, POOL, PROC, noiseAt, terrain, SAFE_ZONES, inSafeZone
- `src/game/tileTypes.ts` — Types de case éditables (table tile_types, section admin « Cases ») : nom, description, — (header), TILE_KINDS, TileType, TTL, cache, key, loadTiles, invalidateTiles, setTilesForTest, tileOf, tileCost, tileHpDelta, tilePublic, applyTileSpells
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
- … 62 autres fichiers (utiliser `kb search`)

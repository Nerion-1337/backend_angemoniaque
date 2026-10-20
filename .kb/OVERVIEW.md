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

## Features (6)
- **combat-realtime** [done] (.kb/cards/combat-realtime.md) Realtime combat events: broadcast combat outcomes to map spectators — Makes combat outcomes visible in real time to every other player on the same map: every resolved attack (direct `/combat/attack` or the "Trait de Lumière" attack spell) publishes a `combat` event on t — files: src/lib/events.ts, src/routes/combat.ts, src/routes/spells.ts
- **guild-default-rank** [done] (.kb/cards/guild-default-rank.md) Guilde : rang par défaut des nouveaux arrivants (option unique default_rank_id) — The guild leader can pick **one** rank as the default assigned to newcomers (accepted applicants and accepted invitations). — files: src/routes/guilds.ts, test/integration/guild-default-rank.test.ts
- **guild-forum-order** [done] (.kb/cards/guild-forum-order.md) Guilde : ordre d'affichage et réorganisation du forum — Lets the guild's authorized creators ("create_topics" — create categories and topics) reorder how the forum is displayed: categories can be moved up and down at the guild level, topics within a catego — files: src/routes/guilds.ts, test/integration/guild-forum.test.ts
- **guild-ranks-integrity** [done] (.kb/cards/guild-ranks-integrity.md) Guilde : intégrité du dernier Chef + renommage des rangs — Guild-rank integrity plus rank renaming: a guild must never be left without a Chef, so the **last holder of the Chef rank** (`guild_ranks.is_leader = true`) cannot leave the guild nor be demoted to a  — files: src/routes/guilds.ts, test/integration/guild-ranks.test.ts
- **guild-ranks-order** [done] (.kb/cards/guild-ranks-order.md) Guilde : ordre persisté des rangs, label Chef renommable, visibilités par défaut dynamiques — Server half of the "Rangs & privilèges" revamp: guild ranks have a persistent display order (`sort_order`, migration `infra/db/05_rank_order.sql`); reordering is leader-only; new ranks are created at  — files: src/routes/guilds.ts, test/integration/guild-ranks-order.test.ts
- **hono-skeleton** [done] (.kb/cards/hono-skeleton.md) Hono + Zod OpenAPI skeleton: entry, router, auth, realtime WS — The Hono + `@hono/zod-openapi` skeleton that serves the game REST API on port 3000: one OpenAPI app factory, per-domain route modules (`src/routes/*`) with per-endpoint Zod schemas, JWT auth middlewar — files: src/index.ts, src/app.ts, src/config/env.ts, src/lib/route.ts (+5)

## File map
- `package.json`
- `src/app.ts` — app
- `src/config/env.ts` — env
- `src/db/pool.ts` — (header), pool
- `src/game/combatlib.ts` — Applique des dégâts ; gère la mort (joueur → Monde des Morts + objets divins, boss → butin au vainqueur, invoc — (header), Target, loadTarget, targetAt, applyDamage
- `src/game/divine.ts` — Surcharge divine : plus d'objets que requis => rang supérieur gratuit, quota ignoré. — (header), KIND, required, held, applySpec, refreshSurcharge, die
- `src/game/movement.ts` — Acteur courant : l'invocation contrôlée, sinon le héros (monté ou non). — (header), MOUNT_SQL, activeMount, isWater, actor, stepCost, blockedMsg, spend, pathCost, travel
- `src/game/rules.ts` — Coût XP du prochain point : base × multiplicateur du palier (hypothèse : palier = floor(achats / numb_up), pla — StatRule, statUpgradeCost, pathEnergy, totalEnergy, effectiveRank, inVision, walk, routeEnergy, computeCharacterDamage, getPublicHealthState, computePactStatTransfer, canUseDivineEnergy, computeHitChance, applyArmor
- `src/game/spawn.ts` — freeCell, CAPITAL, spawn
- `src/game/stats.ts` — Caractéristiques effectives : base + bonus d'équipement ; dégâts = arme × (Force − Force requise) ; armure = s — gearStats, maxSummons
- `src/game/terrain.ts` — Terrain procédural déterministe (dupliqué à l'identique côté front : src/lib/terrain.js) — h, noiseAt, Terrain, terrain
- `src/index.ts`
- `src/lib/db.ts` — (header), HttpError, fail, tx, ownChar, posOf, dist, log, trimLog
- `src/lib/events.ts` — Événements de combat pour les spectateurs de la carte : données publiques uniquement — combatEvent
- `src/lib/route.ts` — Déclare une route OpenAPI en une ligne ; le handler retourne l'objet JSON (erreurs via fail()). — (header), def, P, router
- `src/middleware/auth.ts` — (header), signToken, auth, admin
- `src/realtime/ws.ts` — (header), pub, sockets, joinMap, leave, broadcast
- `src/routes/actions.ts` — Récolte : sur place, ou à distance (trajet + 4 énergie). — (header), actions, XY
- `src/routes/admin.ts` — (header), adminRoutes, TABLES, GRANT
- `src/routes/auth.ts` — (header), authRoutes, hash, check, Reg, Log
- `src/routes/buildings.ts` — (header), buildings, BUILD_COST
- `src/routes/characters.ts` — Kit de départ (équipement, sorts, monture) comme dans le dépôt d'origine — characters
- `src/routes/combat.ts` — Attaquant : l'invocation contrôlée (ses stats) ou le héros (équipement). La monture peut cracher son souffle s — (header), combat, ATTACK_COST, attacker
- `src/routes/divine.ts` — divine
- `src/routes/faiths.ts` — (header), faiths, CHOICES, god
- `src/routes/guilds.ts` — Membre de guilde avec son rang : le Chef a tous les droits. — (header), guilds, PERMS, ALL, words, member, need, lowestRank, joinRank, lastChef, Ranks, leaderRankName, topicOf
- `src/routes/inventory.ts` — (header), inventory, GROUP
- `src/routes/map.ts` — Confidentialité : jamais les PV exacts d'un autre joueur, seulement son état de forme. — (header), mapRoutes, SEL, pub
- `src/routes/market.ts` — (header), market, TBL, BAG_MAX, atCapital, bagCount
- `src/routes/messages.ts` — (header), messages, VISION
- `src/routes/mounts.ts` — mounts
- `src/routes/pacts.ts` — Limites vérifiées à la conclusion : 1 pacte actif pour un Humain, selon le rang pour un Ange/Démon. — (header), pacts, maxPacts, BUFF_H, checkLimits
- `src/routes/spells.ts` — spells
- `src/routes/tick.ts` — Tick horaire : XP/or (+ bonus pactes & fidèles), régénération PV/énergie, expiration des buffs. — (header), REVERT, hourlyTick
- `test/combat-event.test.ts`
- `test/integration/api.test.ts` — Nécessite Postgres (schéma du dépôt infra) + Redis : exécuté en CI, ignoré sans DATABASE_URL.
- `test/integration/auth.test.ts`
- `test/integration/combat-realtime.test.ts` — Parcours complet du retour temps réel : un joueur attaque, le spectateur (abonné Redis du canal de la carte)
- `test/integration/features.test.ts`
- `test/integration/gameplay.test.ts`
- `test/integration/guild-default-rank.test.ts` — Rang par défaut de guilde (option unique `default_rank_id`) : définit le rang attribué aux
- `test/integration/guild-forum.test.ts` — Forum de guilde : ordre d'affichage des catégories et sujets — réorganisation par liste
- `test/integration/guild-ranks-order.test.ts` — Rangs de guilde : ordre persisté (sort_order) et refonte Gestion — réorganisation réservée au Chef,
- `test/integration/guild-ranks.test.ts` — Parcours complet des rangs de guilde : le dernier Chef ne peut ni quitter ni changer de rang
- `test/rules.test.ts` — r, find
- `tsconfig.json`

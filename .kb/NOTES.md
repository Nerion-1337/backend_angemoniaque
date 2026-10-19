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

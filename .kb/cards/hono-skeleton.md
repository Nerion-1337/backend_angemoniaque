---
title: Hono + Zod OpenAPI skeleton: entry, router, auth, realtime WS
slug: hono-skeleton
status: done
updated: 2026-11-26
files:
  - src/index.ts
  - src/app.ts
  - src/config/env.ts
  - src/lib/route.ts
  - src/lib/db.ts
  - src/middleware/auth.ts
  - src/realtime/ws.ts
  - src/db/pool.ts
  - src/routes/auth.ts
  - src/routes/google.ts
  - src/routes/forum.ts
symbols:
  - src/index.ts:upgradeWebSocket
  - src/app.ts:app
  - src/lib/route.ts:def
  - src/lib/db.ts:fail
  - src/middleware/auth.ts:signToken
  - src/realtime/ws.ts:joinMap
  - src/config/env.ts:env
  - src/db/pool.ts:pool
tests:
  - test/rules.test.ts
  - test/integration/api.test.ts
---
## Purpose
Socle de l'API du jeu : application Hono + `@hono/zod-openapi` (port 3000), un module de routes par domaine, authentification JWT,
passerelle WebSocket diffusée par Redis, horloge du monde. Documentation de toute la surface sur `/openapi.json`.

## Business rules
- Chaque endpoint déclare son schéma Zod via `def()` (`lib/route.ts`) ; une erreur de validation renvoie 400 `{error}` lisible.
- Les erreurs sont traduites une seule fois dans `app.onError` : `HttpError` → son statut, PG 23505 → 409, P0001/23514 → 400, le reste → 500 « Erreur interne ».
- Toute route exige un JWT HS256 (24 h, `{sub, role}`) SAUF `/auth/login`, `/auth/register`, `/ws`, `/openapi*` (liste blanche par regex dans `middleware/auth.ts`).
- `/admin/*` exige `role === 'admin'` ; un jeton sans rôle vaut `player`. Le compte dont l'e-mail = `ADMIN_EMAIL` devient admin à l'inscription.
- Mots de passe : scrypt `salt:hash`, comparaison à temps constant.
- Toutes les requêtes SQL tournent dans `search_path=game_schema` ; le schéma appartient au dépôt infra (aucune table créée ici).
- Les événements temps réel passent par Redis `map:{id}` et sont redistribués aux WebSocket de cette carte : plusieurs instances backend sont possibles.
- L'horloge du monde est démarrée par `startClock()` (card `races-spawn-clock`) ; jamais de `setInterval` d'une heure.
- L'historique d'un personnage est plafonné à 100 lignes (`trimLog`).

- Middleware d'authentification : `/auth/login|register|google/*`, `/ws`, `/openapi` publics ; `/forum*` et `/legal*` à jeton FACULTATIF (visiteur anonyme si absent ou invalide) ; le reste exige un jeton valide.
- Ordre des middlewares : CORS (PUBLIC_URL seulement) → authentification → limitation de débit → contrôle admin (rôle en base) sur /admin/*.
## Gotchas
- Nouvel endpoint public : l'ajouter à la regex de `auth`, sinon 401.
- `/ws` est hors JWT volontairement : rejoindre une carte est la seule barrière temps réel.
- 23505 → message générique « Déjà existant ou case occupée » : ne pas s'en servir pour un message métier précis.
- `tsconfig` non strict (`any` toléré) : garder ce style.
- La cible Docker `test` lance `typecheck` + `test` (pré-commit et CI) : les deux doivent rester verts.
- Les valeurs par défaut de `config/env.ts` (JWT `dev-secret`, `ange/ange`) sont pour le dev ; la prod les reçoit de l'infra.

## Tests
`test/rules.test.ts` (formules) ; `test/integration/*` (app réelle + Postgres + Redis, ignorés sans `DATABASE_URL`) : `api.test.ts` (inscription → personnage → déplacement, trigger même race, 401/403), `auth.test.ts`, `gameplay.test.ts`, `features.test.ts`.

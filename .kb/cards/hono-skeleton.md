---
title: Hono + Zod OpenAPI skeleton: entry, router, auth, realtime WS
slug: hono-skeleton
status: done
updated: 2026-10-19
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
The Hono + `@hono/zod-openapi` skeleton that serves the game REST API on port 3000: one OpenAPI app factory, per-domain route modules (`src/routes/*`) with per-endpoint Zod schemas, JWT auth middleware, a WebSocket gateway fanned out over Redis pub/sub, and an hourly world tick. The whole surface is documented at `/openapi.json`.

## How it works
- `src/index.ts` boots the process: `createNodeWebSocket({ app })` exposes `GET /ws?map=N` (handler calls `joinMap` / `leave` from `realtime/ws.ts`), then `injectWebSocket(serve({ fetch: app.fetch, port: env.port }))`; a `setInterval` (3 600 000 ms) fires `hourlyTick()` with a `.catch(console.error)`.
- `src/app.ts` builds the app: `router()` (from `lib/route.ts`) creates an `OpenAPIHono` whose `defaultHook` turns Zod validation failures into `400 {error: "..."}`; it mounts `app.use('*', cors())`, the global `auth` middleware, `admin` on `/admin/*`, then registers the 14 route modules (auth, spells, characters, actions, combat, divine, map, pacts, faiths, guilds, messages, buildings, market, inventory, mounts, admin) with `app.route('/', r)`, adds `app.doc('/openapi.json')`, and a global `onError` mapping `HttpError` → its status, PG `23505` → 409 "Déjà existant ou case occupée", `P0001`/`23514` → 400, anything else → 500 "Erreur interne".
- `lib/route.ts` gives the one-line endpoint idiom: `def(app, method, path, schema, handler)` wraps `createRoute` + `c.req.valid('json')` (Zod body) and returns `c.json(await handler(c, body))`; `P(c, key)` parses numeric path params. `router()` is shared by every module so errors stay uniform.
- `lib/db.ts` / `db/pool.ts`: `pool` is a `pg` Pool on `env.pg` with `-c search_path=game_schema`; `fail(status, msg)` throws `HttpError`; `tx(fn)` wraps a pool connection in BEGIN/COMMIT/ROLLBACK; helpers `ownChar` (ownership + blocked check), `posOf`, `dist` (Chebyshev), `log` + `trimLog` (history capped at 100 rows per character).
- `middleware/auth.ts`: HS256 JWT (hono/jwt, 24 h expiry, payload `{sub, admin}`, secret from `env.jwt`); the `auth` middleware verifies the Bearer token and stores it via `c.set('acc', …)`, whitelisting `/auth/login`, `/auth/register`, `/ws`, `/openapi*`; `admin` returns 403 unless `acc.admin`.
- `realtime/ws.ts`: two ioredis clients on `env.redis`; `sockets` is `Map<mapId, Set<ws>>`; `broadcast(mapId, evt)` publishes `map:{mapId}`; a psubscribed `map:*` listener forwards each message to that map's sockets, so several backend instances scale out behind one Redis.
- `routes/auth.ts` shows the module idiom: scrypt-hashed passwords (`salt:hash`, `timingSafeEqual`), register (auto-login + admin bootstrap when email === `env.adminEmail`), login, `/auth/me`.

## Entry points
- Node entry: `src/index.ts` (`npm run dev` → tsx watch; `npm run build` + `start` in prod)
- App factory: `src/app.ts` exports `app` (also imported directly by integration tests)
- Auth flow: `src/routes/auth.ts` — `/auth/register`, `/auth/login`, `/auth/me`
- Every route module imports `def`, `router`, `z` from `lib/route.ts` and `pool` / `fail` / `tx` from `lib/db.ts`

## Data flow
- HTTP JSON → per-endpoint Zod schema (validated by the shared `defaultHook`) → handler → `pg` Pool (game_schema tables) → JSON response `{...}` or `{error}`; the OpenAPI document is derived from the `createRoute` schemas at `/openapi.json`
- WS: `GET /ws?map=N` (no JWT — game-time sessions) → per-map socket sets in memory; cross-instance fan-out via Redis pub/sub `map:{id}`
- Persistence: Postgres owns durable state (accounts, characters, positions, items, guilds, spells, summons…); Redis is transient (pub/sub only, no persistence assumption); sessions are stateless JWTs kept in the client (`localStorage` on the front)
- Errors: `HttpError{status, message}` → `{error: message}`; DB constraint violations are translated once in `app.onError`

## Tests
- `test/rules.test.ts` — pure unit tests of the game formulas reused by routes: stat upgrade costs by tier, path energy, 8-direction walk, terrain determinism, damage / hit chance / divine energy rules.
- `test/integration/*.ts` — vitest against the real app with Postgres + Redis (skipped when `DATABASE_URL` is unset; run in CI with services and via `make test-int`): `api.test.ts` covers register → create character → move, same-race SQL trigger, 401 on protected routes, 403 on admin routes; `auth.test.ts`, `gameplay.test.ts`, `features.test.ts` extend the same harness.

## Gotchas
- `tsconfig` has `strict: false` and `noImplicitAny: false` — handlers are typed loosely (`any`); keep the existing looseness, do not mix in strict patterns that break `skipLibCheck` assumptions.
- The `auth` middleware runs on every path and whitelists public paths by regex in `middleware/auth.ts` — any new public endpoint MUST be added to that regex or it will 401.
- The pool pins `search_path=game_schema` per connection: queries must not assume the `public` schema; the schema itself is owned by the infra repo (migrations) — never create tables here.
- `/ws` is deliberately outside JWT auth; map joining is the only realtime gate.
- The hourly tick is fire-and-forget (`catch(console.error)`): a failing tick does not crash the server but also does not retry — do not build logic that assumes ticks are lossless.
- The global 23505 → 409 mapping is a unique-collision message; do not rely on 23505 for flows that need a specific error body.
- The Dockerfile `test` target runs `npm run typecheck && npm test` (used by the pre-commit hook and CI) — both must stay green.
- Env defaults in `config/env.ts` are dev-only (`dev-secret` JWT, `ange/ange` Postgres); prod values are injected by the infra compose files.

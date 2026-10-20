---
title: Guilde : rang par défaut des nouveaux arrivants (option unique default_rank_id)
slug: guild-default-rank
status: done
updated: 2026-10-20
files:
  - src/routes/guilds.ts
  - test/integration/guild-default-rank.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-default-rank.test.ts
---
## Purpose
The guild leader can pick **one** rank as the default assigned to newcomers (accepted applicants and accepted invitations). It is a *single* option — a single `guilds.default_rank_id` column (NULL = automatic), never a flag spread across `guild_ranks`. When no default is set, newcomers keep falling back to the historical behaviour: the lowest non-Chef rank (`lowestRank`). The Chef rank can never be the default (400).

## How it works
All in `src/routes/guilds.ts` (house `def()` idiom, `tx` transactions):
- `joinRank(db, gid)` helper: reads `guilds.default_rank_id`; if set and still a valid rank of the guild, returns it, else delegates to `lowestRank(db, gid)`. Both newcomer entry points use it: `POST /guilds/invitations/{id}/accept` and `POST /guilds/applicants/{id}/answer` set `characters.guild_rank_id` to `await joinRank(...)` on accept.
- `POST /guilds/default-rank` (new): leader-only (403 `'Réservé au Chef'`). Body `{ characterId, rankId? }` — `rankId` null/absent → `UPDATE guilds SET default_rank_id=NULL` (back to automatic); otherwise the rank must exist in the guild (404) and **must not be the leader rank** (400 `'Le rang Chef ne peut pas être le rang par défaut des nouveaux arrivants'`), then `UPDATE guilds SET default_rank_id=$2`.
- `GET /guilds/{characterId}` now selects `default_rank_id` on the guild row and returns it in the payload, so the front can render the single-choice control state.

## Entry points
- `POST /guilds/default-rank` — called by the front manage tab single-choice control (`Guild.jsx:Manage`, card `guild-default-rank-ui`).
- `GET /guilds/{characterId}` `guild.default_rank_id` — front radio state.
- The two accept paths are unchanged in shape; only the rank source switched to `joinRank`.

## Data flow
- Leader picks rank X → `POST /guilds/default-rank` {rankId: X} → `guilds.default_rank_id = X`.
- Newcomer joins (invitation/applicant accept) → `joinRank` → `X` if set, else `lowestRank` → `characters.guild_rank_id = X` → the joiner's displayed rank and forum visibility follow the new rank name.
- Reset to automatic → `default_rank_id = NULL` → next newcomer gets `lowestRank` again.

## Tests
- `test/integration/guild-default-rank.test.ts` (needs `DATABASE_URL`; CI + `stack exec backend -- npx vitest run`): default automatic → newcomer is `Membre` + `guild.default_rank_id` null; a Membre can't set the option (403); the Chef sets `Officier` (200, GET reflects it) and the next invited newcomer lands `Officier`; the Chef rank is rejected as default (400) and a foreign rank id 404; reset `rankId: null` (200) returns the fallback to `Membre`.

## Gotchas
- **One option, enforced by the schema**: a single nullable FK on `guilds` — do not add a boolean flag on `guild_ranks` or you'll break the uniqueness of the default.
- The Chef rank is deliberately not allowed as the default: newcomers are meant to start low; the leader remains free to promote anyone afterwards. If that ever changes, `joinRank` and the `POST /guilds/default-rank` 400 must be updated together.
- `joinRank` guards against a dangling `default_rank_id` (rank of another guild or deleted) by re-checking ownership and falling back to `lowestRank` — so a stale value can't trap newcomers.
- `default_rank_id` is a plain FK with no ON DELETE: `guild_ranks` rows are only created here (no delete endpoint), so it won't dangle in practice; if a rank-delete route is ever added, cascade or null the default.

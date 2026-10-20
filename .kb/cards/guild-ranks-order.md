---
title: Guilde : ordre persisté des rangs, label Chef renommable, visibilités par défaut dynamiques
slug: guild-ranks-order
status: done
updated: 2026-10-20
files:
  - src/routes/guilds.ts
  - test/integration/guild-ranks-order.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-ranks-order.test.ts
---
## Purpose
Server half of the "Rangs & privilèges" revamp: guild ranks have a persistent display order (`sort_order`, migration `infra/db/05_rank_order.sql`); reordering is leader-only; new ranks are created at the end of the list; the Chef rank label is now **renamable** like any other label (only the name uniqueness stays enforced); and the forum default visibility (no rank chosen) now follows the guild's actual leader-rank name instead of the hardcoded `'Chef'`.

## How it works
All in `src/routes/guilds.ts` (house `def()` idiom, `tx` transactions):
- `GET /guilds/{characterId}`: `ranks` ordered by `sort_order, id` (default 0 keeps the historical id order; consumed by the front Members `<select>`, forum `RankPick`, manage cards).
- `POST /guilds/reorder` — extended with `kind: 'ranks'`: reserved to the leader (`403 'Réservé au Chef'` for non-leaders), assigns `sort_order = index` over the ids (`WHERE id=$ AND guild_id=$` → foreign ids are no-ops). Folders/topics kinds are unchanged (`create_topics`).
- `POST /guilds/ranks` (create): computes `sort_order = COALESCE(MAX(sort_order),0)+1` → new ranks appear **last**.
- `POST /guilds/ranks/{id}/rename`: the `is_leader` 403 guard was **removed** — the Chef label is editable. Remaining guards: unique name in the guild (409), 2–24 chars; the forum `visible_ranks` cascade (folders + topics) still runs for every rank including the leader one.
- `leaderRankName(db, gid)` helper: `SELECT name FROM guild_ranks WHERE guild_id=$1 AND is_leader LIMIT 1` (fallback `'Chef'`). `POST /guilds/folders` and `POST /guilds/topics` with no `visibleRanks` now default to `[leaderRankName]` instead of `['Chef']` — so the default follows a renamed Chef label.

## Entry points
- `POST /guilds/reorder` (`kind: 'ranks'`) — called by the up/down arrows of the front manage cards (`Guild.jsx:Manage`/`Arrows`).
- `GET /guilds/{characterId}` ranks list — front renders cards, Members select options, forum rank pills in this order.
- Rename / create endpoints — front manage tab (pencil now available on the Chef card, `Guild.jsx:Manage`).

## Data flow
- Arrow click → `POST /guilds/reorder` {kind: 'ranks', ids (complete new order)} → tx: `UPDATE guild_ranks SET sort_order=index` → `{ ok: true }` → front `load()` re-fetches the ordered list.
- Create → `sort_order = max+1` (last card, before the "add" placeholder card which is a front-side display position, not persisted).
- Rename → `guild_ranks.name` + cascade `guild_folders.visible_ranks` / `guild_topics.visible_ranks` (name swap, only rows referencing the old name); holders' displayed rank follows via `me.rank` (name-based).

## Tests
- `test/integration/guild-ranks-order.test.ts` (needs `DATABASE_URL`; CI + `stack exec backend -- npx vitest run`): new rank lands last (`['Chef','Officier','Membre','Éclaireur']`); reorder by a non-leader → 403; reorder by the leader persists (`['Éclaireur','Officier','Chef','Membre']`) and foreign ids are ignored; renaming the Chef rank to 'Commandant' → 200, holder's `me.rank` follows, unchosen folder/topic visibility defaults to `['Commandant']`, other holders unaffected.
- `test/integration/guild-ranks.test.ts` (previous feature) was updated: the "Chef protégé" assertion now expects 200 (label renamable) + holder follows.

## Gotchas
- `lowestRank` (member join) still uses `ORDER BY id DESC` over non-leader ranks — deliberately untouched: "lowest" is a semantic id-based concept, not a display order.
- Removing the leader-rename guard only made sense **with** the `leaderRankName` fallback: had we renamed the Chef label without it, every "no rank chosen" folder/topic would have silently defaulted to a name matching no rank. Keep the two together.
- The forum `RankPick` default selections in the front (`NewFolderModal`/`NewTopicModal` initial `g.ranks.map(r => r.name)`) still hardcode-ish via the ranks list — if a rank is later renamed, only *new* component mounts see the new names (useState initial value); re-open the modal after a rename to get fresh defaults.
- `guild_ranks.sort_order` is a dense index written per row (O(n) small updates, one tx) — guild-scale only (schema caps ids at 200 per reorder body).

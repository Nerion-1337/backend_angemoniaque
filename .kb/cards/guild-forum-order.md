---
title: Guilde : ordre d'affichage et réorganisation du forum
slug: guild-forum-order
status: done
updated: 2026-10-19
files:
  - src/routes/guilds.ts
  - test/integration/guild-forum.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-forum.test.ts
---
## Purpose
Lets the guild's authorized creators ("create_topics" — create categories and topics) reorder how the forum is displayed: categories can be moved up and down at the guild level, topics within a category likewise. The order is persisted server-side so that all members see the same display.

## How it works
- Migration "infra/db/04_guild_order.sql" adds "sort_order INT NOT NULL DEFAULT 0" to "guild_folders" and "guild_topics" ("SET search_path TO game_schema"). All rows start at 0, and "ORDER BY sort_order, id" preserves the historical id order.
- "POST /guilds/reorder" ("src/routes/guilds.ts", def idiom, single tx): body "{ characterId, kind: 'folders'|'topics', folderId?, ids: number[] }". "need(m, 'create_topics')" — not a Chef-only operation: the default "Membre" rank retains create_topics. "kind: 'folders'" assigns "sort_order = index" to each id (scoping "WHERE id=$ AND guild_id=$", so ids from another guild have no effect). "kind: 'topics'" first verifies that "folderId" belongs to the guild (404 otherwise), then assigns positions to the ids within that folder only.
- "GET /guilds/{characterId}" orders folders and nested topics by "sort_order, id" (members are in a separate query, so unchanged).

## Entry points
- "POST /guilds/reorder" — called from the up/down arrows (↑/↓) of the front "Forum" ("src/components/Guild.jsx"), which sends the new complete order after a local swap of two adjacent items.
- Read via "GET /guilds/{characterId}" (folders + topics lists, used by the front "load()").

## Data flow
- Arrow click → "POST /guilds/reorder" {kind, ids (new complete order)} → tx: UPDATE of "sort_order" by index → "{ ok: true }" → front "load()" refetches "GET /guilds/{me.id}" → lists render in the new order. Ids of unknown/foreign entities are no-ops (UPDATEs with 0 lines); an unknown "folderId" for topics is 404.

## Tests
- "test/integration/guild-forum.test.ts" (requires "DATABASE_URL"; CI + "stack exec backend -- npx vitest run"): creates a guild + 3 categories + 2 topics; asserts id order (Conseil/Brigade/Veille) then reorders folders to [Veille, Conseil, Brigade] and topics to [Second, Premier...] — GET reflects both; a non-Chef creator ("Membre", has create_topics) can also reorder (200); a member demoted to a permission-less custom rank ("Ritourne") gets 403; "folderId: 999999" is 404; foreign ids inside the topics list do not disturb the order.

## Gotchas
- "sort_order" is a dense index written per item: a reorder is O(n) small UPDATEs inside one tx — fine at guild scale (max 200 ids in the schema), do not generalize to thousands of items.
- "guild_topics.sort_order" is only meaningful per folder; two topics in different folders can legitimately share a "sort_order".
- The ordering is global to all members of the guild (no per-user order); "visible_ranks" filtering (by rank name) is applied after the ordering in GET — a folder that becomes invisible to a member simply disappears from the list, without changing the positions of the others.
- If you add a new migration, number it "05_*" (04 is the guild ordering); the stack/CI only apply migrations to an empty volume, so an existing DB requires a manual "ALTER".

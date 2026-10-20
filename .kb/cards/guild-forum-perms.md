---
title: Guilde : forum v2 — permissions granulaires Voir/Écrire, héritage, non-lus, édition
slug: guild-forum-perms
status: done
updated: 2026-10-20
files:
  - src/routes/guilds.ts
  - test/integration/guild-forum-perms.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-forum-perms.test.ts
---
## Purpose
Server half of the forum revamp: every category and topic carries **two distinct per-rank authorizations** — **read** (`visible_ranks`, who sees it / may open it) and **write** (`write_ranks`, who may create topics there / post replies) — with **topic-inherits-category** defaults and local overrides; list/detail GETs filter by the caller's rank, and POSTs (create topic, post) are rejected with **403** without the write right. Also: title/description editing without page reload, unread tracking (topic + cumulative category, auto-ack on open), and rank-rename cascades now cover write rights too.

## How it works
All in `src/routes/guilds.ts` (house `def()` idiom, `tx`; schema in `infra/db/07_forum_perms.sql`):
- **Model**: `guild_folders.visible_ranks` (read; empty → `[leaderRankName]` fallback on create), `guild_folders.write_ranks` (write; `NOT NULL DEFAULT '{}'`; migrated `:= visible_ranks` so "readers can write" is preserved). `guild_topics.visible_ranks` — **empty means "inherit the category's read"** (pre-v2 rows are non-empty → safe). `guild_topics.write_ranks` — **NULL = inherit the category's write**, `[]` = explicitly nobody (but the Chef).
- `effRead(t, f)`: topic's own non-empty read list, else the folder's. `topicOf` returns 404 when the topic is unknown **or** unreadable for the caller (read check runs after the null check), and computes the effective write list (`write_ranks === null ? folder.write_ranks : topic.write_ranks`).
- **Gates**: `POST /guilds/topics` (create) requires `leader || cat.write_ranks.includes(rank)` → else 403 "Votre rang ne permet pas d'écrire dans cette catégorie"; `POST /guilds/posts` (reply) requires the topic's effective write → else 403 "Votre rang ne peut pas écrire dans ce sujet". The leader always bypasses. `need('create_topics')` still guards folder creation and reordering.
- **Create defaults**: folder — `visibleRanks` empty → `[leaderRankName]`; `writeRanks` **omitted** (zod optional) → `write_ranks = visible_ranks` (qui voit = qui écrit), explicit `[]` → read-only (nobody but the Chef). Topic — `visibleRanks` empty → `[]` = inherit read; `writeRanks` **omitted** → `NULL` = inherit write, explicit `[]` → nobody.
- **Editing**: `POST /guilds/folders/{id}/edit` (title/name, description; `create_topics`; 404 on unknown/foreign; `COALESCE` keeps omitted fields, empty string clears the description) — the front swaps the text in place via `load()`, no reload. `POST /guilds/topics/{id}/edit` is no longer `create_topics`-only: allowed for the **topic author**, `create_topics` holders, or holders of the **category's** `write_ranks` (Chef bypass; 403 `'Vous ne pouvez pas modifier ce sujet'` otherwise; 404 lookup runs first) — see card `guild-forum-edit`, which owns that endpoint.
- **Perms admin** (leader-only, 403 otherwise): `POST /guilds/folders/{id}/perms` (explicit readRanks/writeRanks arrays) and `POST /guilds/topics/{id}/perms` (`null` = inherit for that side). Both **await** `checkPerms`, which validates that rank names exist (400) and that **write ⊆ effective read** (400; for an inheriting topic the effective read is the category's) — the await matters: without it the 400 never blocks the `UPDATE` and the client sees a silent 200 + an unhandled rejection.
- **Unread**: `guild_topic_reads(character_id, topic_id, read_post_id)` — `GET /guilds/{me}` adds `unread: { topics: {tid: n}, folders: {fid: Σn} }`, **non-zero entries only**; counts only posts **by others** (`p.author_id <> me`) past the reader's `read_post_id`, only in topics the caller can read; the COUNT is cast `::int` (pg returns bigint as a string otherwise). `GET /guilds/topics/{me}/{tid}` upserts the read row to the latest post id on open → auto-ack.
- **Rename cascade** now rewrites `write_ranks` alongside `visible_ranks` on both folders and topics (name-based lists; a topic's `NULL` write stays NULL — inheritance survives the rename).

## Entry points
- `POST /guilds/{id}/perms` (folder|topic) — the front "Droits par rang (Voir / Écrire)" panel (`Guild.jsx:PermsPanel`, card `guild-forum-v2`).
- `POST /guilds/folders/{id}/edit` — the inline title/description editors (front `InlineEdit`, card `guild-forum-tools`); `POST /guilds/topics/{id}/edit` — same editor, gated by author / create_topics / category write (card `guild-forum-edit`).
- `GET /guilds/{me}` `unread` + `GET /guilds/topics/{me}/{tid}` — unread badges + auto-ack (front `Forum`).
- `POST /guilds/topics` / `POST /guilds/posts` — the 403 write gates (front hides the reply box when the caller can't write, `effWrite` helper in `src/lib/guild.js`).

## Data flow
- Manager opens a card's "Droits par rang" panel → per-rank Voir/Écrire checkboxes (writing auto-checks reading; un-reading un-checks writing; topic-level "inherit" toggles send `null`) → `POST …/perms` → `await checkPerms` (names + write⊆read) → `UPDATE` → `load()` re-syncs badges/lists.
- Writer: `POST /guilds/topics` → write gate on the category → on success the topic inherits (or explicitly carries) read/write; replies go through the topic's effective write.
- Reader opens a topic → `GET …/topics/{tid}` returns posts **and** upserts `guild_topic_reads` to the newest post id → next `GET /guilds/{me}` shows 0 (absent key) for that topic; a new post by someone else flips it back to 1.

## Tests
- `test/integration/guild-forum-perms.test.ts` (needs `DATABASE_URL`; fresh `stack up`, migration 07; sequential): create requires the category write right (Membre 403, Officier 200); a topic with no rank choice inherits the category's read (visible to Membre, hidden inside a category Membre can't read); local override `write ['Membre']` lets Membre reply and blocks Officier, `write ⊄ read` → 400, non-leader → 403; unread = 2 posts → open topic → 0 → new post → 1, cumulative folder badge = sum over the folder's topics; folder/topic edit (description, title) + new folders land last (`sort_order = max+1`); renaming `Officier`→`Sergent` carries both `visible_ranks` and `write_ranks` on folders, leaves explicit topic lists untouched.

## Gotchas
- **Two meanings of "empty" on topics, deliberate**: `visible_ranks = []` = inherit (read), `write_ranks = []` = explicitly nobody (write), `write_ranks = NULL` = inherit (write). Don't "clean" an empty array to NULL or you silently flip a read-inherit into a write-lock (and vice versa).
- Omitted `writeRanks` on **topic create** is load-bearing: the zod schema is `optional()` (no `.default([])`), so the handler's `b.writeRanks ? b.writeRanks : null` really sees `undefined` → NULL (inherit). A `.default([])` schema would silently store `[]` = "nobody".
- The write ⊆ read invariant is enforced **server-side** in `checkPerms` (the front mirrors it). For an inheriting topic the comparison is against the **category's** read list (`t.fvis`) — set the category read before narrowing the topic's write.
- `checkPerms` **must stay awaited** in both `/perms` handlers; its `fail(400)` only stops the route if awaited (an un-awaited async throw becomes an unhandled rejection and the `UPDATE` still runs → 200).
- Unread counts posts **by others** (`p.author_id <> me`) — the author of the newest post has nothing to read; this is why a fresh topic shows no badge to its creator. The payload omits zero entries by design (the front does `unread.topics[x.id] ?? 0`).
- `guild_topic_reads` is only written on `GET …/topics/{tid}` (opening a topic). There is no per-message ack; the counter is "posts I haven't seen since last open", which is what the spec's auto-ack requires.
- `write_ranks` is populated on **existing** folders by the migration (`:= visible_ranks`); if you seed a forum by hand, set both arrays or writes default to "nobody but the Chef".

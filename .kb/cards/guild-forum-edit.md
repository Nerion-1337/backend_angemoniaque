---
title: Guilde : droits d'édition des catégories et sujets (auteur / create_topics / écriture catégorie)
slug: guild-forum-edit
status: done
updated: 2026-10-20
files:
  - src/routes/guilds.ts
  - test/integration/guild-forum-edit.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-forum-edit.test.ts
---
## Purpose
Server half of the forum edit-rights pass: `POST /guilds/topics/{id}/edit` is no longer `create_topics`-only — it is allowed for the **topic author**, holders of `create_topics` (management roles), holders of the **parent category's write right** (`guild_folders.write_ranks`), and the Chef (bypass); everyone else gets **403**. Category editing (`POST /guilds/folders/{id}/edit`) stays `create_topics`-only. `GET /guilds/{characterId}` now exposes `author_id` on every topic so the front can gate the pencil (`front` card `guild-forum-tools`).

## How it works
All in `src/routes/guilds.ts` (house `def()` idiom, `tx`):
- `POST /guilds/topics/{id}/edit`: the topic is looked up joined with its folder (404 on unknown/foreign **before** the permission check), then the gate: `if (!m.can('create_topics') && t.author_id !== m.me.id && !(t.write_ranks ?? []).includes(m.rank.name)) fail(403, 'Vous ne pouvez pas modifier ce sujet')`. `m.can` covers the Chef (leader ⇒ all permissions). `title`/`description` keep the `COALESCE` semantics (omitted = keep, `''` clears). The gate deliberately reads the **category's** `write_ranks` (spec §3), not the topic's effective write — a topic-level write override does not grant editing.
- `POST /guilds/folders/{id}/edit` unchanged: `need(m, 'create_topics')` → 403 `'Votre rang ne permet pas cette action'` for rank-less ranks; Chef passes via `can`.
- `GET /guilds/{characterId}` topic select adds `t.author_id` (next to `ch.pseudo author`), in addition to `visible_ranks`/`write_ranks` (card `guild-forum-perms`).
- Rank creation payload schema (used by the test to build permission-less ranks): `POST /guilds/ranks` `{ characterId, name (2–24), permissions }` where `permissions` is `z.record(z.boolean()).default({})` over the four known keys — unknown keys are dropped server-side (`Object.fromEntries(PERMS.map …)`), so `{ create_topics: false }` and `{}` both create a no-permission rank.

## Entry points
- `POST /guilds/topics/{id}/edit` — the front `InlineEdit` pencil, shown only when `canEditTopic` (`front` `guild-forum-tools`).
- `POST /guilds/folders/{id}/edit` — the front category pencil (`create_topics` holders + Chef).
- `GET /guilds/{characterId}` → `folders[].topics[].author_id` — the front author check.

## Data flow
- Author/manager clicks the pencil on a topic → front `canEditTopic(t, f, g.me, me.id)` passes → `POST /guilds/topics/{id}/edit` `{ title?, description? }` → server re-checks author / `create_topics` / **category** write (the front gate is a mirror, the server is authoritative) → 403 `'Vous ne pouvez pas modifier ce sujet'` or `UPDATE` (`COALESCE`; `description: ''` clears) → front `load()` re-syncs lists/badges. No page reload anywhere.

## Tests
- `test/integration/guild-forum-edit.test.ts` (needs `DATABASE_URL`; fresh `stack up`, migration 07): guild + two permission-less ranks created with the full payload schema — `Secrétariat` (`{ create_topics: false }`) and `Gardien` (`{}`); category F1 (read Chef/Officier/Membre, write `['Officier']`), F2 (read `['Chef']`, write `['Secrétariat']`); topics: T1 by the Officier in F1, T2 by the Secrétariat in F2, T3 by the Chef in F2. Assertions: folder edit — Membre (create_topics) 200 + description reflected, Secrétariat 403, Gardien 403, Chef 200; topic edit — author-only path (Secrétariat edits its own T2 with no other right, title + description persisted, `author_id` = d), create_topics path (Membre edits someone else's T1; Officier via ALL permissions), pure category-write path (Secrétariat edits the Chef's T3 because `Secrétariat ∈ F2.write_ranks`; T1's inherited `write_ranks` stays NULL), no-right 403 (Gardien on T1 and T2 — nothing changed afterwards), 404 on unknown topic id, and the list payload exposes `author_id` (c for T1, a for T3).

## Gotchas
- The 404 lookup runs **before** the permission gate: a member without rights probing a foreign topic id gets 404, not 403 (no existence disclosure).
- The author check is by `author_id` (id), not by pseudo: renaming a character can neither grant nor steal edit rights.
- Rank creation payloads in the test are the documented schema shape: `permissions` accepts a record of booleans over the four known keys only (unknown keys dropped) — `{ create_topics: false }` and `{}` both yield a no-permission rank; do not read "false" as "all permissions".
- The edit gate reads the **folder's** `write_ranks` (spec §3: « droit d'écriture sur la catégorie parente »), never the topic's effective write: a topic with a `write_ranks = []` override (nobody may post) still allows its author/managers to edit the title/description — posting rights and editing rights deliberately diverge (card `guild-forum-perms` for the post-side semantics).

---
title: Guilde : intégrité du dernier Chef + renommage des rangs
slug: guild-ranks-integrity
status: done
updated: 2026-10-20
files:
  - src/routes/guilds.ts
  - test/integration/guild-ranks.test.ts
symbols:
  - src/routes/guilds.ts:lastChef
tests:
  - test/integration/guild-ranks.test.ts
---
## Purpose
Guild-rank integrity plus rank renaming: a guild must never be left without a Chef, so the **last holder of the Chef rank** (`guild_ranks.is_leader = true`) cannot leave the guild nor be demoted to a non-Chef rank until another member holds a Chef rank. The Chef can rename any predefined/custom rank via `POST /guilds/ranks/{id}/rename` — including the Chef rank's label itself (only the name-uniqueness guard and the structural `is_leader` lock remain), names are unique per guild, and the rename cascades into the forum's `visible_ranks` lists. Ranks display order and the dynamic default visibility follow from the later revamp — see card `guild-ranks-order`.

## How it works
All in `src/routes/guilds.ts` (one route module, house `def()` idiom, transactions via `tx`):
- `lastChef(db, guildId, meId)` helper: `SELECT 1 FROM characters c JOIN guild_ranks r ON r.id = c.guild_rank_id WHERE c.guild_id = $1 AND c.id <> $2 AND r.is_leader LIMIT 1` → `rowCount` is false when *no other* member holds a Chef rank.
- `POST /guilds/leave`: replaces the old "leader can't leave while the guild has other members" check with `if (m.leader && await lastChef(...)) fail(409, 'Le dernier Chef ne peut pas quitter la guilde')`. So a Chef **can** leave as soon as another member holds a Chef rank — even if the guild still has many non-Chef members; a last Chef **cannot** leave even if they are the only member (a one-man guild can no longer be dissolved via leave).
- `POST /guilds/members/rank`: besides the existing "only the Chef appoints Chefs" 403, it now fetches the target's current rank (`LEFT JOIN guild_ranks`) and fails 409 `'Le dernier Chef ne peut pas changer de rang'` when the target currently holds a Chef rank, the new rank is not a Chef rank, and `lastChef(db, gid, targetId)` is true. Works for self-demotion too (a Chef with `assign_ranks` can no longer demote themselves while last).
- `POST /guilds/ranks/{id}/rename`: leader-only (403 `'Réservé au Chef'`), name trimmed with 2–24 chars (Zod `min(2).max(24)` + 400 after trim), duplicate name rejected (409 `'Ce nom est déjà utilisé'`). The old leader-rank 403 was **removed** by the manage-tab revamp: the Chef label is now editable like any rank label (see card `guild-ranks-order`) — the structural lock is the permissions grid, not the name. Then, because forum visibility is stored **by rank name** (`visible_ranks TEXT[]` on `guild_folders`/`guild_topics`), the handler rewrites every folder/topic of the guild that references the old name (a JS array is passed as the parameter — pg encodes it as a Postgres array literal). Since the forum v2 revamp (card `guild-forum-perms`, migration `infra/db/07_forum_perms.sql`) the same cascade also rewrites **`write_ranks`** (write rights are name-based too); a topic's `NULL` write list (inherit) is left `NULL` so inheritance survives the rename.

## Entry points
- `POST /guilds/leave` (front `Guild.jsx` → `leave()` in `GuildModal`).
- `POST /guilds/members/rank` (front Members tab rank `<select>`).
- `POST /guilds/ranks/{id}/rename` (front Manage tab pencil icon → `saveRename` in `Manage`).
- No schema change: `guild_ranks.is_leader` and `visible_ranks TEXT[]` already existed (migrations `02_extra.sql`/`03_features.sql`).

## Data flow
- Leave/rank-change guards read `characters.guild_rank_id` + `guild_ranks.is_leader` (members holding a Chef rank), then update `characters` inside the `tx` transaction — the guard and the write are atomic.
- Rename writes `guild_ranks.name`, then `guild_folders.visible_ranks` + `write_ranks` and `guild_topics.visible_ranks` + `write_ranks` (name swap, only rows that actually reference the old name; topic `write_ranks = NULL` stays NULL).
- Forum filtering (`GET /guilds/{characterId}`) matches `visible_ranks` against the member's current rank **name**, so the cascade is what keeps folder/topic visibility consistent after a rename.
- `GET /guilds/{characterId}` `members[]` now also exposes **`game_rank`** : `LEFT JOIN specializations s ON s.id = c.specialization_id` → `s.name` (in-game rank per race, e.g. Soldat/Duc/Titan/Divin — null when the character has no specialization ; the front shows « — »). Added for the guild list tab (front card `guild-list-presentation`).

## Tests
- `test/integration/guild-ranks.test.ts` (needs `DATABASE_URL`; runs in CI and via `stack exec backend -- npx vitest run`): full parcours with three characters — last-Chef cannot leave / cannot demote themselves (409); appointing a second Chef frees the first (rank change 200, leave 200, ex-Chef out of guild 403 on `/guilds/{id}`); the second Chef becomes the new last Chef and is blocked again (409), transfers the rank to a third member and leaves; rename parcours: Chef label now renamable (200, holder's `me.rank` follows — assertion updated from 403), no-op rename ok, `Officier` → `Sergent` updates the folder **and** topic `visible_ranks` to `['Sergent']`, non-Chef rename rejected (403), duplicate name rejected (409), `Membre` → `Recrue` renames the holder's displayed rank. Rank-order coverage lives in `guild-ranks-order.test.ts`.
- Pre-existing `test/integration/features.test.ts` (guilds: ranks, rights, applicants, forum) still passes — no behaviour regression on the appoint/permission flows.

## Gotchas
- **Forum visibility is by rank NAME, not id** (`visible_ranks`/`write_ranks` hold strings). Renaming without the cascade silently breaks folder/topic visibility **and write rights** for the renamed rank — keep the cascade block (both arrays, both tables) in the rename handler if the schema ever changes.
- `visible_ranks` is a Postgres `TEXT[]`, not jsonb: pass a plain JS array (pg encodes `{...}`); `JSON.stringify` produces `["…"]` which Postgres rejects (`malformed array literal`).
- A last Chef cannot leave even as the sole member (integrity rule, per design) — a 1-person guild has no "disband" path through `leave`.
- `guilds.leader_id` (founder) is written at creation but never read by the rules — the Chef **rank** is the only source of authority; do not start using `leader_id`.
- The leader rank label **can** be renamed now: the 403 guard was removed and the forum no-chosen-rank default follows the guild's real leader-rank name via `leaderRankName(db, gid)` instead of the hardcoded `'Chef'` (card `guild-ranks-order`). The structural lock is elsewhere: the `is_leader` rank keeps all permissions and its checkboxes stay disabled in the UI.
- Old message `'Le Chef doit d'abord transmettre son rang'` is gone; the leave 409 now says `'Le dernier Chef ne peut pas quitter la guilde'` (front mirrors the rule in `front/src/lib/guild.js` for the disabled UI states).

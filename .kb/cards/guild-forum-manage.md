---
title: Guilde : suppression en cascade et transfert de sujet du forum
slug: guild-forum-manage
status: done
updated: 2026-10-20
files:
  - src/routes/guilds.ts
  - test/integration/guild-forum-manage.test.ts
symbols:
  - src/routes/guilds.ts:guilds
tests:
  - test/integration/guild-forum-manage.test.ts
---
## Purpose
Gestion du forum côté serveur : supprimer une **catégorie** (emporte ses sujets, leurs messages et leurs états de lecture) ou un **sujet** (messages + lectures), réservés au Chef ; transférer un sujet **d'une catégorie à l'autre** (détenteurs de `create_topics`, le Chef passe), le sujet allant en fin de liste de la cible. Complète `guild-forum-edit` (édition titre/description) et `guild-forum-perms` (droits par rang).

## How it works
Les FK du schéma infra (`02_extra.sql`) sont **sans** `ON DELETE CASCADE` (`REFERENCES …` plain = RESTRICT par défaut) : on supprime donc **explicitement les enfants dans l'ordre**, dans une même transaction `tx` (toute la cascade atomique) :
- **`POST /guilds/folders/{id}/delete`** — Chef **seul** (`m.leader`, PAS `need()` : un Officier « tous droits » y a droit, mais pas de supprimer) ; 404 si la catégorie n'est pas de la guilde du demandeur ; puis, dans la tx : pour chaque sujet de la catégorie `DELETE guild_posts WHERE topic_id` + `DELETE guild_topic_reads WHERE topic_id` → `DELETE guild_topics WHERE folder_id` → `DELETE guild_folders WHERE id`.
- **`POST /guilds/topics/{id}/delete`** — Chef seul, 404 (recherche **avant** la permission) ; `DELETE guild_posts` → `DELETE guild_topic_reads` → `DELETE guild_topics` (dans la tx).
- **`POST /guilds/topics/{id}/move`** — `need(m, 'create_topics')` (le Chef passe par `can`) ; 404 sujet ou 404 catégorie cible (recherches avant toute mutation) ; même catégorie = **no-op 200** ; sinon `UPDATE guild_topics SET folder_id, sort_order = (max+1 de la cible)` — le sujet part en **fin de liste** de la cible ; ses messages (`guild_posts.topic_id`) et ses droits (`visible_ranks`/`write_ranks` sur le sujet) **voyagent avec lui** (aucune mutation).

Les deux routes de suppression sont dans la famille de `guilds` (authentifiées) et partagent les helpers maison (`member`, `need`, `fail`, `P`, `tx`). L'UI correspondante (icônes + écran de confirmation) est côté front, card `guild-forum-tools`.

## Entry points
- `POST /guilds/folders/{id}/delete` — body `{ characterId }` ; 200 `{ ok: true }` / 403 « Réservé au Chef » / 404 « Catégorie introuvable ».
- `POST /guilds/topics/{id}/delete` — body `{ characterId }` ; 200 / 403 « Réservé au Chef » / 404 « Sujet introuvable ».
- `POST /guilds/topics/{id}/move` — body `{ characterId, folderId }` ; 200 (y compris no-op même catégorie) / 403 sans `create_topics` / 404 sujet ou cible inconnus.

## Data flow
- **Suppression catégorie** : Chef → tx → (pour chaque sujet : posts → reads) → topics → folder → COMMIT. Les sujets liés ne sont plus visibles par personne (`GET /guilds/{me}`) ; `GET /guilds/topics/{me}/{topicId}` (message list) et `POST /guilds/topics/{id}/edit` répondent 404 après (le sujet n'existe plus).
- **Transfert** : demandeur → vérifs 404 → `UPDATE folder_id, sort_order` → le sujet apparaît en **dernier** dans la liste de la cible pour tous les lecteurs de celle-ci ; sa vue « messages » est inchangée (mêmes posts). Le badge de non-lus suit le sujet (c'est le topic id qui compte, pas la catégorie).

## Tests
- `test/integration/guild-forum-manage.test.ts` (Postgres, schéma infra 02 → 07 ; `describe.skipIf(!DATABASE_URL)`) :
  - suppression de catégorie — 403 pour Officier (tous droits, **non**-Chef), Membre, Secrétariat, Gardien ; 200 Chef ; la catégorie disparaît de `GET /guilds`, les sujets d'autres catégories restent intacts, le sujet supprimé 404 en `GET /guilds/topics/{me}/{id}` et `POST /guilds/topics/{id}/edit`.
  - suppression de sujet — 403 non-Chef ; 200 Chef ; le sujet disparaît de sa catégorie (les voisins restent), son ouverture 404.
  - transfert — 403 pour un rang **sans** `create_topics` (Secrétariat/Gardien) ; 200 pour un Membre ; le sujet passe en **dernier** de la cible (après un sujet préexistant) et son premier message (`'Or'`) suit le sujet.
  - transfert — 404 catégorie cible inconnue, 404 sujet inconnu, **200 no-op** quand le sujet est déjà dans la cible.
  - suppression inconnus — 404 catégorie/sujet `99999999`.
- Lancer dans la stack (`stack exec backend -- npx vitest run` ou le `/tmp/app` writable, cf. pièges du conteneur) : la suite compte 14 fichiers / 77 tests.

## Gotchas
- **CASCADE MANUELLE** : les FK du schéma n'ont pas d'`ON DELETE CASCADE` — ajouter une table enfant qui référencera `guild_topics`/`guild_folders` **exigera** de l'ajouter ici (sinon la suppression 500 sur constraint violation).
- **Chef ≠ « tous droits »** : un Officier (permissions pleines) échoue en 403 « Réservé au Chef » — la suppression est un privilège du poste, pas de la permission `create_topics`.
- Le **no-op** du transfert (même catégorie) est **200**, pas 400 : le front l'appelle sans vérification.
- `guild_topic_reads` cascade déjà sur la suppression d'un personnage/sujet (FK `ON DELETE CASCADE` sur `character_id`/`topic_id` en 07) — les deletes explicites ici couvrent le reste ; ne pas « nettoyer » les `write_ranks` vides/NULL des objets supprimés (ils partent avec la ligne).
- Le transfert ne **réordonne pas** l'intérieur de la cible : le sujet est simplement ajouté après `max(sort_order)+1` ; la réorganisation fine reste à `/guilds/reorder` (card `guild-forum-order`).

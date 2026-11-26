---
title: Annonces, forum public, pages légales et modération
slug: forum-public
status: done
updated: 2026-11-26
files:
  - src/routes/forum.ts
  - src/game/forumAccess.ts
  - src/middleware/auth.ts
symbols:
  - src/game/forumAccess.ts:readDenied
  - src/game/forumAccess.ts:postDenied
  - src/routes/forum.ts:viewerOf
  - src/routes/forum.ts:tosVersion
tests:
  - test/forumAccess.test.ts
  - test/integration/forum.test.ts
---
## Purpose
Annonces et forum public lisibles depuis l'écran d'accueil (sans compte), pages légales (CGU, confidentialité, mentions légales, règlement, cookies) avec acceptation versionnée des CGU, signalements et modération par l'équipe (migration 40).

## Business rules
- Lecture : `/forum*` et `/legal*` passent le middleware avec jeton FACULTATIF (visiteur anonyme) ; toute écriture exige un compte (401).
- Droits (game/forumAccess.ts, purs) : catégorie masquée ou `read_access = staff` → équipe seulement ; `members`, `races` (un personnage du compte de l'une des races ; vide = toutes) ou `min_rank` > 1 (rang max des personnages du compte) → compte connecté et conforme.
- Écrire : lecture permise + CGU en vigueur acceptées (`accounts.tos_version` ≥ version de `legal_pages.cgu`) + pas en sourdine (`forum_muted_until`) + `post_access` (staff = équipe seulement, ex. Annonces) + catégorie et sujet non verrouillés.
- Équipe = rôles `mod` et `admin` : voit et écrit partout (masqué, verrouillé, réservé), voit l'identifiant de l'auteur et les signalements ; les autres jamais (ni email).
- Auteur affiché : pseudo du premier personnage du compte, sinon « Voyageur #id ». Contenu = texte brut (10 000 caractères max, titre 3-120).
- Auteur : modifie ses messages (titre avec le 1er), supprime ses réponses ; supprimer le 1er message supprime le sujet, refusé (409) s'il a des réponses (équipe : toujours).
- Signalement : un par membre et par message (renvoyer le remplace et le rouvre) ; masquer un message classe ses signalements.
- Modération (`/forum/mod/*`, mod ou admin) : sujet épinglé / verrouillé / masqué / déplacé / supprimé, message masqué, signalements, sourdine d'un joueur (0-8760 h ; jamais un membre de l'équipe ni soi-même). Chaque action est auditée.
- Admin seulement (`/admin/forum/*`, `/admin/legal/*`) : catégories (accès, races, rang, verrou, masquage, ordre), pages légales (nouvelle version des CGU avec `bump` → chaque membre doit réaccepter), rôle modérateur (jamais sur un admin ni soi-même).
- Inscription avec `acceptTos: true` enregistre la version en vigueur ; `POST /legal/accept` la réaccepte.

## Gotchas
- `/legal/accept` est un POST sous le préfixe à jeton facultatif : la route vérifie elle-même la connexion.
- Le test d'intégration incrémente la version des CGU de la base de test (aucun autre test n'en dépend).

## Tests
`test/forumAccess.test.ts` (droits purs) ; `test/integration/forum.test.ts` (lecture anonyme, CGU, écriture, auteur, signalement, masquage, verrou, épingle, sourdine, modérateur, accès par race, catégorie masquée, nouvelle version des CGU).

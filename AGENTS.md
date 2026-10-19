# AGENTS.md — ia_agent / back

> Dépôt `back` du projet `ia_agent`. Les règles générales (mémoire `kb`, cycle plan/code/tests/fiche, commits,
> web, outils `stack` et `gitpush`) sont dans `../AGENTS.md` : **relis-les**, elles s'appliquent ici.
> Ce fichier ne contient que ce qui est propre à ce dépôt.

## Rôle de ce dépôt
- API HTTP REST et documentation interactive via OpenAPI (Swagger).
- Validation stricte des flux entrants et sortants avec Zod.
- Logique métier, accès et requêtes PostgreSQL via la variable `DATABASE_URL`.
- Mise en cache et gestion des sessions ou files d'attente Redis via la variable `REDIS_URL`.

## Stack et commandes
- **Technologies** : Hono, `@hono/zod-openapi`, Zod, TypeScript / JavaScript (modules ES), OpenAPI.
- **Conteneurisation** : s'exécute dans le conteneur `backend` (`ange-prod-backend` en production). Les variables `DATABASE_URL` et `REDIS_URL` sont injectées par l'infrastructure.
- **Commandes** :
  - Installation : `npm ci`
  - Lancement dev : `npm run dev` (ou via `stack exec backend -- npm run dev`)
  - Tests : `npm test` — enregistré dans `.kb/config.json` (`kb init --test-cmd "npm test"`)
  - Validation des types et lint : `npm run check`
- **Dépendances** : **aucune** nouvelle dépendance (`npm install <package>`) sans mon accord préalable.

## Conventions de code et architecture des routes
Pour garantir la lisibilité et un découpage modulaire :
- **Taille des fichiers** : pas de contrôleurs géants ni de fichiers à rallonge ; découpe en petits modules unitaires.
- **Typage et validation** : chaque endpoint utilise `@hono/zod-openapi` avec un schéma Zod dédié pour les paramètres, le corps de requête et les codes de statut HTTP.

## Travail dans ce dépôt
- Branche `agent` (déjà créée). Commits : `gitsave "<message>"` lancé depuis CE dossier.
- Publier : `gitpush` depuis CE dossier. Je fais la Pull Request et le merge.
- Mémoire : `kb init` si `.kb/` n'existe pas encore dans ce dossier, puis le cycle habituel (`../AGENTS.md`).

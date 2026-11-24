---
title: Procedural map & terrain: resources, movement rules, spawn, map/action routes
slug: map-terrain-gather
status: done
updated: 2026-11-24
files:
  - src/game/terrain.ts
  - src/game/humanMap.ts
  - src/game/resources.ts
  - src/game/burn.ts
  - src/game/movement.ts
  - src/game/spawn.ts
  - src/routes/map.ts
  - src/routes/actions.ts
  - src/routes/inventory.ts
symbols:
  - src/game/terrain.ts:terrain
  - src/game/terrain.ts:noiseAt
  - src/game/terrain.ts:inSafeZone
  - src/game/terrain.ts:FEATURES
  - src/game/resources.ts:RES_BY_ID
  - src/game/burn.ts:ignite
  - src/game/movement.ts:stepCost
  - src/game/movement.ts:travel
  - src/game/movement.ts:spend
  - src/game/movement.ts:actor
  - src/game/spawn.ts:freeCell
  - src/game/spawn.ts:spawn
  - src/game/spawn.ts:hourlySpawns
  - src/routes/map.ts:mapRoutes
  - src/routes/actions.ts:actions
tests:
  - test/rules.test.ts
  - test/world.test.ts
  - test/integration/map-gather.test.ts
---
## Purpose
Modèle du monde : Monde des Hommes (carte 1, grille 200×200 dessinée), autres mondes générés ; chaque case a un type (9),
un coût, une ressource récoltable et un drapeau de brûlure. Règles de déplacement, de récolte, d'apparition, zone sacrée,
et API des cartes (`/map/*`) et actions (`/actions/*`). Le front en garde un miroir identique.

## Business rules
- Types de case : plain, forest, mountain, arid, snow, ether, volcano, shallow, deep. Coût d'un pas = coût du type DANS CE MONDE (admin « Cases », card `tile-types`), défaut `KIND_COST` (1, 2, 3, 2, 3, 3, 3, 4, 99).
- Coût réel (`stepCost`) : monture volante = 1 partout ; monture aquatique = 1 sur l'eau, impossible sur terre ; à pied / monture terrestre = coût de la case, eau profonde impossible.
- Déplacement en ligne droite (8 directions, Chebyshev), sans contournement : une case occupée sur le trajet bloque tout le déplacement (409 « Chemin bloqué ») ; hors carte → 409.
- Paiement : l'invocation contrôlée paie tout ; sinon la monture paie le trajet et le héros les actions ; énergie insuffisante → 409.
- Traverser une case de lave enflamme le HÉROS (pas les invocations) : `burn_until = now + 3 h`, 10 PV/h au tick, jamais mortel (PV min 1).
- Récolte : 4 énergie, sur place ou à distance (trajet d'abord) ; eau profonde à pied → 409 « Rien à récolter ici » AVANT tout trajet ; stockée sous l'id STABLE du catalogue.
- Zone sacrée : Chebyshev ≤ 10 de l'Hôtel de ville (carte 1) ; aucun combat joueur contre joueur si l'un des deux y est ; monstres exemptés.
- Apparition d'un personnage : zone de sa race (card `races-spawn-clock`), sinon capitale ; case libre jamais sur eau ni lave, rayon élargi par pas de 2 si plein (503 seulement si la carte est pleine).
- Les réponses de carte ne donnent jamais de PV exacts (état public sur 4 niveaux) ; `/map/{id}/area` limité à r ≤ 25.
- Inventaire : verrou de 12 h au déséquipement, compatibilité slot/objet, arme à deux mains interdit la main secondaire, 5 emplacements spéciaux pour un humain (4 sinon), sac de 20.
- Un bâtiment occupable ne bloque pas le trajet (`BLOCKING`) ; son occupant reçoit ses bonus de vue / portée (card `buildings-occupy`).
- Récolte sur une case couverte par un gisement : sa ressource, son stock et son rendement priment (card `deposits`) ; `/map/{id}/cell` expose `deposit`.

## Gotchas
- Terrain dupliqué back ⇄ front (fichiers générés : modifier les scripts `tools/gen_*`, jamais les fichiers générés).
- Le coût 99 de l'eau profonde n'est qu'affiché : ne jamais additionner `t.cost` pour un trajet, passer par `stepCost`.
- Toujours passer `mapId` à `terrain()` côté back (sans lui, c'est le monde « courant » du front).
- Tout consommateur de `characters.resources` doit utiliser l'id du catalogue, pas le nom affiché.

## Tests
`test/rules.test.ts` (déterminisme, id ⇄ nom sur les 3 cartes, règles de l'eau, lave = 10) ; `test/world.test.ts` (invariants générés : hôtel, zone sacrée, portails, ressources) ; `test/integration/map-gather.test.ts` (déplacement, récolte, eau profonde, zone sacrée, confidentialité).

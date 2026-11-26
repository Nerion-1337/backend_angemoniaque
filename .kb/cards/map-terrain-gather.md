---
title: Procedural map & terrain: resources, movement rules, spawn, map/action routes
slug: map-terrain-gather
status: done
updated: 2026-11-26
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
  - src/game/resources3.ts
  - src/game/levels.ts
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
  - src/game/harvest.ts:harvestMissing
  - src/game/levels.ts:heightParts
  - src/game/movement.ts:mountPassives
tests:
  - test/rules.test.ts
  - test/world.test.ts
  - test/integration/map-gather.test.ts
  - test/flyingSummon.test.ts
  - test/integration/bagResources.test.ts
  - test/levels.test.ts
  - test/integration/heightVision.test.ts
  - test/integration/appearance.test.ts
---
## Purpose
Modèle du monde : Monde des Hommes (carte 1, grille 200×200 dessinée), autres mondes générés ; chaque case a un type (9),
un coût, une ressource récoltable et un drapeau de brûlure. Règles de déplacement, de récolte, d'apparition, zone sacrée,
et API des cartes (`/map/*`) et actions (`/actions/*`). Le front en garde un miroir identique.

## Business rules
- Types de case : plain, forest, mountain, arid, snow, ether, volcano, shallow, deep. Coût d'un pas = coût du type DANS CE MONDE (admin « Cases », card `tile-types`), défaut `KIND_COST` (1, 2, 3, 2, 3, 3, 3, 4, 99).
- Coût réel (`stepCost`) : volant (monture montée, ou créature contrôlée dont le type a la locomotion `air`, `summonLoco`) = 1 partout ; aquatique = 1 sur l'eau ; terre ferme impossible si la monture n'est pas terrestre (combinaisons, card `monster-mounts`) ; à pied / monture terrestre = coût de la case, eau profonde impossible.
- Déplacement en ligne droite (8 directions, Chebyshev), sans contournement : une case occupée sur le trajet bloque tout le déplacement (409 « Chemin bloqué ») ; hors carte → 409.
- Paiement : l'invocation contrôlée paie tout ; sinon la monture paie le trajet et le héros les actions ; énergie insuffisante → 409.
- Traverser une case de lave enflamme le HÉROS (pas les invocations) : `burn_until = now + 3 h`, 10 PV/h au tick, jamais mortel (PV min 1).
- Récolte : 4 énergie, sur place ou à distance (trajet d'abord) ; eau profonde à pied → 409 « Rien à récolter ici » AVANT tout trajet ; stockée sous l'id STABLE du catalogue.
- Zone sacrée : Chebyshev ≤ 10 de l'Hôtel de ville (carte 1) ; aucun combat joueur contre joueur si l'un des deux y est ; monstres exemptés.
- Apparition d'un personnage : zone de sa race (card `races-spawn-clock`), sinon capitale ; case libre jamais sur eau ni lave, rayon élargi par pas de 2 si plein (503 seulement si la carte est pleine).
- Les réponses de carte ne donnent jamais de PV exacts (état public sur 4 niveaux) ; `/map/{id}/area` limité à r ≤ 25.
- Inventaire : verrou de 12 h au déséquipement, compatibilité slot/objet, arme à deux mains (`two_handed`, card `item-stats`) en main principale seulement et l'autre main libre, 5 emplacements spéciaux pour un humain (4 sinon), sac de 20.
- Un bâtiment occupable ne bloque pas le trajet (`BLOCKING`) ; son occupant reçoit ses bonus de vue / portée (card `buildings-occupy`).
- Récolte sur une case couverte par un gisement : sa ressource, son stock et son rendement priment (card `deposits`) ; `/map/{id}/cell` expose `deposit`.
- `/map/{id}/area` et `/cell` : `flying` = monture volante du cavalier, ou monstre / invocation dont la locomotion comprend `air` (affichage au niveau du ciel côté front).
- Créature contrôlée : sa locomotion vient de son type de monstre (`actor().loco`, exposée dans `actor.loco` de `/characters/{id}`) ; aquatique = 1 sur l'eau, terre ferme interdite sans `land` ; récolte en eau profonde possible si volante ou aquatique.
- Royaume des Morts (carte 3, et tout monde généré) : AUCUNE ressource des autres mondes ; 3 ressources uniques (`resources3` : asphodèle spectrale / plaine, saule des Lamentations / forêt, âme cristallisée / massif) sur ≈ 0,5 % des cases de leur type (`RARE3`, hash fixe) ; les autres cases n'ont rien à récolter.
- Récolte : refus 409 « Sac plein » AVANT tout trajet / toute dépense si la quantité récoltée demande un emplacement de plus que la place libre.
- `/map/{id}/cell?characterId=` (personnage du joueur) : `harvestMissing` = null (récolte libre), [] (rien ne manque) ou une ligne par option de ce qui manque (objets équipés comptés).
- Vision et portée du héros (`actor`) : +1 par niveau de HAUTEUR (`game/levels.ts`, miroir de `front/lib/levels.js`) — sol de la case (jamais négatif, sommet = +5) + taille de la monture terrestre / aquatique (1 à 3) ; monture volante = +6 quel que soit le sol ; + capacités PASSIVES des sorts du type de la monture (stats see / range) ; + bâtiment occupé. Les anciens `bonus_see` / `bonus_range` des montures ne comptent plus. `actor().extra` détaille ces apports (fiche, survol).

- `GET /map/{id}/area` renvoie aussi `rank` (palier de rang du personnage) et `building_race` (race d'une capitale) : allure 3D selon le rang et Hôtel de ville selon la race.
- `GET /map/{id}/area` : `model`, `icon`, `locomotion`, `size` des monstres (repli sur le prototype) et invocations ; `mount_model`, `mount_icon`, `mount_loco`, `mount_size` de la monture d'un personnage.
## Gotchas
- Terrain dupliqué back ⇄ front (fichiers générés : modifier les scripts `tools/gen_*`, jamais les fichiers générés).
- Le coût 99 de l'eau profonde n'est qu'affiché : ne jamais additionner `t.cost` pour un trajet, passer par `stepCost`.
- Toujours passer `mapId` à `terrain()` côté back (sans lui, c'est le monde « courant » du front).
- Tout consommateur de `characters.resources` doit utiliser l'id du catalogue, pas le nom affiché.

## Tests
`test/rules.test.ts` (déterminisme, id ⇄ nom sur les 3 cartes, règles de l'eau, lave = 10) ; `test/world.test.ts` (invariants générés : hôtel, zone sacrée, portails, ressources) ; `test/integration/map-gather.test.ts` (déplacement, récolte, eau profonde, zone sacrée, confidentialité).

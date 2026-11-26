---
title: Races (apparition, limites, équipement de départ, races libres, admin sans limite) et horloge du monde persistante
slug: races-spawn-clock
status: done
updated: 2026-11-26
files:
  - src/game/clock.ts
  - src/routes/characters.ts
  - src/game/spawn.ts
  - src/routes/admin/races.ts
  - src/index.ts
  - src/game/startKit.ts
symbols:
  - src/game/clock.ts:catchUp
  - src/game/clock.ts:startClock
  - src/game/clock.ts:hoursDue
  - src/routes/characters.ts:checkCreation
  - src/game/spawn.ts:spawnZone
  - src/game/startKit.ts:grantKit
  - src/game/startKit.ts:checkKit
tests:
  - test/integration/xpRespawn.test.ts
  - test/clock.test.ts
  - test/integration/racesClock.test.ts
  - test/integration/startKit.test.ts
---
## Purpose
Races : zone d'apparition, limites de personnages, équipement de départ et races libres jouables ; compte admin sans limite.
Horloge du monde persistante : le temps de jeu avance même serveur arrêté.

## Business rules
- Horloge : un tick horaire par heure PLEINE écoulée depuis `game_clock.last_tick_at`, rattrapé au démarrage puis chaque minute ; l'horloge avance d'1 h après chaque tick (le reste < 1 h est conservé).
- Un tick en échec arrête le rattrapage sans compter cette heure ; au-delà de 30 jours d'arrêt, seules les 30 dernières journées sont rejouées.
- Un verrou Postgres sérialise le rattrapage : jamais deux instances en même temps, jamais une heure comptée deux fois.
- `POST /admin/tick` = tick supplémentaire, hors horloge.
- Création d'un personnage (vérifiée par le SERVEUR et par le trigger SQL) : race existante, active, avec au moins un rang ; pour un joueur, une seule race par compte (400), au plus `max_per_account` personnages (409, NULL = illimité), population de la race < `max_total` (409, NULL = illimité).
- Le compte admin n'a aucune de ces limites et peut avoir toutes les races.
- Toute race créée en admin est jouable dès qu'elle a un rang.
- Apparition : zone de la race (monde, centre, rayon ; centre dans les bornes du monde) sinon capitale de la race (rayon 4).
- Équipement de départ (`races.start_kit`) : palier (sinon le premier), or, XP, ressources (id du catalogue), objets au sac ou au coffre, sorts (plus de montures, migration 43 : une ancienne clé `mounts` est ignorée) ; chaque référence est vérifiée à l'enregistrement (400/404).
- Kit vide = premier palier, 0 or, rien d'autre ; la migration 18 a repris le kit historique (150 or, 6 objets au sac, Destrier) pour les races existantes.
- Passage de rang par conditions (`/characters/{id}/rank-up`, conditions par rang) : card `rank-up` ; le tick rétablit les rangs temporaires échus.
- Races & rangs : table « gain d'XP selon l'écart de rang » (`GET/PUT /admin/content/xp-rank`, `{ table: { "écart": % } }`, écarts entiers -99..99, % 0..1000, « +1 » normalisé en « 1 »).

## Gotchas
- Ne jamais réintroduire un `setInterval` d'une heure : tout passe par `catchUp`.
- Ne jamais remettre `last_tick_at` à `now()` dans une migration (effacerait les heures dues).
- Le code « même race » est 400 (comme le trigger historique) ; les autres limites 409.
- Une référence du kit supprimée ensuite est simplement ignorée à la création.
- Tests : le serveur de la stack rattrape aussi chaque minute ; d'où `n ∈ {0, 3}`.

## Tests
`test/clock.test.ts` (heures pleines, reste conservé, borne, tick en échec) ; `test/integration/racesClock.test.ts` (zone d'apparition, limites, admin multi-races, horloge → +3 × récupération) ; `test/integration/startKit.test.ts` (kit historique, race libre jouable, kit complet appliqué, références invalides refusées).

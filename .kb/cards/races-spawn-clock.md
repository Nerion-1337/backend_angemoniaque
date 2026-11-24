---
title: Races (zone d'apparition, limites de personnages, admin sans limite) et horloge du monde persistante
slug: races-spawn-clock
status: done
updated: 2026-11-24
files:
  - src/game/clock.ts
  - src/routes/characters.ts
  - src/game/spawn.ts
  - src/routes/admin/races.ts
  - src/index.ts
symbols:
  - src/game/clock.ts:catchUp
  - src/game/clock.ts:startClock
  - src/game/clock.ts:hoursDue
  - src/routes/characters.ts:checkCreation
  - src/game/spawn.ts:spawnZone
tests:
  - test/clock.test.ts
  - test/integration/racesClock.test.ts
---
## Purpose
(1) Chaque race définit où naissent ses nouveaux personnages (monde, centre, rayon) et ses limites (par compte, population
totale) ; le compte admin n'a aucune limite ni règle de race. (2) Le tick horaire (XP, or, régénération PV/énergie, production,
spawns, brûlure, buffs) s'applique réellement : le temps est compté même serveur arrêté.

## How it works
- **Horloge** (`clock.ts`) : table `game_clock.last_tick_at`. `catchUp()` prend un verrou consultatif Postgres (`pg_advisory_lock`,
  bloquant : une seule instance à la fois), calcule `hoursDue` (heures PLEINES depuis `last_tick_at`), rejoue `hourlyTick()` autant de
  fois et avance `last_tick_at` d'1 h après CHAQUE tick (le reste < 1 h est conservé ; un tick en échec arrête la boucle sans compter
  cette heure). Au-delà de `MAX_CATCHUP_H` (30 jours) les heures les plus anciennes sont abandonnées. `startClock()` (appelé par
  `index.ts`) : rattrapage au démarrage puis toutes les minutes. Avant : `setInterval(hourlyTick, 1 h)` remis à zéro à chaque
  redémarrage (`tsx watch` en dev) → le tick ne partait quasiment jamais et rien n'était rattrapé.
- `POST /admin/tick` reste un tick SUPPLÉMENTAIRE immédiat (n'avance pas l'horloge). `GET /admin/dashboard` expose `clock.last_tick_at`.
- **Création** (`characters.ts` `checkCreation`) : race existante, active, avec au moins un rang ; compte joueur : une seule race
  (400, même code que le trigger SQL), `races.max_per_account` (409), `races.max_total` (409) ; `role === 'admin'` → aucune limite.
  `POST /characters` accepte toute clé de race (plus d'enum). `GET /characters/races` : races actives avec `allowed` / `reason` /
  `max` pour CE compte (+ `admin`, `locked`, `count`) — utilisé par l'écran de création.
- **Apparition** (`spawn.ts` `spawnZone`) : `races.spawn_map_id/x/y/radius` si renseignés, sinon la capitale de la race (rayon 4) ;
  `freeCell` élargit le rayon par pas de 2 si la zone est pleine.
- **Admin races** (`races.ts`) : champs `spawn_*`, `max_per_account`, `max_total` (null = défaut / illimité) ; `checkSpawn` :
  monde existant et centre dans ses bornes (400/404) ; PUT renvoie la ligne relue.

## Entry points
`index.ts` → `startClock()` ; `POST /characters`, `GET /characters/races` ; `PUT/POST /admin/content/races` ; front : `Login.jsx`
`CharSelect`, `src/admin/raceRules.jsx` (card front `race-rules-ui`).

## Data flow
`game_clock` (1 ligne), `races` (colonnes migration 17), `characters`, `positions`. Garde-fou SQL : trigger `chk_char_limit`
réécrit en migration 17 (mêmes règles, admin exempté). Schéma : card infra `races-clock-schema`.

## Tests
`test/clock.test.ts` (unit, pool simulé) : heures pleines, 3 h 30 → 3 ticks + 30 min conservées, borne `MAX_CATCHUP_H`, tick en
échec non compté. `test/integration/racesClock.test.ts` : zone d'apparition (monde 3, carré ± rayon), centre hors monde 400 ;
limites (max/compte 409, autre race 400, race inconnue 400, population 409, `/characters/races` allowed=false) ; admin crée
ange + démon + humain ; horloge reculée de 3 h 20 → énergie +3 × récupération, 20 min conservées. Vérifié aussi en réel sur la
stack : horloge reculée de 2 h 10 → le serveur a rattrapé 2 ticks seul dans la minute.

## Gotchas
- Ne jamais réintroduire un `setInterval` d'une heure : tout passe par `catchUp` (sinon ticks perdus ou doublés).
- `catchUp` n'est pas exporté en route : le bouton admin « +1 heure » ajoute un tick hors horloge (volontaire).
- `specializations.race` a un CHECK (human/demon/angel/nephilim) : une race créée en admin hors de cette liste ne peut pas encore
  avoir de rang, donc n'est pas jouable (`reason: Pas encore de rang`).
- Tests : le serveur de la stack rattrape lui aussi chaque minute ; le verrou garantit l'absence de double comptage, d'où `n ∈ {0, 3}`.

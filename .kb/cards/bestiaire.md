---
title: "Bestiaire (phase 2): loot roll, hourly spawns, combat death, admin routes & status"
slug: bestiaire
status: done
updated: 2026-11-24
files:
  - src/game/loot.ts
  - src/game/combatlib.ts
  - src/routes/admin/bestiary.ts
  - src/routes/admin/monsters.ts
  - src/game/spawn.ts
  - src/game/entity.ts
symbols:
  - src/game/loot.ts:rollLoot
  - src/game/combatlib.ts:monsterDeath
  - src/routes/admin/bestiary.ts:bestiaryRoutes
  - src/routes/admin/monsters.ts:monsterRoutes
  - src/game/spawn.ts:hourlySpawns
  - src/game/entity.ts:monsterOnMap
tests:
  - test/loot.test.ts
  - test/integration/bestiary.test.ts
---
## Purpose
Boucle du bestiaire (phase 2) : un monstre tué donne son butin (or + entrées pondérées de `monster_loot` : objets, ressources,
exemplaires divins), des instances sauvages apparaissent au tick horaire selon `spawn_rules`, et l'admin gère butins, règles
d'apparition et un état du bestiaire (instances sur les cartes, gardiens des divins).

## Business rules
- Butin tiré À LA MORT, jamais différé : `gold_current` du monstre + chaque entrée à `drop_rate × game_config.drop_rate` %.
- Ressource spéciale `or` = crédit sur `characters.gold` (pas dans `resources`). Objet : quantité ajoutée à la ligne existante, sinon insertion. Ressource : `+qté` dans `characters.resources` (clé = id du catalogue).
- Divin du butin : transfert du détenteur seulement (`grantDivine`, jamais d'insertion) ; plafond atteint ou pièce déjà détenue = journalisé, non bloquant.
- Une instance sauvage tire le butin de son PROTOTYPE (`data.prototype`) ; à sa mort elle disparaît (ligne, position, ses propres butins).
- Apparition horaire : règle active, fenêtre `interval_h` écoulée, tirage `< probability` %, puis plafonds `max_instances` (prototype + copies) et `entity_caps` (global / per_zone) ; case libre du rectangle, jamais eau ni lave.
- Un monstre placé, invoqué ou gardien de divins ne peut pas être supprimé (409).
- Monstre ancré tué : régénération immédiate, ou réincarnation différée si un délai est réglé (card `monster-details`).

## Gotchas
- `m.data->>'prototype'` est du texte : comparer à `$1::text` (sinon « operator does not exist: text = integer »).
- L'INSERT d'apparition lie exactement 13 paramètres (`$2` et `$7` doublés) ; un de plus → 500.
- `character_items` n'a pas de contrainte unique : pas d'`ON CONFLICT`, UPDATE puis INSERT.
- Supprimer une instance ne doit jamais toucher les tables du prototype.
- `maps.name_file` est le titre de la carte (pas de `maps.name`).
- Le test d'intégration doit garder son nettoyage `afterAll` (règles actives cumulées sinon → cartes saturées, « Chemin bloqué »).

## Tests
`test/loot.test.ts` (or, entrées 100 % / 0 %, multiplicateur, butin du prototype) ; `test/integration/bestiary.test.ts` (butin, apparition jusqu'au plafond, mort, réapparition, coûts/plafonds d'invocation, audit).

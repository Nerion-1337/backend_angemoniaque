---
title: Couches sol / airs, portée mêlée / distance, XP de combat et entraînement, avatar du classement
slug: layers-combat-xp
status: done
updated: 2026-11-27
files:
  - src/game/layers.ts
  - src/game/reach.ts
  - src/game/xp.ts
  - src/routes/combat.ts
  - src/routes/actions.ts
  - src/routes/map.ts
  - src/routes/ranking.ts
  - src/routes/characters.ts
  - src/game/spawn.ts
  - src/routes/admin/bestiary.ts
symbols:
  - 
tests:
  - test/integration/layersCombat.test.ts
  - test/rules.test.ts
---
## Purpose
Lot du 2026-11-27 (migration 46) : deux entités par case (une au sol, une dans les airs), deux portées (mêlée / distance), XP au coup porté, à l'esquive et par entraînement, avatar public du classement.

## Business rules
- Couche : `positions.air` (trigger) = monstre / invocation dont le type vole (locomotion avec 'air', même s'il marche aussi), personnage monté sur une invocation volante. Unicité (carte, x, y, couche) ; un bâtiment occupe les deux couches (`cellTaken`).
- Trajet (`travel`) : seuls les éléments de SA couche et les bâtiments non occupables bloquent ; placements (admin, apparitions, invocations) sur la couche de l'entité ; les copies de monstres (posés / apparus) reprennent `locomotion` et `xp_hit` du type.
- `GET /map/{id}/cell` : `entities` (sol d'abord) et `entity` (celle de `?air=0|1`, sinon la première) ; `/combat/preview/...?air=` et `targetAt(…, air)` choisissent la couche.
- Récolte : refusée à une créature contrôlée (409).
- Portée d'attaque (`attackRange`) : arme de mêlée = sa portée seule (épée 1, lance 2) ; arme à distance (`items.ranged`) = portée du personnage (hauteur, bâtiment, passifs) + arme − 1 ; sans arme : 1 ; créature contrôlée : sa portée. Occupant protégé : attaque « distance » si arme à distance, sinon « mêlée ». `/characters/{id}` expose `weapon` et `attack_range`.
- XP au coup TOUCHÉ (en plus de l'XP d'arme) : joueur → `xp_hit_player` du rang de l'attaquant ; monstre → son `xp_hit` ; invocation → `xp_hit` de son type ; pondérée par l'écart de rang. Esquive d'un joueur : le défenseur gagne `xp_dodge` de son rang.
- Entraînement `POST /characters/{id}/train` : rang avec `train_xp` > 0, personnage (pas une créature), énergie ≥ `train_energy` ; dépense puis gain d'XP (sans pondération).
- Classement : `has_portrait` par ligne ; `GET /ranking/portrait/{pseudo}` (public) renvoie l'image (png/jpeg/webp/gif décodée du data URL), cache 5 min, 404 sinon / joueur bloqué.
- Paramètre d'URL non entier → 400 (`P`).

## Gotchas
- `positions.air` n'est jamais écrit à la main : le trigger le recalcule à chaque INSERT/UPDATE de la ligne (et quand `riding_summon_id` ou `locomotion` change).
- Monter un volant sur une case où un autre volant se tient violerait l'unicité (cas rare, non géré finement).
- Les structures (bâtiments) ne sont pas attaquables : pas d'XP au coup pour elles.

## Tests
`test/integration/layersCombat.test.ts` (couches, récolte, descente, portée, XP joueur / esquive / monstre, entraînement, avatar) ; `test/rules.test.ts` (attackRange).

---
title: Monstres servant de monture (fusion monstres / montures, déplacement combinable)
slug: monster-mounts
status: done
updated: 2026-11-25
files:
  - src/routes/admin/monsters.ts
  - src/game/movement.ts
  - src/routes/admin/core.ts
  - src/routes/admin.ts
symbols:
  - src/game/movement.ts:stepCost
tests:
  - test/integration/monsterMount.test.ts
  - test/rules.test.ts
---
## Purpose
Les montures ne sont plus une section à part : un TYPE de monstre peut servir de monture. Il porte une rareté, un déplacement
combinable (terrestre / aérien / aquatique) et des bonus de monture ; la table `mounts` en est la projection utilisée en jeu.

## Business rules
- Fiche monstre : `rarity` ∈ {commun, rare, epique, legendaire, divin}, `locomotion` = 1 à 3 modes parmi land / air / water (400 sinon), `mountable`, `speed`, `carry`, `bonus_see`, `bonus_range`.
- Un type montable (pas une instance posée) a exactement une ligne `mounts` (`monster_id`), recopiée par le trigger `sync_mount` à chaque création / modification : nom, PV, armure, énergie, force, agilité, récupération, bonus, vitesse, portage, `flying` = air, `aquatic` = water, `terrestrial` = land.
- Décocher « monture » : la ligne `mounts` reste (les montures possédées fonctionnent toujours) mais le type sort du catalogue des montures (`/admin/catalog` → kits de départ, fiches joueurs).
- Supprimer un type possédé comme monture par un joueur → 409 ; sinon sa ligne `mounts` part avec lui (cascade).
- Déplacement en monture : aérienne = 1 partout ; aquatique = 1 sur l'eau (peu profonde et profonde) ; non terrestre = terre ferme interdite ; sinon coût du type de case, eau profonde interdite. Amphibie (terre + eau) = les deux.
- Plus de CRUD `/admin/content/mounts` : il contournerait la projection ; les montures se gèrent dans Monstres.

## Gotchas
- `locomotion` est un `TEXT[]` : la route le convertit en littéral Postgres (`pgArr`), car `safeInsert`/`safeUpdate` transforment les tableaux en JSON.
- `terrestrial` absent (ligne simulée dans un test) = historique `!aquatic` (un aquatique ne quitte pas l'eau).
- Les anciens champs d'attaque spéciale de monture restent en base mais ne sont plus éditables (les sorts liés les remplacent).

## Tests
`test/integration/monsterMount.test.ts` (reprise des montures historiques, validations, projection suivie, catalogue, suppression refusée) ; `test/rules.test.ts` (`stepCost` : combinaisons).

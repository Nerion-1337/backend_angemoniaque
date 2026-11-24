---
title: Passage de rang par conditions (objets, ressources, énergie, définitif / temporaire)
slug: rank-up
status: done
updated: 2026-11-24
files:
  - src/game/rankUp.ts
symbols:
  - src/game/rankUp.ts:rankUp
  - src/game/rankUp.ts:revertTempRanks
  - src/game/rankUp.ts:missingFor
tests:
  - test/integration/rankUp.test.ts
---
## Purpose
Passage au rang suivant par conditions réglées sur chaque rang : objets, ressources, énergie, XP prérequis, quota de population ;
passage définitif ou temporaire, avec consommation ou simple vérification.

## Business rules
- Les conditions d'un rang (`specializations.requirements`) décrivent le passage DEPUIS le rang précédent de la même race ; `{}` = pas de passage par conditions (409).
- Conditions : objets dans le SAC (ni équipés ni au coffre), ressources (id du catalogue), énergie, `prereq_xp` du rang, quota `max_population_percent` ; ce qui manque est listé (409).
- `consume` vrai : objets (lignes empilées décrémentées) et ressources retirés ; faux : seulement exigés. L'énergie est toujours dépensée.
- Le rang appliqué relève les caractéristiques au niveau du rang (jamais à la baisse, `applySpec`).
- Temporaire : caractéristiques d'avant et rang précédent mémorisés (`characters.temp_rank`) ; au tick qui suit l'échéance, ils sont rétablis et les réserves ramenées aux max d'avant.
- Un rang temporaire en cours interdit un nouveau passage (409) ; rang maximal → 409.
- Admin : objets et ressources du kit vérifiés (404) ; `PUT /admin/content/ranks/{id}/requirements` remplace tout.
- Le passage historique par objets divins (`/divine/rank-up`, humains / anges / démons) reste disponible.

## Gotchas
- Le rétablissement dépend du tick horaire (horloge persistante) : jamais avant l'heure pleine suivant l'échéance.
- Les valeurs mémorisées sont injectées dans le SQL via `num()` (forcées en entiers) : garder ce garde-fou.

## Tests
`test/integration/rankUp.test.ts` (validation admin, sans condition 409, conditions manquantes 409, passage définitif avec consommation, passage temporaire sans consommation, double passage refusé, retour au rang précédent).

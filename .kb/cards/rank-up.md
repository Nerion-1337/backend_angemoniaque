---
title: Passage de rang par conditions (voies définitive et temporaire, objets, ressources, énergie)
slug: rank-up
status: done
updated: 2026-11-25
files:
  - src/game/rankUp.ts
  - src/routes/characters.ts
  - src/routes/admin/races.ts
symbols:
  - src/game/rankUp.ts:rankUp
  - src/game/rankUp.ts:revertTempRanks
  - src/game/rankUp.ts:missingFor
tests:
  - test/integration/rankUp.test.ts
---
## Purpose
Passage au rang suivant par conditions réglées sur chaque rang : objets, ressources, énergie, XP prérequis, quota de population ;
deux voies indépendantes (définitive, temporaire), proposables en même temps ; le joueur choisit.

## Business rules
- Les conditions d'un rang (`specializations.requirements`) décrivent le passage DEPUIS le rang précédent de la même race : `{ permanent, temporary }`, chaque voie `null` ou ses conditions ; `{}` ou deux `null` = pas de passage par conditions (409).
- Le joueur choisit la voie (`POST /characters/{id}/rank-up` corps `{ mode }`, défaut `permanent`, corps facultatif) ; voie absente → 409 ; `GET` renvoie `missing` par voie.
- Chaque voie a ses propres objets, ressources, énergie et règle de consommation ; XP prérequis et quota sont communs.
- Conditions : objets dans le SAC (ni équipés ni au coffre), ressources (id du catalogue), énergie, `prereq_xp` du rang, quota `max_population_percent` ; ce qui manque est listé (409).
- `consume` vrai : objets (lignes empilées décrémentées) et ressources retirés ; faux : seulement exigés. L'énergie est toujours dépensée.
- Changement de rang (`divine.ts:applySpec`, montée comme descente) : chaque caractéristique de palier (`SPEC_STATS` : PV max, régénération, vue, force, agilité, énergie, énergie divine) reçoit l'ÉCART entre la base du nouveau rang et celle de l'ancien ; les points achetés sont conservés ; jamais sous 0 ; réserves ramenées sous les maximums. Sans rang d'origine : relevé au niveau du rang.
- Temporaire : rang précédent mémorisé (`characters.temp_rank.stats.specialization_id`) ; au tick qui suit l'échéance, retour à ce rang par `applySpec` (même règle qu'une descente : les points achetés pendant le rang temporaire restent).
- Un rang temporaire en cours interdit un nouveau passage (409) ; rang maximal → 409.
- Admin : objets et ressources des deux voies vérifiés (404) ; `PUT /admin/content/ranks/{id}/requirements` remplace tout ; l'ancien format `{ mode, … }` est refusé (400, schéma strict) — la migration 24 a converti les données existantes.
- Le passage historique par objets divins (`/divine/rank-up`, humains / anges / démons) reste disponible.

## Gotchas
- Le rétablissement dépend du tick horaire (horloge persistante) : jamais avant l'heure pleine suivant l'échéance.
- Les colonnes de `applySpec` viennent d'une liste fixe (`SPEC_STATS`, `keep` filtré dessus) : ne jamais y injecter un nom venu de la requête.

## Tests
`test/integration/rankUp.test.ts` (validation admin, ancien format 400, deux voies à la fois, voie absente 409, sans condition 409, conditions manquantes 409, passage définitif avec consommation, passage temporaire sans consommation, double passage refusé, retour au rang précédent, changement de rang admin à la hausse / baisse avec points achetés conservés et saisie prioritaire).

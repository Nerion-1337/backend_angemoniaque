---
title: Secteurs de ressources (parts %, type de case, stock) et conditions de récolte (objets / sort)
slug: deposits
status: done
updated: 2026-11-25
files:
  - src/game/deposits.ts
  - src/routes/admin/deposits.ts
  - src/routes/actions.ts
  - src/game/harvest.ts
  - src/routes/map.ts
symbols:
  - src/game/deposits.ts:depositAt
  - src/game/deposits.ts:pickShare
  - src/game/deposits.ts:cellRoll
  - src/game/deposits.ts:shareTotals
  - src/game/deposits.ts:takeFromDeposit
  - src/game/deposits.ts:regenDeposits
  - src/game/harvest.ts:checkHarvest
  - src/game/harvest.ts:harvestNeeds
tests:
  - test/deposits.test.ts
  - test/integration/deposits.test.ts
---
## Purpose
Secteurs de ressources placés en admin : une zone d'un monde qui contient une ou plusieurs ressources du catalogue, chacune avec sa
part de cases, un type de case éventuel et son propre stock (vidé à la récolte, régénéré chaque heure).

## Business rules
- Secteur = rectangle dans les bornes du monde (400 sinon), nom, actif ; au moins une ressource, chacune du catalogue (404 sinon), sans doublon (400).
- Chaque ressource : part des cases `percent` (1–100), type de case `kind` optionnel (ex. bois → forest), stock / maximum, régénération par heure, quantité par récolte.
- Somme des parts ≤ 100 % POUR CHAQUE type de case (une ressource sans type compte sur tous) ; sinon 400 « Parts supérieures à 100 % : forêt 110 % ».
- Une seule ressource par case : `pickShare` tire 0..99 (`cellRoll`, hash entier de la case et de l'id du secteur) et parcourt dans l'ordre les ressources admises sur le type de la case ; au-delà de la somme, la case garde la ressource naturelle du terrain.
- Plusieurs secteurs sur une case : du plus PETIT au plus grand (puis le plus récent) ; le premier qui attribue une ressource l'emporte.
- Récolte sur une case de secteur : ressource et stock de CETTE ressource du secteur ; quantité = `yield_per_harvest` bornée par le stock ; verrou de ligne pendant la transaction.
- Stock vide → 409 « Gisement épuisé » AVANT tout trajet ; une case sans ressource de terrain devient récoltable si un secteur lui en donne une.
- La règle de l'eau profonde (à pied → rien à récolter) s'applique aussi aux secteurs. Hors secteur, la récolte du terrain est inchangée (+1, illimitée).
- Tick horaire : `stock = min(stock_max, stock + regen_per_h)` pour les ressources des secteurs actifs.
- `/map/{id}/cell` expose `deposit` (secteur, ressource, stock, maximum, régénération, quantité par récolte).
- PUT remplace toutes les ressources du secteur (stock envoyé, sinon plein).
- Conditions de récolte par ressource du catalogue (`game/harvest.ts`, table `resource_rules`) : groupes alternatifs au format de l'activation des bâtiments (objets, sort, ressources, or, rang, `consume`) ; valent sur le terrain naturel ET dans les secteurs ; sans groupe = libre.
- Récolte : `checkHarvest` AVANT tout trajet ; les objets ÉQUIPÉS comptent (outil en main) et peuvent être consommés ; refus 403 « Récolte de X impossible — option 1 : … ; option 2 : … ».
- `/map/{id}/cell` expose `harvestNeeds` (texte des conditions de la ressource effective de la case, null si libre) ; admin GET/PUT `/admin/content/resource-rules[/{resource}]` (ressource / objet / sort inconnus → 404 ; `groups: []` supprime la règle ; `needs` = texte).
- Admin : `GET/PUT /admin/content/map-upgrade` = prix de l'amélioration de carte vendue à l'Hôtel de ville.
- `PUT /admin/content/resource-stack/{resource}` : quantité par emplacement (1–100000) ; une ligne `resource_rules` peut n'avoir aucune condition (groups []) — vider les conditions ne supprime plus la ligne.

## Gotchas
- `cellRoll` / `pickShare` / `shareTotals` ont un miroir front (`admin/deposits.js`) : valeurs figées dans les deux tests ; modifier les deux côtés.
- Le tirage dépend de l'id du secteur : recréer un secteur change la répartition des cases (l'aperçu admin d'un nouveau secteur est indicatif).
- Le stock est commun à toutes les cases de la ressource dans le secteur.
- Le rendu 3D du jeu dessine la flore du terrain naturel, pas la ressource du secteur (seule la carte de case l'affiche).

## Tests
`test/deposits.test.ts` (tirage figé et uniforme, parts, type de case, reste naturel, totaux) ; `test/integration/deposits.test.ts` (validations dont doublon et > 100 % par type, récoltes ×2 ×2 ×1, épuisement 409, case, régénération, secteur 60/40 : une ressource par case, stock propre).

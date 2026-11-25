---
title: Boutique par race et parchemins de fabrication (objet, sort, bâtiment)
slug: craft-shop
status: done
updated: 2026-11-25
files:
  - src/routes/craft.ts
  - src/routes/admin/recipes.ts
  - src/routes/market.ts
  - src/game/bag.ts
symbols:
  - src/routes/craft.ts:missing
  - src/routes/admin/recipes.ts:recipeRoutes
  - src/game/bag.ts:bagState
  - src/game/bag.ts:bagRoom
  - src/game/bag.ts:resStacks
  - src/routes/market.ts:chestLimits
tests:
  - test/integration/craftShop.test.ts
  - test/integration/equipMap.test.ts
  - test/integration/bagResources.test.ts
  - test/integration/heightVision.test.ts
---
## Purpose
Boutique de l'hôtel de ville filtrée par race (objets et sorts) et fabrication par parchemin : un parchemin dans le sac + les
ressources de sa recette donnent un objet, un sort appris ou un bâtiment (copie d'un modèle).

## Business rules
- Un objet ou un sort est en boutique si `shop` ; `shop_races` limite aux races listées ([] = toutes). Hors boutique, il ne s'obtient qu'en jeu ou par fabrication.
- `GET /shop?characterId=` ne liste que ce que la race du personnage peut acheter ; acheter ou apprendre hors de sa race → 404.
- Les sorts sont en boutique par défaut (comportement historique).
- Une recette par parchemin (409 sinon) ; cible = objet, sort ou bâtiment existant (404) ; ressources du catalogue (404 sinon) ; quantité produite > 1 seulement pour un objet.
- Le parchemin doit être dans le SAC (403 sinon) ; recette « à l'hôtel de ville » → à 2 cases au plus de sa capitale (409) ; ressources insuffisantes → 409 avec la liste manquante.
- Ordre : contrôles, énergie (payée par le personnage), ressources retirées, parchemin retiré s'il est consommé, puis résultat ; tout dans une transaction (un refus final annule tout).
- Objet : ajouté au sac (empilé), sac plein → 409. Sort : appris (déjà connu → 409, parchemin conservé). Bâtiment : copie complète du modèle (caractéristiques et sorts liés, `copyBuilding`), appartenant au joueur, sur une case ADJACENTE libre, jamais eau ni lave (400 sans case, 409 sinon).
- Un nouveau parchemin créé depuis l'admin est un objet `slot = scroll`, hors boutique.
- Amélioration de carte (`POST /shop/map-upgrade`, à la capitale) : prix `game_config.map_upgrade_price` (défaut 500, réglé en admin Ressources), 409 si déjà acquise ou or insuffisant ; `characters.map_upgrade` ; `GET /shop` renvoie `mapUpgrade.price`.
- Sac et coffre (`game/bag.ts`, migration 33) : les ressources (`characters.resources` = sac, `chest_resources` = coffre) occupent des emplacements par piles de `stack_max` (défaut 20) ; place libre du sac = `bag_size` − (objets non équipés hors coffre + piles) ; tout ajout d'objet au sac passe par `bagRoom` (achat, retrait du coffre, fabrication, déséquipement de monture, invocation d'objet).
- `POST /chest/resource` (à la capitale) : déplace une ressource (tout ou `qty`) sac ⇄ coffre, place vérifiée en piles côté destination (409 « Coffre plein » / « Sac plein ») ; `GET /chest` renvoie `used` et les piles `resources`.
- Coffre réglé par capitale (`chestLimits`, buildings.data.chestStart / chestMax ; défaut 10 / sans limite) : taille de départ donnée à la création du personnage ; `/chest/expand` refusé (409) à la capacité maximale ; `GET /chest` renvoie `max`.

## Gotchas
- Les anciens parchemins de construction (`data.kind` wall/tower/factory/totem/ship) gardent leur propre route `/buildings/place`.
- Un test qui crée un sort doit le supprimer (`features.test.ts` compte les sorts de la boutique) ; garder des prix élevés et un stock > 0 pour un objet de test en boutique.

## Tests
`test/integration/craftShop.test.ts` (boutique réservée aux anges, sort hors boutique, achat refusé ; objet fabriqué ×2 avec ressources/énergie/parchemin consommés ; sort à l'hôtel de ville avec parchemin conservé ; bâtiment sur case adjacente).

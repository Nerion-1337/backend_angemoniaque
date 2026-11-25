---
title: Boutique par race et parchemins de fabrication (objet, sort, bâtiment)
slug: craft-shop
status: done
updated: 2026-11-25
files:
  - src/routes/craft.ts
  - src/routes/admin/recipes.ts
  - src/routes/market.ts
symbols:
  - src/routes/craft.ts:missing
  - src/routes/admin/recipes.ts:recipeRoutes
tests:
  - test/integration/craftShop.test.ts
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

## Gotchas
- Les anciens parchemins de construction (`data.kind` wall/tower/factory/totem/ship) gardent leur propre route `/buildings/place`.
- Un test qui crée un sort doit le supprimer (`features.test.ts` compte les sorts de la boutique) ; garder des prix élevés et un stock > 0 pour un objet de test en boutique.

## Tests
`test/integration/craftShop.test.ts` (boutique réservée aux anges, sort hors boutique, achat refusé ; objet fabriqué ×2 avec ressources/énergie/parchemin consommés ; sort à l'hôtel de ville avec parchemin conservé ; bâtiment sur case adjacente).

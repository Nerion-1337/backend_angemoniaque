---
title: Coût en énergie divine réglable (sorts, recettes, cases, passage de rang)
slug: divine-energy-cost
status: done
updated: 2026-11-26
files:
  - src/game/movement.ts
  - src/routes/spells.ts
  - src/routes/craft.ts
  - src/game/rankUp.ts
  - src/routes/admin/tiles.ts
  - src/routes/admin/recipes.ts
  - src/routes/admin/monsterDetails.ts
  - src/game/tileTypes.ts
symbols:
  - src/game/movement.ts:spendDivine
  - src/game/movement.ts:travel
tests:
  - test/integration/divineCost.test.ts
---
## Purpose
Tout ce qui consomme de l'énergie et se règle dans l'admin peut aussi exiger de l'énergie divine : sorts (dont capacités de monstre), recettes de parchemin, déplacement par type de case, chaque voie du passage de rang. 0 par défaut : aucune action n'en exige tant que l'admin ne le fixe pas.

## Business rules
- Colonnes `divine_energy_cost` (spells, recipes, tile_types ; migration 42), entier ≥ 0, défaut 0 ; passage de rang : `divineEnergyCost` dans chaque voie de `specializations.requirements` (défaut 0).
- L'énergie divine est TOUJOURS payée par le personnage (`spendDivine`), jamais par la monture ni l'invocation contrôlée, même quand c'est elles qui paient l'énergie.
- Insuffisante → 409 « Énergie divine insuffisante (N requise) » ; tout est dans la transaction : un sort, une fabrication ou un trajet refusé ensuite ne débite rien.
- Sort : débitée dès que le sort est trouvé, avant ses contrôles (annulée avec la transaction s'ils échouent).
- Cases : somme des coûts divins des cases traversées (`travel`), débitée avant l'énergie du trajet ; carte de case du jeu : `tile.divineCost`.
- Passage de rang : listée dans `missing` (« énergie divine N ») et toujours débitée comme l'énergie, consommation ou non des objets.
- Les coûts fixes du code (attaque, construction, souffle de monture) n'ont pas de version divine (non réglés en admin).

## Gotchas
- `spendDivine` lit `ch.divine_energy_current` : le personnage passé doit venir d'un `SELECT *` (ownChar).
- Un personnage sans énergie divine (max 0, race/rang non divin) ne peut simplement pas payer : pas de contrôle de rang séparé.

## Tests
`test/integration/divineCost.test.ts` (sort : 0 par défaut, refus puis débit, remise à 0 ; passage de rang exigé puis débité ; cases et recettes exposent 0).

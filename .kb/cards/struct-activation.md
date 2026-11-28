---
title: Activation générique des structures (objet, objet divin, sort, or, XP ; durée ou définitif), XP totale, structures invisibles, fin de la zone sacrée, catégories de l'Hôtel de ville
slug: struct-activation
status: done
updated: 2026-11-28
files:
  - src/game/structActivation.ts
  - src/routes/buildings.ts
  - src/routes/divine.ts
  - src/routes/map.ts
  - src/game/spellTick.ts
  - src/game/divine.ts
  - src/game/bag.ts
  - src/routes/market.ts
  - src/routes/inventory.ts
  - src/routes/admin/buildings.ts
symbols:
  - src/game/structActivation.ts:activateWith
  - src/game/structActivation.ts:missing
  - src/game/structActivation.ts:openUntil
  - src/game/bag.ts:ITEM_CAT
tests:
  - test/integration/structActivation.test.ts
  - test/integration/gates.test.ts
---
## Purpose
Lot du 2026-11-28, suite (migration 49) : toute structure s'active par des éléments réglés en admin, chacun avec sa durée.

## Business rules
- `buildings.activations` : alternatives { kind item | divine | spell | gold | xp, ref, qty, hours (NULL = définitif), consume }. Objet : consommé (sac) ou possédé (sac + équipés) ; objet divin : rendu ou détenu ; sort : connu ; or : toujours payé ; XP consommée = XP libre retirée, XP possédée = XP TOTALE accumulée (dépensée comprise), rien retiré.
- `POST /buildings/{id}/activate { element, times }` (case adjacente) : un élément consommé à durée limitée se paie 1 à 100 fois (durée × times), sinon une fois (400) ; ce qui manque → 403 ; fin = max(maintenant, fin actuelle) + durée ; définitif → `open_until = 'infinity'`, plus d'activation possible. Porte des mondes : seulement un joueur de son monde (403). Conditions supplémentaires (`activation`, lot E) exigées en plus ; sans élément, elles activent seules (comportement historique). Puis sorts « à activer ».
- `GET /buildings/{id}/state/{characterId}` : actif, définitif, éléments (libellé, ce qui manque, max_times), conditions ; porte : portes en face, franchissable. `/buildings/{id}/interact` renvoie `activable`.
- Structure à activer : ses sorts passifs (chaque heure) ne valent que pendant l'activation.
- Portes des mondes reprises par la migration : 1 objet divin de leur famille, consommé, 24 h par objet (ancien `open_h_per_item`, plus utilisé).
- XP totale (`characters.xp_total`, trigger) : toute hausse d'XP s'y ajoute ; dépenser ne la baisse pas ; seule la mort en retire la perte.
- `buildings.visible = false` : absente de `/map/area`, `/map/cell`, `/map/landmarks` ; sa zone de paix compte toujours (`/map/{id}/zones`, nom masqué).
- Zone sacrée codée en dur retirée : seules les zones de paix des structures bloquent les combats ; `/map/cell` renvoie `peace` (nom de la structure ou null).
- Hôtel de ville : chaque article (boutique objets + sorts, marché, coffre, sac) a une catégorie `cat` : structure, invocation, sort, ressource, objet (`ITEM_CAT`, `SPELL_CAT`) ; marché et coffre renvoient la rareté.

## Gotchas
- `open_until = 'infinity'` : toujours lire avec `CASE WHEN open_until='infinity'` (EXTRACT donnerait l'infini) ; côté portes, `FOREVER` (an 275760).
- L'XP totale des personnages d'avant la migration part de leur XP libre (l'XP déjà dépensée n'est pas connue).

## Tests
`test/integration/structActivation.test.ts` (références admin, plusieurs éléments et durées, or payé N fois, objet possédé / consommé, sort, définitif, XP libre / totale, sorts passifs, invisibilité, zones) ; `gates.test.ts` (portes, XP totale à la mort).

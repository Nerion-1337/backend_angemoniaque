---
title: Caractéristiques offertes par les objets ; armure magique partout
slug: item-stats
status: done
updated: 2026-11-25
files:
  - src/game/stats.ts
  - src/game/combatlib.ts
  - src/game/spellEffects.ts
  - src/routes/admin/items.ts
  - src/routes/inventory.ts
symbols:
  - src/game/stats.ts:gearStats
  - src/game/combatlib.ts:loadTarget
tests:
  - test/integration/itemStats.test.ts
---
## Purpose
Un objet porté peut offrir ou retirer chacune des caractéristiques du joueur ; l'armure magique réduit les dégâts de sort
pour toutes les cibles (personnages, monstres, invocations), y compris les dégâts sur la durée.

## Business rules
- Force, agilité, armure, armure magique : comptées à la volée (`gearStats`) = base du personnage (`characters.armor`, `characters.magic_armor`, que les sorts peuvent modifier) + colonnes des objets portés.
- PV max, régénération, énergie max, énergie divine max, vue, portée : `items.bonuses` (entiers, négatif = malus ; clé inconnue → 400), reportés sur la fiche à l'équipement par le trigger SQL (migration 26) et retirés exactement au déséquipement ou à la disparition de l'objet porté.
- Personnage visé : armure et armure magique + bonus de l'occupant d'un bâtiment (`bonus_armor`, `bonus_magic_armor`).
- Monstre visé : ses armures + celles des objets qu'il porte (`monster_equips`).
- Sort direct : dégâts − armure magique (minimum 1). Dégâts sur la durée : réduits de la même façon au lancer (minimum 1 / h).
- Les sorts peuvent modifier `magic_armor` comme les autres caractéristiques (liste `CAPS`).
- L'inventaire renvoie `bonuses` pour l'affichage en jeu ; fiche joueur admin : `magic_armor` éditable.

## Gotchas
- Ne jamais additionner `items.bonuses` dans `gearStats` : ces valeurs sont DÉJÀ sur la fiche (double comptage).
- Un passage de rang relève les caractéristiques au niveau du rang en comptant les bonus portés (`GREATEST`) : au retrait de l'objet, le bonus est soustrait du nouveau total.
- PV max jamais sous 1 et autres valeurs jamais sous 0 au report : un malus extrême n'est pas rendu à l'identique.

## Tests
`test/integration/itemStats.test.ts` (validation, report / retrait exact malgré une modification de l'objet, retrait par l'admin, armures personnage et monstre).

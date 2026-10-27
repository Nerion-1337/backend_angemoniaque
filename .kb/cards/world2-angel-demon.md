---
title: Monde Anges & Démons (carte 2, 300x300) : zones, ressources, logique partagée
slug: world2-angel-demon
status: done
updated: 2026-10-21
files:
  - src/game/world2.ts
  - src/game/resources2.ts
  - src/game/angelDemonMap.ts
  - src/game/terrain.ts
  - test/world2.test.ts
symbols:
  - src/game/world2.ts:terrain2
  - src/game/world2.ts:noise2
  - src/game/world2.ts:waterTint
  - src/game/resources2.ts:ZONES2
tests:
  - test/world2.test.ts
---
## Purpose
La carte 2 est une grille de **zones** 300x300 : démons à l'ouest, anges à l'est, bande neutre du Voile au centre. Chaque zone fixe le type de case, la couleur de sol, l'apparence 3D ET la liste des ressources récoltables : le sol affiché et la récolte ne peuvent pas diverger.

## How it works
- `angelDemonMap.ts` (généré) : lignes RLE d'une lettre de zone par case + `FEATURES2` (capitales, portes, arrivées des 4 portails humains, monstres). `resources2.ts` (généré) : `ZONES2` (type, sol, roche, herbe, arbre isolé, ressources avec poids %), `RESOURCES2` (37, avec `look` 3D), `RES2_BY_ID`, `SIDES`.
- `world2.ts` : `terrain2(x,y)` renvoie l'objet figé de la case ; la ressource est tirée dans la zone avec un hash **entier** (`Math.imul`) : poids < 20 % = rare, semé case par case ; sinon taches irrégulières d'environ 4 cases. `noise2` = élévation interpolée (la lave est en contrebas : cratères et rivières). `waterTint(mapId, x)` : eau sombre côté démons, claire côté anges.
- `terrain.ts` délègue : `noiseAt`/`terrain` appellent `noise2`/`terrain2` pour `mapId === 2` (3 lignes, **à reporter dans le gabarit de `tools/gen_human_map.py`** : `terrain.ts` est un fichier généré). Les objets de case ont en plus `zone`, `zoneId`, `ground`, `rock`, `grass`, `lone`, `flat`.
- La lave (`champs_lave`, type `volcano`) brûle 10/h comme le volcan des Hommes (`ignite` dans `movement.ts`, inchangé) et n'existe que côté démons ; des « ponts de basalte » garantissent un chemin sans lave entre capitale, portes et frontière.

## Entry points
`terrain(x, y, 2)` / `noiseAt(x, y, 2)` ; `/map/2/cell` renvoie `zone` ; positions des bâtiments et monstres : infra `09_world2.sql`.

## Tests
`test/world2.test.ts` : coût/brûlure identiques à `terrain.ts` ; ressource ∈ zone ∈ groupe du type de case ; `look` obligatoire sauf eaux profondes, type de look ↔ type de sol ; toutes zones/ressources présentes ; camps par moitié ; lave seulement côté démons ; rares ≈ poids ; capitales dégagées ; accessibilité sans lave ; eau teintée ; déterminisme.

## Gotchas
- Le monde 2 n'est plus procédural : les tests « terrain procédural » de `rules.test.ts` utilisent la carte 3.
- Ne pas utiliser `Math.sin` pour choisir une ressource (résultats différents selon les moteurs) : serveur et clients doivent voir la même case.
- Changer un poids ou une zone dans `tools/catalogue2.py` impose de régénérer (`gen_angel_demon_map.py`) : le sol 3D, la légende et la récolte suivent seuls.
- Base existante : `maps.width/height` de la carte 2 passent à 300 et les positions changent (`make dev-reset`).

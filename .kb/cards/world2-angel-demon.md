---
title: Monde Anges & Démons (carte 2, 300x300) : zones, ressources, logique partagée
slug: world2-angel-demon
status: done
updated: 2026-11-24
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
Monde 2 (Anges & Démons) : grille de zones 300×300 — démons à l'ouest, anges à l'est, bande neutre du Voile au centre.
Chaque zone fixe le type de case, l'apparence 3D et les ressources récoltables : le sol affiché et la récolte ne divergent jamais.

## Business rules
- La ressource d'une case est tirée dans les ressources de SA zone, avec un hash ENTIER (même résultat serveur et navigateurs) ; poids < 20 % = rare, semé case par case ; sinon taches d'environ 4 cases.
- La ressource appartient au groupe du type de case de la zone.
- La lave (zone `champs_lave`, type volcano) n'existe que côté démons et brûle comme le volcan des Hommes (10 PV/h, jamais mortel).
- Un chemin sans lave relie toujours capitale, portes et frontière (ponts de basalte).
- Eau sombre côté démons, claire côté anges.
- Les coûts et la brûlure sont identiques à ceux de `terrain.ts` (surchargés par l'admin « Cases » pour ce monde).

## Gotchas
- Fichiers générés (`angelDemonMap.ts`, `resources2.ts`, `world2.ts`) : modifier `tools/catalogue2.py` puis régénérer (`gen_angel_demon_map.py`).
- `terrain.ts` est aussi généré : la délégation au monde 2 se reporte dans le gabarit de `tools/gen_human_map.py`.
- Jamais `Math.sin` pour choisir une ressource.
- Les tests « terrain procédural » utilisent la carte 3 (le monde 2 n'est plus procédural).
- Base existante : la carte 2 passe à 300×300 et les positions changent (`make dev-reset`).

## Tests
`test/world2.test.ts` (coûts/brûlure, ressource ∈ zone ∈ groupe, `look` 3D, zones/ressources présentes, camps, lave côté démons, rares ≈ poids, capitales dégagées, chemin sans lave, eau teintée, déterminisme).

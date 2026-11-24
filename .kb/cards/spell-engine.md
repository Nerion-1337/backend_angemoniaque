---
title: Moteur de sorts paramétrable (zone, cible, dégâts, durée, caractéristiques) et liens sort ↔ objet / monture / monstre
slug: spell-engine
status: done
updated: 2026-11-24
files:
  - src/game/spellEffects.ts
  - src/game/spellTick.ts
  - src/routes/spells.ts
symbols:
  - src/game/spellEffects.ts:applyEffects
  - src/game/spellEffects.ts:pickTargets
  - src/game/spellTick.ts:hourlySpellEffects
tests:
  - test/spellEffects.test.ts
  - test/integration/spellEngine.test.ts
---
## Purpose
Moteur de sorts paramétrable (`spells.effects`) : cible, portée, zone, camp visé, dégâts instantanés, soin, dégâts sur la durée,
modifications de caractéristiques ; et liens d'un sort avec des objets, montures (et monstres) qui le rendent lançable ou passif.

## Business rules
- `effects = {}` → comportement historique selon `kind` (summon, summon_cap, buff, attack) ; sinon le moteur s'applique.
- Cible : `self` (lanceur), `single` (entité de la case visée), `area` (toutes les entités à `radius` de la case visée) ; la case visée doit être à `range` cases au plus du lanceur (409).
- Camp : alliés = même race que le lanceur + ses invocations ; ennemis = le reste (monstres compris) ; `all` = tous. Aucune cible valable → 409.
- Effet hostile (dégâts, dégâts sur la durée, caractéristique négative) sur un autre personnage : refusé si le lanceur ou la cible est en zone sacrée (403).
- Coût : `energy_cost` payé après les contrôles.
- Dégâts instantanés réduits par l'armure magique, peuvent tuer ; soin borné au PV max.
- Dégâts sur la durée : n PV par heure au tick pendant `hours`, jamais mortels (PV min 1).
- Réserves (`hp`, `energy`, `divine_energy`) : valeur actuelle rendue ou retirée, bornée à [0 (1 pour hp), max].
- Capacités (`*_max`, force, agilité, armure, vue, portée, récupération) : modifiées pour `durationH` heures (0 = permanent), puis rétablies au tick ; une capacité qui baisse ramène la réserve au nouveau max. Seuls les personnages ont des capacités modifiables.
- Sorts lançables = appris ∪ liés en ACTIF à un objet ÉQUIPÉ ∪ liés en ACTIF à la monture ACTIVE ; la liste indique la provenance.
- Sort lié en PASSIF à un objet équipé ou à la monture active : ses effets instantanés sur soi (soin, réserves ±) s'appliquent une fois par heure ; capacités et dégâts ignorés.
- Liens admin : monstre (table `monster_spells`), objet, monture, bâtiment (`entity_spells`) ; doublon → 409 ; élément ou sort inconnu → 404.

## Gotchas
- Les monstres et invocations ne reçoivent que dégâts, soin, dégâts sur la durée et PV.
- Le rétablissement des capacités temporaires se fait au tick (horloge persistante) : jamais avant l'heure pleine suivante.
- Un test qui crée un sort doit le supprimer (comptage des sorts de la boutique par `features.test.ts`).

## Tests
`test/spellEffects.test.ts` (défauts, hostilité, camps, réserves bornées, ciblage soi / unique / zone) ; `test/integration/spellEngine.test.ts` (zone alliée soin + énergie bornée, hors portée, capacité temporaire rétablie, dégâts + durée jamais mortels, zone sacrée, sort par objet équipé, passif de monture, admin des liens).

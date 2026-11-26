---
title: Realtime combat events: broadcast combat outcomes to map spectators
slug: combat-realtime
status: done
updated: 2026-11-26
files:
  - src/game/reach.ts
  - src/lib/events.ts
  - src/routes/combat.ts
  - src/routes/spells.ts
symbols:
  - src/lib/events.ts:combatEvent
  - src/routes/combat.ts:combat
  - src/routes/spells.ts:spells
tests:
  - test/integration/reach.test.ts
  - test/reach.test.ts
  - test/combat-event.test.ts
  - test/integration/combat-realtime.test.ts
---
## Purpose
Rend chaque combat visible en temps réel aux autres joueurs de la carte : toute attaque résolue (directe ou sort d'attaque)
publie un événement `combat` public sur le canal Redis de la carte, et les clients rafraîchissent la zone aussitôt.

## Business rules
- Forme unique de l'événement : `combatEvent(target, killed, missed)` → `{type:'combat', target, killed, missed}` (`lib/events.ts`) ; jamais de littéral ailleurs.
- Une attaque ratée publie AUSSI l'événement (`missed: true`).
- L'événement ne contient jamais de PV exacts, d'or ni de statistique privée (même règle que `pub()` de `map.ts`).
- Zone sacrée : aucun combat joueur contre joueur si l'attaquant OU la cible est dans la zone (403 « Zone sacrée… ») ; les monstres restent attaquables.
- La mort d'un personnage n'est pas une suppression : `die()` l'envoie au Monde des Morts (carte 3) avec ses PV restaurés.
- Rien n'est persisté : Redis pub/sub seulement.
- Un sort du moteur publie un événement `combat` par cible touchée (card `spell-engine`).
- Un personnage sur un bâtiment occupable peut être protégé contre le corps à corps, la distance ou les sorts (403, card `buildings-occupy`).
- Coup porté par le héros (pas l'invocation contrôlée) : XP = somme des `xp_use` de ses armes équipées, pondérée par l'écart de rang avec la cible (`game/xp.ts`, card `monster-details`) ; la réponse renvoie `xp`.
- Portée d'attaque (migration 36, `game/reach.ts`) : portée de l'acteur (caractéristique + hauteur + bâtiment) + (portée de l'arme la plus longue − 1) ; sans arme ou invocation contrôlée : portée de l'acteur.
- Distance à la cible = Pythagore (distance au sol, écart de hauteur au-dessus du sol : à pied 0, invocation montée terrestre / aquatique = sa taille, volant = 6) ; le relief n'y entre pas. Cavalier (hauteur 1) collé : hors de portée 1, à portée 2.
- Trop loin : le héros s'approche jusqu'à la distance au sol permise (`groundReach`) ; cible inatteignable même collée (portée < √(1 + écart²)) → 409 « hors d'atteinte ».
- Arme à grande portée (migration 37, `powerAt`) : `power_start` % à la case 1 → 100 % à la case `full_power_at` (≤ portée) → `power_end` % à la dernière case de portée, linéaire sur la distance 3D ; sans case de pleine puissance : 100 % partout. Dégâts de toute attaque à l'arme arrondis au supérieur (`powered`). L'aperçu renvoie la puissance arrondie.

## Gotchas
- Supprimer la diffusion du raté réintroduit 8 s de retard chez les spectateurs (rafraîchissement par sondage).
- Les tests filtrent par `target` : d'autres suites publient sur les mêmes cartes en parallèle.

## Tests
`test/combat-event.test.ts` (forme exacte, clés fermées) ; `test/integration/combat-realtime.test.ts` (abonné Redis brut, événement reçu < 10 s, cohérent avec la réponse HTTP).

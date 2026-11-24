---
title: Realtime combat events: broadcast combat outcomes to map spectators
slug: combat-realtime
status: done
updated: 2026-11-24
files:
  - src/lib/events.ts
  - src/routes/combat.ts
  - src/routes/spells.ts
symbols:
  - src/lib/events.ts:combatEvent
  - src/routes/combat.ts:combat
  - src/routes/spells.ts:spells
tests:
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

## Gotchas
- Supprimer la diffusion du raté réintroduit 8 s de retard chez les spectateurs (rafraîchissement par sondage).
- Les tests filtrent par `target` : d'autres suites publient sur les mêmes cartes en parallèle.

## Tests
`test/combat-event.test.ts` (forme exacte, clés fermées) ; `test/integration/combat-realtime.test.ts` (abonné Redis brut, événement reçu < 10 s, cohérent avec la réponse HTTP).

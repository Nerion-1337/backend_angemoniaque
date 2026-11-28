---
title: Portes des mondes (activation par objets divins, franchissement, alliances), zones des structures, reconstruction, mort, pactes des demi-dieux
slug: gates-structures
status: done
updated: 2026-11-28
files:
  - src/game/gates.ts
  - src/routes/divine.ts
  - src/game/divine.ts
  - src/game/spawn.ts
  - src/game/combatlib.ts
  - src/routes/combat.ts
  - src/routes/spells.ts
  - src/game/spellTick.ts
  - src/routes/buildings.ts
  - src/game/spellSummon.ts
  - src/routes/tick.ts
  - src/routes/pacts.ts
  - src/routes/admin/buildings.ts
  - src/routes/admin/faithPact.ts
  - src/game/faithPact.ts
symbols:
  - src/game/gates.ts:realmStatus
  - src/game/gates.ts:syncGates
  - src/game/gates.ts:checkPeace
  - src/game/gates.ts:checkPactRealm
  - src/game/spawn.ts:respawnStructures
  - src/game/divine.ts:deathLoss
  - src/game/faithPact.ts:expireBuffs
tests:
  - test/integration/gates.test.ts
  - test/gatesRules.test.ts
---
## Purpose
Lot du 2026-11-28 (migration 48) : portes des mondes, zones autour des structures, reconstruction des structures, perte à la mort, Royaume des Morts agrandi, pactes des demi-dieux.

## Business rules
- Porte : `realm` (human / demon / angel / dead) et `leads_to`. Portes en face = realm ↔ leads_to inversés (Seuil des Deux Voiles et Porte des Dunes → Démons ; Portail de Givre et Passage des Marais → Anges ; Brèche de Soufre et Arche de Grâce → Hommes).
- Activation (`POST /divine/door/{id}/activate`, case adjacente) : seul un joueur de la race du monde de la porte ; rend N objets divins de sa famille (Homme artefact, Démon arcane, Ange relique) ; `open_until` = max(maintenant, fin actuelle) + N × `open_h_per_item` h.
- Franchir (`POST /divine/door`) : il faut une porte EN FACE ouverte ; activer sa propre porte ne permet donc pas de la franchir, elle laisse venir l'autre monde. Porte des Hommes → arrivée fixe `data.to` ; porte des Démons / Anges → près d'une porte des Hommes ouverte ; plusieurs ouvertes sans `toBuildingId` → `{ ok: false, choose }`, le joueur choisit. Conditions admin (`activation`) en plus.
- Porte des Âmes (realm dead, centre du Royaume des Morts) : toujours franchissable, vers la zone d'apparition de la race. Porte sans monde (realm NULL) : comportement historique (conditions ou objet `data.requires`, arrivée `data.to`).
- Porte détruite = sans position. Camp Démon / Ange : pactes suspendus si sa porte est détruite ou si TOUTES les portes des Hommes vers lui le sont (activation refusée 409, pas de gain horaire, bonus en cours retirés aussitôt). Demi-dieux : pactes valides seulement si TOUTES les portes realm human sont détruites.
- Alliance : porte du camp ET une porte des Hommes vers lui ouvertes → bonus `gate_bonus[camp]` (règles générales) aux joueurs du camp et aux Humains en pacte actif avec eux (temp_buffs `gate:<camp>`) jusqu'à la première fermeture ; recalculé par `syncGates` (activation, destruction, reconstruction, tick, réglage admin).
- Zone de paix (`peace_radius`, Chebyshev) : aucune attaque si l'attaquant OU la cible y est (combat, sorts, sorts de tick, monstres contrôlés) ; la structure elle-même reste attaquable depuis l'extérieur de sa zone. Zone sans construction (`nobuild_radius`) : `/buildings/place` et structures invoquées refusées (403).
- Structure détruite : `destroyed_at`, `home` (dernière case) ; reconstruite au tick si `respawn`, délai `respawn_delay_h` écoulé et conditions `respawn_limits` levées (mêmes règles que les monstres), sur sa case si libre.
- Mort : perte de `death_loss_pct` % (défaut 25) de l'XP non dépensée et de l'or porté, arrondi à l'inférieur ; arrivée autour du centre du Royaume des Morts (150 × 150).
- Demi-dieu : Humain dont le rang a `pact_patron` ; propose un pacte à un Humain de palier inférieur, tient le rôle `ethereal_id`, compositions `pact_tiers.realm = 'demigod'` ; limite par défaut comme un Ange de son palier.

## Gotchas
- Les portes sont un état global : les tests de destruction / alliance tournent dans une transaction annulée.
- `combatlib` importe `gates` dynamiquement (cycle spellEffects ↔ combatlib).
- Un camp sans aucune porte enregistrée n'est jamais suspendu.

## Tests
`test/integration/gates.test.ts` (activation, porte fermée, choix d'arrivée, porte des Âmes, perte à la mort, zone de paix, zone sans construction, reconstruction bloquée puis faite, suspension par camp, demi-dieu, alliance) ; `test/gatesRules.test.ts` (calculs purs).

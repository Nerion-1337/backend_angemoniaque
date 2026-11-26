---
title: Monter sur une invocation (fin des montures) ; délais de relance des sorts et après la mort d'une invocation
slug: summon-ride
status: done
updated: 2026-11-26
files:
  - src/game/spellSummon.ts
  - src/routes/spells.ts
  - src/game/movement.ts
  - src/routes/characters.ts
  - src/routes/map.ts
  - src/routes/admin/monsterDetails.ts
  - src/routes/admin/monsters.ts
symbols:
  - src/game/spellSummon.ts:ride
  - src/game/spellSummon.ts:castSummon
  - src/routes/spells.ts:useCooldown
  - src/game/movement.ts:activeMount
tests:
  - test/integration/summonRide.test.ts
  - test/integration/heightVision.test.ts
  - test/integration/features.test.ts
  - test/integration/spellSummon.test.ts
---
## Purpose
Les montures n'existent plus (migration 43, 2026-11-26) : un sort INVOQUE un monstre ; si son type est montable, son propriétaire
monte dessus. Un sort peut avoir un délai avant d'être relancé ; la mort d'une invocation bloque le sort qui l'a invoquée.

## Business rules
- Plus de montures possédées, d'équipement de monture, de navire, de catalogue / kit / marché / octroi de montures, de souffle de monture : `/mounts/*` n'existe plus (404). Les montures des joueurs ont été supprimées (choix de l'humain, pas de conversion) ; les sorts « invoquer une monture » invoquent le monstre.
- Monter (`POST /summons/ride`) : sa propre invocation, type `mountable`, PV > 0, case VOISINE (même monde, Chebyshev ≤ 1), pas déjà monté, pas en contrôlant une créature (409 sinon). L'invocation quitte la carte (plus une cible) et `characters.riding_summon_id` la désigne.
- Monter dès le lancer : `POST /spells/cast` avec `ride: true` ; seulement si le type invoqué est montable et le héros pas déjà monté (sinon invoqué sans monter). `GET /spells` expose `summon_mountable`.
- Monté : les déplacements et les capacités actives du type (`monster_spells` actif) consomment l'énergie de l'invocation ; les actions du joueur restent payées par lui (`spend` 'move' / 'mount').
- Descendre (`POST /summons/dismount`) : l'invocation reprend une case libre voisine ; refusé en eau profonde. Contrôler l'invocation montée → 409.
- Invocation montée renvoyée, expirée ou supprimée : le cavalier est démonté (FK `ON DELETE SET NULL`).
- Vision / portée du cavalier : +taille (1 à 3) si l'invocation montée est terrestre ou aquatique ; volante (locomotion avec `air`, même si elle marche aussi) = niveau +6 SANS la taille. Pas de gain de taille pour l'invocation elle-même.
- Délai de relance (`spells.cooldown_h`, heures, décimales ; 0 = aucun) : par lanceur (`spell_cooldowns`) ; relancer avant l'échéance → 409 « encore 1 h 30 » ; posé au lancer (annulé si le lancer échoue). `GET /spells` expose `cooldown_left_s`.
- Délai après la mort (`monsters.resummon_delay_h`) : quand une invocation est TUÉE (supprimée à 0 PV), le sort qui l'a invoquée (`summons.spell_id`) attend ce délai (trigger `summon_death_cooldown`, garde l'échéance la plus lointaine). Renvoyée ou expirée : aucun délai.

## Gotchas
- Le migrateur enregistre tous les fichiers sans les rejouer sur un volume NEUF (marqueur du 43) : rejouer un ancien fichier après le 43 échouerait (tables de montures supprimées).
- Un monstre « Navire » issu de l'ancienne conversion des montures reste un type de monstre (invocable s'il est lié à un sort).
- Invocation volante montée qui expire au-dessus de l'eau profonde : le cavalier reste sur la case (pas de noyade gérée).

## Tests
`test/integration/summonRide.test.ts` (case voisine, déplacement et capacité payés par l'invocation, descendre, monter au lancer, type non montable, délai de relance, délai après la mort et pas après un renvoi, validations admin, `/mounts` disparu) ; `heightVision` (taille, volant +6 sans taille, aquatique) ; `features` (énergie séparée).

---
title: Montures possédées : monter dessus ou invoquer à pied, capacités et équipement
slug: mount-call
status: done
updated: 2026-11-25
files:
  - src/routes/mounts.ts
  - src/routes/spells.ts
  - src/game/spellEffects.ts
symbols:
  - src/routes/mounts.ts:mountStats
  - src/game/spellEffects.ts:pickTargets
tests:
  - test/integration/mountCall.test.ts
---
## Purpose
Une monture possédée (issue d'un type de monstre) se MONTE ou s'INVOQUE à pied comme créature contrôlable ; dans les deux
cas ses capacités sont utilisables et elle peut être équipée sur les parties du corps de son type.

## Business rules
- Monter (`POST /mounts/summon`, `cmId` ou l'ancien `mountId`) : seulement si le type sert de monture (sinon 409), PV > 0 ; une seule monture montée (invoquée à pied : voir plus bas).
- Montée : les déplacements consomment l'énergie de la monture, jamais celle du joueur ; les actions du joueur restent payées par lui ; les capacités actives du type (`monster_spells` mode actif) sont lançables et payées par la monture.
- Invoquer à pied (`POST /mounts/call`) : pas montée, pas déjà invoquée, PV > 0, dans la limite d'invocations ; la créature (`summons.char_mount_id`, `monster_id`) reprend PV / énergie actuels et les caractéristiques monture + équipement (`mountStats`).
- Créature contrôlée : elle paie ses déplacements et ses capacités ; « soi-même » d'un sort désigne la créature (`pickTargets` avec `selfSummonId`).
- Renvoyée, tuée ou expirée : ses PV et son énergie reviennent sur la monture (trigger) ; tuée → 0 PV, ni montable ni invocable avant régénération.
- Équiper (`/mounts/equip`, `/mounts/unequip`) : objet pris dans le SAC, partie autorisée par le type (400 sinon), une pièce par partie (409) ; retrait vers le sac (sac plein → 409) ; impossible pendant une invocation à pied (409).
- L'équipement compte pour la créature invoquée (PV, énergie, régénération, vue, force, agilité, armures) ; pendant la monte, la monture n'est pas une cible et son équipement ne protège pas le cavalier.
- `GET /mounts/{characterId}` : par monture `cm_id`, `can_ride`, `summon_id`, `slots`, `equips`, `capacities`, `stats`.
- Monter sur une monture invoquée à pied : seulement depuis une case VOISINE de la créature (même monde, Chebyshev ≤ 1), sinon 409 « approchez-vous » ; la créature est renvoyée (trigger : PV / énergie rendus) puis montée.
- Équipement des créatures possédées : emplacements d'un personnage (`MONSTER_SLOTS`, migration 35), objet du bon type (`GROUP`), arme à deux mains en main principale seulement.

## Gotchas
- Supprimer une monture possédée (expiration d'invocation, admin) supprime son équipement (cascade) : les objets sont perdus.
- Une capacité à la fois apprise et liée au type est payée comme capacité (tri sur la source).
- Les capacités passives (auras) des monstres restent sans moteur.

## Tests
`test/integration/mountCall.test.ts` (fiche, équiper / partie interdite, capacité et déplacement payés par la monture, refus d'invoquer en selle, créature contrôlée qui paie, retour PV / énergie, type non montable, retrait vers le sac).

---
title: Détails de monstre (phase 3) : compétences/sorts, équipement par slot, auras, placement spontané & réincarnation
slug: monster-details
status: done
updated: 2026-11-25
files:
  - src/routes/admin/monsterDetails.ts
  - src/routes/admin/bestiary.ts
  - src/game/combatlib.ts
  - src/game/spawn.ts
  - src/routes/tick.ts
  - src/routes/admin.ts
  - src/game/respawn.ts
  - src/routes/admin/monsters.ts
symbols:
  - src/routes/admin/monsterDetails.ts:spellRoutes
  - src/routes/admin/monsterDetails.ts:monsterDetailRoutes
  - src/routes/admin/bestiary.ts:bestiaryRoutes
  - src/game/combatlib.ts:scheduleRespawn
  - src/game/spawn.ts:reincarnateDue
  - src/game/respawn.ts:respawnBlockers
tests:
  - test/monsterDetails.test.ts
  - test/integration/monsterDetails.test.ts
  - test/integration/monsterRespawn.test.ts
---
## Purpose
Fiche détaillée d'un type de monstre (phase 3) : capacités actives/passives, équipement par partie du corps, placement
d'instances sur les cartes avec leurs butins, déplacement, liaison à un personnage et réincarnation après délai. Inclut le
catalogue global des sorts (rareté, qui peut l'apprendre).

## Business rules
- Capacité = (monstre, sort, mode) unique ; `active` = lancée à la demande (cible/rayon NULL) ; `passive` = en continu sans énergie, `target` alliés/ennemis (NULL = tous), `radius` 1–50 (défaut 3). Un même sort peut exister en actif ET en passif.
- Équipement : un objet par monstre, sur l'un des 7 slots (mains, tête, torse, pieds, collier, bracelet, bague) ; l'objet ne se duplique pas, son slot se change.
- Parties équipables (`monster_slots`) définies par TYPE, cochées ET décochées (`DELETE …/slots/{slot}` lit le paramètre en TEXTE) ; une instance suit la grille de son prototype. Grille vide → tout ajout refusé (400) ; slot hors grille → 400 ; une pièce déjà portée reste supprimable.
- Placement : instance clonée du prototype (« Proto #n », `data.placed`), or et délai de réincarnation choisis, butin copié du prototype filtré (objets / ressources / divins) ; refusé hors bornes (400), sur eau/lave (400), case occupée (409). Le déplacement applique les mêmes contrôles.
- Retirer une case supprime l'instance placée/sauvage (cascade butin, réapparition).
- Réapparition réglée par TYPE (`respawn`, `reincarnate_delay_h`, `respawn_limits`, migration 24 ; une instance placée suit son prototype) :
  - `respawn` faux : l'instance placée tuée est supprimée ; le type ancré tué est retiré de la carte (il reste au catalogue) ;
  - délai = `data.reincarnate_h` de l'instance, sinon celui du prototype ; 0 sans condition = régénération immédiate ; sinon reste mort (PV 0) jusqu'à l'échéance `monster_respawns` ;
  - `respawn_limits` `[{ kind: item|spell|resource, ref, max }]` : à l'échéance, si au moins `max` exemplaires sont chez les joueurs (objets : toutes les lignes `character_items` ; sorts : personnages qui l'ont appris ; ressources : somme des stocks), pas de réapparition ; l'échéance reste et est revérifiée à chaque tick ;
  - les sauvages (règles d'apparition) disparaissent toujours à leur mort.
- Réattaquer un corps mort rafraîchit l'échéance sans nouveau butin.
- Un monstre en attente de réincarnation ne régénère pas au tick.
- Statut : chaque instance indique `linked` (lié à un personnage via `character_monster`, sinon « natif »).
- Sorts : rareté ∈ {commun, rare, epique, legendaire, divin} (CHECK) ; `usable_by` ⊂ {humain, ange, demon, monstre, structure, monture}, vide = tout le monde ; `learners` = nombre de personnages qui le possèdent.
- Sorts : `shop` (défaut vrai) et `shopRaces` (races autorisées, [] = toutes) règlent la boutique de l'hôtel de ville (card `craft-shop`).
- Sorts : `effects` (moteur de sorts) et liens `/admin/content/spells/{id}/links` (monstre, objet, monture, bâtiment) — card `spell-engine`.

## Gotchas
- La garde `hp_current <= 0` en tête de `monsterDeath` est obligatoire (sinon double butin et or dupliqué).
- Les capacités passives sont une donnée : aucun moteur ne les applique encore en combat.
- INSERT d'instance : 14 paramètres (`$2`, `$7` doublés) ; un de plus → 500.
- `respawn` absent (ligne simulée, vieille ligne) vaut « recréé » : tester `=== false`, jamais `!respawn`.
- Migrations 12 + 13 + 24 requises (sinon 500 sur capacités / `monster_slots`).

## Tests
`test/monsterDetails.test.ts` (mort sans/avec délai, corps déjà mort, sauvage, `reincarnateDue`, `scheduleRespawn`) ; `test/integration/monsterDetails.test.ts` (catalogue de sorts, capacités, équipement, placement + retrait, base laissée propre) ; `test/integration/monsterRespawn.test.ts` (partie décochée, type non recréé, conditions bloquantes puis réapparition).

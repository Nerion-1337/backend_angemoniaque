---
title: Détails de monstre (phase 3) : compétences/sorts, équipement par slot, auras, placement spontané & réincarnation
slug: monster-details
status: done
updated: 2026-11-26
files:
  - src/game/xp.ts
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
  - test/xpRank.test.ts
  - test/integration/xpRespawn.test.ts
  - test/monsterDetails.test.ts
  - test/integration/monsterDetails.test.ts
  - test/integration/monsterRespawn.test.ts
  - test/integration/appearance.test.ts
---
## Purpose
Fiche détaillée d'un type de monstre (phase 3) : capacités actives/passives, équipement par partie du corps, placement
d'instances sur les cartes avec leurs butins, déplacement, liaison à un personnage et réincarnation après délai. Inclut le
catalogue global des sorts (rareté, qui peut l'apprendre).

## Business rules
- Capacité = (monstre, sort, mode) unique ; `active` = lancée à la demande (cible/rayon NULL) ; `passive` = en continu sans énergie, `target` alliés/ennemis (NULL = tous), `radius` 1–50 (défaut 3). Un même sort peut exister en actif ET en passif.
- Parties équipables (`monster_slots`) définies par TYPE, cochées ET décochées (`DELETE …/slots/{slot}` lit le paramètre en TEXTE) ; une instance suit la grille de son prototype. Grille vide → tout ajout refusé (400) ; slot hors grille → 400 ; une pièce déjà portée reste supprimable.
- Placement : instance clonée du prototype (« Proto #n », `data.placed`), or et délai de réincarnation choisis, butin copié du prototype filtré (objets / ressources / divins) ; refusé hors bornes (400), sur eau/lave (400), case occupée (409). Le déplacement applique les mêmes contrôles.
- Retirer une case supprime l'instance placée/sauvage (cascade butin, réapparition).
- Réattaquer un corps mort rafraîchit l'échéance sans nouveau butin.
- Un monstre en attente de réincarnation ne régénère pas au tick.
- Statut : chaque instance indique `linked` (lié à un personnage via `character_monster`, sinon « natif »).
- Sorts : rareté ∈ {commun, rare, epique, legendaire, divin} (CHECK) ; `usable_by` ⊂ {humain, ange, demon, monstre, structure}, vide = tout le monde ; `learners` = nombre de personnages qui le possèdent.
- Sorts : `shop` (défaut vrai) et `shopRaces` (races autorisées, [] = toutes) règlent la boutique de l'hôtel de ville (card `craft-shop`).
- Sorts : `effects` (moteur de sorts) et liens `/admin/content/spells/{id}/links` (monstre, objet, bâtiment) — card `spell-engine`. Type `mountable`, `size`, `resummon_delay_h` : card `summon-ride`.
- Équipement : mêmes emplacements qu'un personnage (`MONSTER_SLOTS` : weapon_main/off, head, chest, foot, amulet, ring_l/r, bracelet_l/r ; migration 35) ; une pièce par emplacement (deux armes identiques possibles), objet du bon type (`GROUP` de l'inventaire), arme à deux mains en main principale seulement ; suppression par emplacement (`DELETE …/equips/{slot}`). Les créatures possédées (`mount_equips`) suivent les mêmes règles.
- Réapparition réglée sur CHAQUE monstre posé (colonnes de sa ligne : `respawn`, `reincarnate_delay_h`, `respawn_limits`, `divine_family` ; migration 35), initialisée depuis le type au placement :
-   - `respawn` faux : le monstre posé tué est supprimé ; un type ancré tué est retiré de la carte (il reste au catalogue) ;
-   - délai 0 sans condition ni objet divin = régénération immédiate ; sinon reste mort (PV 0) jusqu'à l'échéance `monster_respawns`, revérifiée à chaque tick ;
-   - `respawn_limits` `[{ kind: item|spell|resource, ref, max }]` : pas de réapparition tant qu'au moins `max` exemplaires sont chez les joueurs ;
-   - objet divin porté (`divine_family`) : un seul exemplaire gardé à la fois (`attachDivine` : exemplaire libre, sinon nouvel exemplaire sous le plafond de la famille) ; tué, il passe au tueur ; ne réapparaît plus tant que la famille est complète chez les joueurs ;
-   - les sauvages (règles d'apparition) disparaissent toujours à leur mort ; un exemplaire divin non transmis redevient libre.
- XP (migration 35, `game/xp.ts`) : monstre tué → `xp_reward` au tueur (ponctuel ; remplace l'XP/h) ; coup porté par le héros → somme des `xp_use` de ses armes équipées ; sort lancé → `spells.xp_use` ; parchemin utilisé → `items.xp_use`. Face à une cible, pondéré par l'écart de rang (rang cible − rang personnage ; monstre : `monsters.rank`) selon `game_config.xp_rank_diff` (ligne la plus proche, égalité : la plus basse ; sans cible 100 %).

- `model` / `icon` (migration 41) : clés [a-z0-9_]{1,40} ou null (automatique), validées par Zod ; recopiées sur le monstre posé (`/admin/bestiary/place`) et apparu (spawn).
## Gotchas
- La garde `hp_current <= 0` en tête de `monsterDeath` est obligatoire (sinon double butin et or dupliqué).
- Les capacités passives sont une donnée : aucun moteur ne les applique encore en combat.
- INSERT d'instance : 14 paramètres (`$2`, `$7` doublés) ; un de plus → 500.
- `respawn` absent (ligne simulée, vieille ligne) vaut « recréé » : tester `=== false`, jamais `!respawn`.
- Migrations 12 + 13 + 24 requises (sinon 500 sur capacités / `monster_slots`).

## Tests
`test/monsterDetails.test.ts` (mort sans/avec délai, corps déjà mort, sauvage, `reincarnateDue`, `scheduleRespawn`) ; `test/integration/monsterDetails.test.ts` (catalogue de sorts, capacités, équipement, placement + retrait, base laissée propre) ; `test/integration/monsterRespawn.test.ts` (partie décochée, type non recréé, conditions bloquantes puis réapparition).

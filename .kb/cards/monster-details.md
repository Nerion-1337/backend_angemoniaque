---
title: Détails de monstre (phase 3) : compétences/sorts, équipement par slot, auras, placement spontané & réincarnation
slug: monster-details
status: done
updated: 2026-11-20
files:
  - src/routes/admin/monsterDetails.ts
  - src/routes/admin/bestiary.ts
  - src/game/combatlib.ts
  - src/game/spawn.ts
  - src/routes/tick.ts
  - src/routes/admin.ts
symbols:
  - src/routes/admin/monsterDetails.ts:spellRoutes
  - src/routes/admin/monsterDetails.ts:monsterDetailRoutes
  - src/routes/admin/bestiary.ts:bestiaryRoutes
  - src/game/combatlib.ts:scheduleRespawn
  - src/game/spawn.ts:reincarnateDue
tests:
  - test/monsterDetails.test.ts
  - test/integration/monsterDetails.test.ts
---
## Purpose
Étape 2 phase 3 du bestiaire : l'admin complète la fiche d'un monstre au-delà des caractéristiques de
base — compétences/sorts (piochés dans le catalogue global `spells`), équipement (objet + l'un des 7
slots : mains/tête/torse/pieds/collier/bracelet/bague), auras (un sort appliqué **en continu** et
**sans consommation d'énergie**, sur les alliés ou les ennemis, dans un périmètre en cases), le
placement spontané d'une instance sur une carte avec ses drops de mort (or / objets / ressources /
divins) et la réincarnation automatique après délai une fois tué.

## How it works
- **Catalogue de sorts** (`monsterDetails.ts` `spellRoutes`, monté dans `admin.ts` sous `/admin/*`) :
  CRUD complet `/admin/content/spells` (GET liste + `?q`, POST, PUT, DELETE) sur la table `spells`
  (colonnes `kind, energy_cost, damage, description, price, duration_h` — `duration_h` ajoutée par la
  migration `12_monstre_details.sql`). C'est la « base de sorts global du jeu » que les menus
  déroulants du front exploitent.
- **Sous-collections du monstre** (`monsterDetailRoutes`) : `monster_spells` (UNIQUE
  (monster_id,spell_id), POST `ON CONFLICT DO NOTHING` → 409 si déjà attribué), `monster_equips`
  (slot CHECK 7 valeurs ; même objet → `DO UPDATE SET slot` : une pièce par objet, le slot est
  modifiable), `monster_auras` (UNIQUE (monster_id,spell_id,target), `target IN ('ally','enemy')`,
  `radius` 1-50). GETs jointes (`item_name`, `spell_name`, `energy_cost`…) ; DELETE par clé.
  Les FK `ON DELETE CASCADE` : supprimer le monstre retire ses lignes ; supprimer un sort retire
  attributions et auras.
- **Placement spontané** (`bestiary.ts` `POST /admin/bestiary/place` {monsterId, mapId, x, y,
  gold?, items?, resources?, divine?, reincarnateH?}) : crée une **instance** — clone du prototype
  (comme `hourlySpawns`) nommée « Proto #n », `data={placed:true, prototype, reincarnate_h,
  behavior}`, `gold_current` = or choisi, `reincarnate_delay_h` = délai choisi — puis copie dans
  `monster_loot` de l'instance les entrées du prototype filtrées par les cases (objets / ressources /
  divins) et place la case (`positions`). Garde-fous : carte/monstre existants (404), bornes (400),
  terrain eau/volcan (400 « Case invadable »), case occupée (409). `DELETE /admin/bestiary/place/{posId}`
  retire la case ; si l'instance est `placed`/`spawned`, elle est supprimée (cascade butin/respawns).
- **Réincarnation** : `monsterDeath` (combatlib) lit le délai
  (`data.reincarnate_h` de l'instance, repli `reincarnate_delay_h` du prototype) : à 0 → régénération
  instantanée (historique) ; >0 → le monstre **reste mort (PV 0)** et `scheduleRespawn` insère
  `monster_respawns(monster_id, due_at=now()+délai)` (`ON CONFLICT DO UPDATE` → réattaque d'un corps
  déjà mort **rafraîchit** l'échéance sans retoucher de butin — garde `hp_current<=0` en tête de
  `monsterDeath`). Le butin est tiré **à la mort** (or + entrées pondérées), jamais différé : le
  corps réincarné repart vide. `reincarnateDue` (spawn.ts, appelée à la fin du `hourlyTick`) fait
  régénérer PV complets les échéances atteintes et supprime leurs lignes ; le tick exclut les
  monstres en attente de réincarnation de la régénération horaire (WHERE `id NOT IN monster_respawns`).

## Entry points
- `src/app.ts` → `adminRoutes` (garde admin) : `spellRoutes` + `monsterDetailRoutes` (montés dans
  `admin.ts`) et `bestiaryRoutes` (placement/status).
- `applyDamage` (`combat.ts`, `spells.ts`) → `monsterDeath` (`combatlib.ts`) → `scheduleRespawn`.
- `POST /admin/tick` + `setInterval(hourlyTick, 3600e3)` (`routes/tick.ts`, `index.ts`) →
  `hourlySpawns` puis `reincarnateDue`.
- Front admin (dépôt `front` `#admin`, onglet Monstres) : listes de sorts/objets + menus déroulants
  avec recherche, onglets « Compétences / Équipements / Auras / Placements » (voir fiche front
  `monster-details-ui`).

## Data flow
- `monster_spells(monster_id,spell_id)` ; `monster_equips(monster_id,item_id,slot)` ;
  `monster_auras(monster_id,spell_id,target,radius)` — toutes `ON DELETE CASCADE` vers `monsters`.
- Placement : `monsters` (instance clonée, `data.placed`) + `monster_loot` (drops copiés) +
  `positions` (la case). Statut `/admin/bestiary/status` : `pos_id, placed, prototype, gold,
  reincarnate_h, respawn_due_at` par instance.
- Réincarnation : `monsters.hp_current` 0→`hp_max` à l'échéance ; `monster_respawns` (PK
  `monster_id`) est l'unique source de vérité de l'attente.

## Tests
- `test/monsterDetails.test.ts` (unit, db mocké) : mort ancrée sans délai (regen instantanée +
  butin + or), mort avec délai (échéance programmée, butin tiré à la mort), corps déjà mort
  (aucun retout, échéance rafraîchie `ON CONFLICT`), sauvage (`DELETE` classique, aucune
  réincarnation), `reincarnateDue` (échéances → PV complets + suppression ; nul sinon),
  `scheduleRespawn` (doublon → `DO UPDATE`).
- `test/integration/monsterDetails.test.ts` (requête HTTP sur l'app, Postgres réel) : parcours
  complet — CRUD du catalogue de sorts (catalogue laissé propre), sous-collections d'un monstre
  (compétence, équipement 7 slots avec changement de slot, aura alliés/ennemis + rayon),
  placement (instance clonée, or + drop copié, réincarnation 1 h) puis retrait (case libérée,
  instance supprimée) ; rien ne fuit dans la base entre runs (les suites `features` comptent le
  catalogue seedé).

## Gotchas
- **Le butin se tire à la mort, pas à la réincarnation** : le délai ne diffère que la
  réapparition ; changer cette sémantique casserait les récompenses du vainqueur.
- **Garde anti-double-mort** : le `if ((t.row.hp_current ?? 0) <= 0)` en tête de `monsterDeath` est
  obligatoire — sans elle, une attaque sur un corps déjà mort retirerait le butin et
  dupliquerait l'or (`rollLoot` + `UPDATE characters SET gold`).
- **`data.reincarnate_h` (instance) prime sur `reincarnate_delay_h` (prototype)** : le placement
  copie le délai de l'instance ; un prototype modifié en cours de partie ne change pas les
  instances existantes (comportement voulu — les instances sont des lignes dédiées).
- **Le tick horaire exclut les monstres en attente de réincarnation** de la régénération PV/énergie
  (`WHERE m.id NOT IN (SELECT monster_id FROM monster_respawns)`) : oublier ce `NOT IN` ferait
  « résurrection lente » avant l'échéance.
- **Les auras sont une couche de données** (Étape 2) : aucun moteur de combat n'applique encore
  l'effet en continu — l'activation (buff/DoT radius) est l'étape 3 du bestiaire ; ne pas casser
  le schéma `(monster_id, spell_id, target)` sans revoir ce plan.
- INSERT d'instance (placement) : 16 colonnes / 16 valeurs avec `$2` et `$7` doubles
  (`hp_current=hp_max`, `energy_current=energy_max`) — 14 paramètres ; un paramètre de plus et le
  POST tombe en 500 (« INSERT has more expressions than target columns »), comme le
  `hourlySpawns` historique (13 paramètres / 14 slots).
- `monster_equips` : `ON CONFLICT (monster_id,item_id) DO UPDATE SET slot` — ajouter un 2e item par
  slot n'est pas l'usage (une pièce par objet) ; le slot se change, l'objet ne se duplique pas.
- La migration est `infra/db/12_monstre_details.sql` (marqueur `to_regclass('game_schema.monster_spells')`
  dans `scripts/migrate.sh`) : sur un volume existant, `make dev-migrate`/`prod-migrate` (ou le
  service `migrator`) applique le fichier — sans lui, le POST placement/CRUD 500 (colonnes
  manquantes).

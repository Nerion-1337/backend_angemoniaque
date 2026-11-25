---
title: Invocations par sort et sorts déclenchés par les objets portés
slug: spell-summon
status: done
updated: 2026-11-25
files:
  - src/game/spellSummon.ts
  - src/routes/spells.ts
  - src/routes/combat.ts
  - src/routes/tick.ts
  - src/routes/craft.ts
symbols:
  - src/game/spellSummon.ts:castSummon
  - src/game/spellSummon.ts:expireSummons
  - src/game/spellSummon.ts:triggerItemSpells
  - src/game/spellSummon.ts:copyBuilding
tests:
  - test/integration/spellSummon.test.ts
---
## Purpose
Un sort peut invoquer un élément (monstre, monture, objet, bâtiment), pour toujours ou pour une durée. Un objet porté peut
déclencher ses sorts liés quand son porteur frappe (arme) ou est frappé (armure, bouclier).

## Business rules
- `effects.summon` = { kind: monster | mount | item | building, refId, qty (objets, 1–99), durationH (0 = permanent) } ; l'admin refuse un élément inconnu ou une monture dont le type n'est pas montable (404).
- Monstre : invocation de combat (`summons`) près du lanceur, dans la limite d'invocations (409). Monture : ligne `character_mounts` du type montable. Objet : `qty` exemplaires dans le sac (sac plein → 409). Bâtiment : copie complète du modèle (caractéristiques ET sorts liés) près du lanceur, à lui.
- Sort d'invocation seule : aucune cible à choisir ; énergie dépensée puis invocation. Sort avec d'autres effets : effets puis invocation.
- Temporaire : `spell_summons` ; au tick qui suit l'échéance, l'élément est retiré (monstre, monture, copie du bâtiment, objets : sac puis coffre puis portés).
- Liens élément → sort (`entity_spells.mode`) : `passive` (en continu), `active` (à activer : lançable), `on_hit` et `on_struck` réservés aux objets (400 sinon).
- `on_hit` : après un coup réussi du héros (pas d'une invocation contrôlée) qui ne tue pas, chaque sort lié en `on_hit` à un objet porté s'applique à l'adversaire, ou au porteur si le sort cible « soi-même ».
- `on_struck` : un personnage frappé (et vivant) déclenche les sorts `on_struck` de ses objets portés sur l'attaquant (ou sur lui-même). Sans coût d'énergie. Seules les attaques au corps à corps ou à distance déclenchent, pas les sorts.
- `GET /admin/content/element-spells?kind&refId` : sorts liés à un objet, une monture ou un bâtiment ; les fiches admin s'en servent.
- La fabrication par parchemin utilise la même copie de bâtiment (`copyBuilding`).

## Gotchas
- `character_items` et `character_mounts` n'ont pas d'identifiant : le retrait d'une invocation temporaire enlève des exemplaires du même objet / de la même monture (pas forcément ceux invoqués).
- Un monstre invoqué est une invocation de combat : il n'a ni butin ni réapparition.

## Tests
`test/integration/spellSummon.test.ts` (validations, objet temporaire ×2 retiré, monstre temporaire, monture et bâtiment permanents, modes de lien, déclenchements au coup porté et à l'attaque reçue en combat).

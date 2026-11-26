---
title: Foi et Pactes réglés en admin (gains, prières, bénédictions, compositions de pacte, pactes par rang) ; classement public
slug: faith-pact
status: done
updated: 2026-11-26
files:
  - src/game/faithPact.ts
  - src/routes/faiths.ts
  - src/routes/pacts.ts
  - src/routes/ranking.ts
  - src/routes/admin/faithPact.ts
  - src/routes/tick.ts
  - src/middleware/auth.ts
symbols:
  - src/game/faithPact.ts:blessingCost
  - src/game/faithPact.ts:pactAmount
  - src/game/faithPact.ts:godIncome
  - src/game/faithPact.ts:applyBuff
  - src/game/faithPact.ts:defaultMaxPacts
tests:
  - test/integration/faithPact.test.ts
  - test/rules.test.ts
  - test/integration/gameplay.test.ts
---
## Purpose
Foi et Pactes entièrement réglés en admin (migration 44) et classement public des joueurs.

## Business rules
- Classement (`GET /ranking`, public comme le forum) : personnages non bloqués, triés par rang (`current_rank`) puis XP, puis ancienneté ; pseudo, rang, race (nom de la table `races`), guilde ; `page` / `size` (25, max 100), page hors limites = dernière ; `around=<pseudo>` ouvre sa page et renvoie `position`.
- Fiche publique (`CARD_SQL`) : mêmes informations, renvoyées pour l'autre partie des pactes et des fois (demandes comprises).
- Foi : un joueur devient fidèle d'un dieu de SA race (rang ≥ 5), liste `GET /faiths/gods/{id}` ; autre race → 403 ; le dieu accepte ou refuse.
- Gains du dieu (tick) : par tranche complète de `followersStep` fidèles acceptés, `xpHour` XP (× taux global) et `goldHour` or.
- Prières : caractéristique proposée en admin seulement (400 sinon) ; `prayers` prières par `prayerPeriodH` heures glissantes, toutes fois confondues ; au-delà 429 « prochaine dans … ».
- Bénédiction (`/faiths/{id}/bless`, le dieu) : valeur 1..max, durée 1..maxH heures ; coût en énergie divine = ⌈coût max × valeur/max × durée/maxH⌉ ; bonus temporaire (`temp_buffs`, source `faith:<id>`) ; PV / énergie / ÉD max augmentent aussi la réserve courante ; efface la prière si elle portait sur cette caractéristique.
- Pacte : à la demande, la composition la plus basse est posée ; l'Ange / le Démon la change pacte par pacte (`/pacts/{id}/tier`, l'Humain → 404) ; l'Humain ne reçoit que son nom, l'Ange / le Démon le détail de toutes.
- Gains du pacte (tick) : `xp_hour` / `gold_hour` de la composition de chaque pacte actif, pour l'Ange / le Démon.
- Activation (l'Humain) : pour chaque caractéristique cochée en admin, ⌈valeur de l'Ange/Démon × percent %⌉ passe de l'un à l'autre pendant `duration_h` ; refus si la composition manque, si le bonus est actif, en recharge (`ready_at` = fin du bonus + `cooldown_h`), ou si les PV courants de l'Ange/Démon tomberaient sous 1.
- Pactes simultanés : `specializations.max_pacts` du rang de CHAQUE partie (NULL = défaut : Humain 1, Ange / Démon 3 + rang au-dessus de 2, autres 0), vérifié à l'acceptation.
- Admin : `/admin/content/faith` (réglages validés), `/admin/content/pact` (caractéristiques), `/admin/content/pact-tiers` (nom unique → 409, % 1–100, durée ≥ 1 h), `/admin/content/pact-limits`.

## Gotchas
- Les bonus expirent au tick horaire (granularité d'une heure).
- Supprimer une composition laisse les pactes sans composition : activation refusée tant que l'Ange / le Démon n'en choisit pas une autre.
- L'Ange / le Démon perd des PV courants à l'activation (PV max transféré) ; ils ne reviennent pas à l'expiration (régénération normale).

## Tests
`test/integration/faithPact.test.ts` (classement trié / paginé / around, foi : race, prière limitée, coût proportionnel, PV max + PV, non-dieu 403, gain horaire ; pactes : compositions admin, choix réservé à l'Ange, transfert en %, PV insuffisants, bonus actif, recharge, limite par rang, suppression d'une composition) ; `test/rules.test.ts` (calculs purs) ; `gameplay.test.ts` (demande, acceptation, activation).

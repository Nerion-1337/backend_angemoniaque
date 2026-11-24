---
title: Gisements de ressources (zone, stock, rendement, épuisement, régénération)
slug: deposits
status: done
updated: 2026-11-24
files:
  - src/game/deposits.ts
  - src/routes/admin/deposits.ts
  - src/routes/actions.ts
symbols:
  - src/game/deposits.ts:depositAt
  - src/game/deposits.ts:takeFromDeposit
  - src/game/deposits.ts:regenDeposits
tests:
  - test/integration/deposits.test.ts
---
## Purpose
Gisements de ressources placés en admin : une ressource du catalogue sur une zone d'un monde, avec un stock partagé qui se vide à la
récolte et se régénère chaque heure.

## Business rules
- Zone = rectangle (une case si min = max) dans les bornes du monde (400 sinon) ; ressource du catalogue (404 sinon) ; stock initial borné par le maximum.
- Une case couverte par plusieurs gisements actifs suit le plus PETIT (puis le plus récent).
- Récolte sur une case de gisement : la ressource du gisement remplace celle du terrain ; quantité = `yield_per_harvest`, bornée par le stock restant, retirée du stock (verrou de ligne pendant la transaction).
- Gisement épuisé → 409 « Gisement épuisé » AVANT tout trajet ; une case sans ressource de terrain devient récoltable si un gisement la couvre.
- La règle de l'eau profonde (à pied → rien à récolter) s'applique aussi aux gisements.
- Hors gisement, la récolte du terrain est inchangée (+1, illimitée).
- Tick horaire : `stock = min(stock_max, stock + regen_per_h)` pour les gisements actifs.
- `/map/{id}/cell` expose `deposit` (ressource, stock, maximum, régénération, quantité par récolte).

## Gotchas
- Le stock est commun à toute la zone : un grand rectangle n'a pas plus de stock qu'une case.
- Un gisement inactif est ignoré (ni récolte ni régénération).

## Tests
`test/integration/deposits.test.ts` (validations, récoltes ×2 ×2 ×1, épuisement 409, gisement visible sur la case, régénération).

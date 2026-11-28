---
title: Activation des bâtiments : options de conditions (objets, divins, sort, ressources, or, rang)
slug: building-activation
status: done
updated: 2026-11-25
files:
  - src/game/activation.ts
  - src/routes/buildings.ts
  - src/routes/divine.ts
  - src/routes/admin/buildings.ts
  - src/routes/admin/core.ts
symbols:
  - src/game/activation.ts:activate
  - src/game/activation.ts:groupMissing
  - src/game/activation.ts:describeActivation
tests:
  - test/integration/buildingActivation.test.ts
---
## Purpose
La capacité d'un bâtiment (franchir un portail, ou déclencher ses sorts « à activer ») peut exiger des conditions réglées
dans l'admin, combinables : plusieurs options alternatives, chacune avec ses exigences cumulées.

## Business rules
- `buildings.activation` = { groups: [...] } ; il suffit d'UNE option remplie (la première dans l'ordre est retenue) ; dans une option, chaque condition renseignée est exigée : objets dans le SAC (quantités), objets divins détenus (famille ou toutes, nombre), sort appris, ressources, or, rang minimum (palier) et / ou l'un des rangs listés (ex. « Divin » pour un dieu).
- `consume` vrai : objets, ressources et or retirés, objets divins rendus (sans détenteur) ; sinon seulement exigés.
- Aucune option remplie → 403 avec ce qui manque, option par option.
- Porte (`kind = door`) sans monde (`realm` NULL) : si des options existent, elles REMPLACENT l'exigence historique (`data.requires`, un objet divin rendu au gardien). Porte des mondes (migration 48, card `gates-structures`) : il faut une porte en face ouverte, les options s'ajoutent.
- Autre bâtiment : `POST /buildings/{id}/activate` (case adjacente, 409 sinon ; sans option → 409 ; porte → 400) ; les sorts liés « à activer » du bâtiment s'appliquent au profit de l'activateur : sort de zone autour du bâtiment (camp relatif à l'activateur), sinon l'activateur lui-même ; invocations près de lui.
- `POST /buildings/{id}/interact` renvoie `activation` (null sans option) ; le jeu active alors au lieu d'afficher le nom.
- Admin : objets, sorts, rangs, familles divines et ressources vérifiés (404) ; schéma strict (400) ; le catalogue admin fournit `ranks` et `divineFamilies`.
- `activate(db, ch, bd, { equipped, verb, err })` : `equipped` fait compter (et consommer) les objets équipés — utilisé par les conditions de récolte (card `deposits`) ; `describeActivation` = conditions en clair (ce qui manquerait à un personnage démuni).

## Gotchas
- Les sorts « à activer » d'un bâtiment restent aussi lançables par son propriétaire à côté (liste des sorts lançables) — sans conditions.
- Un sort non-zone hostile lié à un bâtiment s'applique à l'activateur : réserver ces liens aux effets bénéfiques ou de zone.

## Tests
`test/integration/buildingActivation.test.ts` (validations, 403 détaillé par option, option 1 consommée + sort appliqué, option 2 par rang et sort connu, porte réglée en or consommé).

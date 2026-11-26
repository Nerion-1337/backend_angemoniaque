---
title: Sécurité : anti-spam, anti-robot, mots de passe, accès admin
slug: security
status: done
updated: 2026-11-26
files:
  - src/lib/security.ts
  - src/middleware/auth.ts
  - src/routes/auth.ts
  - src/config/env.ts
  - src/app.ts
symbols:
  - src/lib/security.ts:rateLimit
  - src/lib/security.ts:verifyPow
  - src/lib/security.ts:passwordProblems
  - src/middleware/auth.ts:dbRole
  - src/routes/auth.ts:adminCookie
  - src/routes/auth.ts:bootstrapRole
tests:
  - test/security.test.ts
  - test/integration/security.test.ts
---
## Purpose
Protections contre le spam et les robots, politique de mot de passe, et contrôle d'accès admin réellement vérifié côté serveur.

## Business rules
- Jetons : signés avec JWT_SECRET (≥ 16 caractères, pas une valeur d'exemple) ; sinon secret aléatoire du processus, jamais un secret connu (`config/env.ts`).
- Un jeton portant un `scope` (ex. cookie des fichiers admin) est refusé comme jeton d'API (401).
- Admin et modérateur : rôle relu en base à chaque requête protégée (`dbRole`, mis en cache par requête) ; le rôle du jeton n'est jamais une preuve ; compte rétrogradé = refus immédiat (403). Création de personnage sans limite : seulement si le rôle EN BASE est admin.
- Amorçage admin : ADMIN_EMAIL ne reçoit le rôle admin (inscription ou Google) que s'il n'existe aucun admin.
- Cookie `ange_adm` (HttpOnly, SameSite=Strict, 12 h, portée « admin-assets ») posé à la connexion / inscription / restauration de session d'un admin, retiré sinon et à `/auth/logout` ; `GET /auth/admin-asset` répond 204 seulement si cookie valide ET compte admin en base (Nginx `auth_request` avant de servir le code admin).
- Limitation de débit (`rateLimit`, après l'authentification) : fenêtres fixes dans Redis (repli mémoire) ; IP = X-Real-IP de Nginx ; règles : global 900/min/IP, inscription 5/h/IP, connexion 15/5 min/IP, Google simulé 10/5 min, challenge 30/5 min, chat 15/min/compte, sujets de forum 3/5 min, réponses 6/min, signalements 10/h, guilde 8/min, écritures 240/min/compte (hors admin) ; 429 + Retry-After.
- Connexion : 8 échecs sur un même email en 15 min → 429 pour cet email jusqu'à la fin de la fenêtre (même avec le bon mot de passe).
- Inscription : champ piège `website` rempli → 400 ; preuve de travail (`/auth/challenge`, HMAC, 10 min, usage unique, `POW_BITS` = 16) ; mot de passe : 12 caractères, 3 types sur 4, pas de mot courant, de suite (1234, azer), de 4 caractères identiques ni de partie locale de l'email, ≥ 60 bits estimés.
- Protections RATE_LIMIT / BOT_CHECK : actives sauf « 0 » ; sous Vitest coupées sauf si un test les force à « 1 ».
- CORS : seule l'origine PUBLIC_URL est admise (aucune sinon : le front appelle /api sur la même origine).

## Gotchas
- Derrière un autre proxy, sans IP réelle transmise, tous les visiteurs partagent les limites par IP.
- Les comptes existants à mot de passe faible restent valides (la politique s'applique à l'inscription).

## Tests
`test/security.test.ts` (mot de passe, preuve de travail, règles) ; `test/integration/security.test.ts` (jeton falsifié, rôle du jeton ignoré, rétrogradation, jeton de portée, cookie admin, amorçage, mot de passe faible, champ piège, preuve de travail, débit, verrou de connexion, CORS).

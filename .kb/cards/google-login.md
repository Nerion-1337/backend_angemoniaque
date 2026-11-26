---
title: Connexion avec Google (OAuth, mode simulé)
slug: google-login
status: done
updated: 2026-11-26
files:
  - src/routes/google.ts
  - src/routes/auth.ts
  - src/middleware/auth.ts
symbols:
  - src/routes/google.ts:googleCfg
  - src/routes/google.ts:checkClaims
  - src/routes/google.ts:authUrl
  - src/routes/google.ts:googleAccount
tests:
  - test/forumAccess.test.ts
  - test/integration/forum.test.ts
---
## Purpose
Connexion avec Google (OAuth 2.0 / OpenID Connect, flux « authorization code » côté serveur, sans dépendance) ; mode simulé tant qu'aucune clé n'est réglée (migration 39).

## Business rules
- Mode (`googleCfg`, lu à chaque appel) : `google` si GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET, sinon `mock` sauf GOOGLE_MOCK=0 (`off`) ; la prod force GOOGLE_MOCK=0.
- `/auth/google/start` : jeton `state` aléatoire en cookie HttpOnly SameSite=Lax 10 min (`g_state`) puis redirection vers Google (scope openid email profile).
- `/auth/google/callback` : `state` = cookie (sinon retour `#google-error=`), échange du code, id_token vérifié par Google (tokeninfo) puis `checkClaims` : audience = notre client, émetteur Google, non expiré, email vérifié.
- Compte : par `google_sub`, sinon lié par email (email vérifié par Google ; refus si déjà lié à un autre Google), sinon créé sans mot de passe (`password_hash` NULL) ; l'email admin devient admin.
- Retour vers le front : `${base}/#google-token=<jwt>` ou `#google-error=<message>` ; base = PUBLIC_URL sinon X-Forwarded-Proto/Host (Nginx) ; URI à autoriser chez Google : `${PUBLIC_URL}/api/auth/google/callback`.
- Mode simulé (`POST /auth/google/mock { email }`, 404 hors mode mock) : crée ou rouvre seulement un compte Google (`google_sub = mock:<email>`) ; jamais un compte à mot de passe existant (409) ni l'admin (403).
- Connexion par mot de passe d'un compte sans mot de passe → 401 « Ce compte se connecte avec Google ».

- Compte créé par Google avec l'email admin : admin seulement si aucun admin n'existe (amorçage) ; cookie des fichiers admin posé au retour de Google pour un admin.
## Gotchas
- Les routes /auth/google/* sont publiques dans le middleware ; ne pas y ajouter de route qui suppose un compte.
- L'échange réel avec Google n'est pas testé (pas de réseau en test) : seuls la redirection, le cookie, le refus d'un état faux et les revendications le sont.

## Tests
`test/forumAccess.test.ts` (checkClaims, authUrl) ; `test/integration/forum.test.ts` (mode simulé, redirection réelle avec clés, état refusé).

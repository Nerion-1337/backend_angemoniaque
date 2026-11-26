import { randomBytes } from 'node:crypto'; import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { def, router, z } from '../lib/route.js'; import { pool, fail } from '../lib/db.js'; import { signToken } from '../middleware/auth.js'; import { env } from '../config/env.js';
/**
 * Connexion avec Google (migration 39) — flux « authorization code » côté serveur, sans dépendance :
 *  1. GET /auth/google/start : jeton anti-CSRF (`state`) en cookie HttpOnly 10 min, redirection vers Google ;
 *  2. GET /auth/google/callback : `state` = cookie, échange du code (oauth2.googleapis.com/token), vérification de l'id_token par
 *     Google (tokeninfo : audience = notre client, émetteur Google, email vérifié), compte trouvé par `google_sub`, sinon lié par
 *     email, sinon créé (sans mot de passe) ; retour vers le front `/#google-token=…` (ou `#google-error=…`).
 * Réglages (.env du back) : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, PUBLIC_URL (ex. https://jeu.exemple.fr) ; l'URI de redirection
 * à autoriser dans la console Google est `${PUBLIC_URL}/api/auth/google/callback`.
 * Sans clé : mode SIMULÉ (POST /auth/google/mock { email }) tant que GOOGLE_MOCK ≠ "0" (la prod le met à 0) ; il ne crée ou
 * n'ouvre que des comptes Google (jamais un compte à mot de passe existant, jamais le compte admin).
 */
export const googleRoutes = router();
export const googleCfg = () => {
  const id = process.env.GOOGLE_CLIENT_ID ?? '', secret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  return { id, secret, publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/+$/, ''), mode: id && secret ? 'google' : process.env.GOOGLE_MOCK === '0' ? 'off' : 'mock' } as const;
};
/** Adresse publique du site (PUBLIC_URL, sinon déduite des en-têtes du proxy). */
export const baseUrl = (c: any) => googleCfg().publicUrl || `${c.req.header('x-forwarded-proto') ?? 'http'}://${c.req.header('x-forwarded-host') ?? c.req.header('host') ?? 'localhost'}`;
export const callbackUrl = (c: any) => `${baseUrl(c)}/api/auth/google/callback`;
export function authUrl(clientId: string, redirect: string, state: string) {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account', access_type: 'online' });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}
/** Contrôle des revendications d'un id_token vérifié par Google (pur). */
export function checkClaims(t: any, clientId: string) {
  if (!t || t.aud !== clientId) return 'Jeton Google destiné à une autre application';
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(t.iss)) return 'Émetteur du jeton inconnu';
  if (Number(t.exp) * 1000 < Date.now()) return 'Jeton Google expiré';
  if (!t.sub || !t.email || !(t.email_verified === true || t.email_verified === 'true')) return 'Email Google non vérifié';
  return null;
}
/** Compte lié à Google : par identifiant, sinon lié par email (email vérifié par Google), sinon créé sans mot de passe. */
export async function googleAccount(sub: string, emailIn: string, mock = false) {
  const email = emailIn.trim().toLowerCase(), isAdmin = email === env.adminEmail.toLowerCase();
  const { rows: [bySub] } = await pool.query('SELECT id, role FROM accounts WHERE google_sub=$1', [sub]);
  if (bySub) return bySub;
  if (mock && isAdmin) fail(403, 'La connexion Google simulée est refusée pour le compte administrateur');
  const { rows: [byMail] } = await pool.query('SELECT id, role, google_sub, password_hash FROM accounts WHERE email=$1', [email]);
  if (byMail) {
    if (mock) fail(409, 'Ce compte se connecte par mot de passe : la connexion Google simulée ne peut pas s\'y lier');
    if (byMail.google_sub) fail(409, 'Ce compte est déjà lié à un autre compte Google');
    await pool.query('UPDATE accounts SET google_sub=$2 WHERE id=$1', [byMail.id, sub]); return byMail;
  }
  const { rows: [a] } = await pool.query('INSERT INTO accounts(email, password_hash, role, google_sub) VALUES ($1, NULL, $2, $3) RETURNING id, role', [email, isAdmin ? 'admin' : 'player', sub]);
  return a;
}
const session = async (a: any) => ({ token: await signToken(a.id, a.role), admin: a.role === 'admin', role: a.role });

def(googleRoutes, 'get', '/auth/google/config', null, async c => ({ mode: googleCfg().mode, redirectUri: callbackUrl(c) }));
googleRoutes.get('/auth/google/start', c => {
  const g = googleCfg(); if (g.mode !== 'google') return c.redirect(`${baseUrl(c)}/#google-error=${encodeURIComponent('Connexion Google non configurée')}`);
  const state = randomBytes(24).toString('base64url');
  setCookie(c, 'g_state', state, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 600, secure: baseUrl(c).startsWith('https') });
  return c.redirect(authUrl(g.id, callbackUrl(c), state));
});
googleRoutes.get('/auth/google/callback', async c => {
  const back = (k: string, v: string) => c.redirect(`${baseUrl(c)}/#${k}=${encodeURIComponent(v)}`), g = googleCfg();
  const state = c.req.query('state') ?? '', code = c.req.query('code') ?? '', saved = getCookie(c, 'g_state'); deleteCookie(c, 'g_state', { path: '/' });
  if (g.mode !== 'google') return back('google-error', 'Connexion Google non configurée');
  if (c.req.query('error')) return back('google-error', 'Connexion Google annulée');
  if (!saved || saved !== state || !code) return back('google-error', 'Session de connexion expirée : recommencez');
  try {
    const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: g.id, client_secret: g.secret, redirect_uri: callbackUrl(c), grant_type: 'authorization_code' }) });
    const tk: any = await tr.json(); if (!tr.ok || !tk.id_token) return back('google-error', 'Google a refusé la connexion');
    const info: any = await (await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tk.id_token)}`)).json();
    const bad = checkClaims(info, g.id); if (bad) return back('google-error', bad);
    const s = await session(await googleAccount(String(info.sub), String(info.email)));
    return back('google-token', s.token);
  } catch (e: any) { return back('google-error', e?.message && e.status ? e.message : 'Connexion Google impossible pour le moment'); }
});
/** Mode simulé (sans clé) : se connecter « avec Google » en donnant seulement un email. */
def(googleRoutes, 'post', '/auth/google/mock', z.object({ email: z.string().email('adresse email invalide').max(120) }), async (_c, b) => {
  if (googleCfg().mode !== 'mock') fail(404, 'Connexion Google simulée désactivée');
  return session(await googleAccount(`mock:${b.email.trim().toLowerCase()}`, b.email, true));
});

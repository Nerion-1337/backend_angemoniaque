import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'; import { sign, verify } from 'hono/jwt'; import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { def, router, z } from '../lib/route.js'; import { pool, fail } from '../lib/db.js'; import { signToken } from '../middleware/auth.js'; import { env } from '../config/env.js';
import { passwordProblems, issueChallenge, verifyPow, botCheck, rateOn, hit, peek } from '../lib/security.js';
/**
 * Comptes : inscription, connexion, session.
 *  - Inscription : mot de passe fort (lib/security.passwordProblems), champ piège `website` vide, preuve de travail anti-robot
 *    (`GET /auth/challenge` puis `pow: { token, nonce }`), CGU. L'email ADMIN_EMAIL ne devient admin QUE s'il n'existe encore
 *    aucun administrateur (amorçage unique) : personne ne peut s'attribuer le rôle ensuite.
 *  - Connexion : après 8 échecs sur un même email en 15 min, ce compte est verrouillé jusqu'à la fin de la fenêtre (429).
 *  - Fichiers de l'interface admin : un admin reçoit un cookie HttpOnly / SameSite=Strict (`ange_adm`, jeton à portée
 *    « admin-assets », inutilisable comme jeton d'API) que Nginx fait vérifier par `GET /auth/admin-asset` avant de servir le code admin.
 */
export const authRoutes = router();
const hash = (p: string) => { const s = randomBytes(16).toString('hex'); return `${s}:${scryptSync(p, s, 32).toString('hex')}`; };
const check = (p: string, h: string) => { const [s, k] = h.split(':'); return timingSafeEqual(Buffer.from(k, 'hex'), scryptSync(p, s, 32)); };
const ADM = 'ange_adm';
/** Cookie des fichiers admin (12 h) posé pour un compte admin ; retiré sinon. */
export async function adminCookie(c: any, acc: { id: number; role: string }) {
  const secure = (c.req.header('x-forwarded-proto') ?? '').includes('https') || (process.env.PUBLIC_URL ?? '').startsWith('https');
  if (acc.role !== 'admin') { deleteCookie(c, ADM, { path: '/' }); return; }
  setCookie(c, ADM, await sign({ sub: acc.id, scope: 'admin-assets', exp: Math.floor(Date.now() / 1000) + 43200 }, env.jwt, 'HS256'), { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 43200, secure });
}
/** L'email admin ne reçoit le rôle que si aucun admin n'existe encore. */
export const bootstrapRole = async (email: string) => (email === env.adminEmail.toLowerCase() && !(await pool.query("SELECT 1 FROM accounts WHERE role='admin'")).rowCount ? 'admin' : 'player');
const Reg = z.object({ email: z.string().email('adresse email invalide').max(120), password: z.string().min(12, '12 caractères minimum').max(100), acceptTos: z.boolean().optional(),
  website: z.string().max(200).optional(), pow: z.object({ token: z.string().max(400), nonce: z.union([z.string().max(40), z.number()]) }).optional() });
const Log = z.object({ email: z.string().email('adresse email invalide'), password: z.string().min(1, 'mot de passe requis').max(200) });
def(authRoutes, 'get', '/auth/challenge', null, async () => issueChallenge());
def(authRoutes, 'post', '/auth/register', Reg, async (c, b) => {
  const email = b.email.trim().toLowerCase();
  if (b.website) fail(400, 'Inscription refusée');   // champ invisible pour un humain : rempli = robot
  if (botCheck()) { const bad = await verifyPow(b.pow?.token, b.pow?.nonce); if (bad) fail(400, bad); }
  const weak = passwordProblems(b.password, email); if (weak.length) fail(400, `Mot de passe trop faible : ${weak.join(' ; ')}`);
  // CGU acceptées à l'inscription (case du formulaire) : version en vigueur enregistrée (migration 40)
  const { rows } = await pool.query(`INSERT INTO accounts(email,password_hash,role,tos_version,tos_accepted_at) VALUES ($1,$2,$3,
    CASE WHEN $4 THEN (SELECT version FROM legal_pages WHERE key='cgu') END, CASE WHEN $4 THEN now() END) ON CONFLICT (email) DO NOTHING RETURNING id,role`, [email, hash(b.password), await bootstrapRole(email), !!b.acceptTos]);
  if (!rows[0]) fail(409, 'Cet email est déjà utilisé');
  await adminCookie(c, rows[0]);
  return { token: await signToken(rows[0].id, rows[0].role), admin: rows[0].role === 'admin', role: rows[0].role };   // connexion automatique après inscription
});
def(authRoutes, 'post', '/auth/login', Log, async (c, b) => {
  const email = b.email.trim().toLowerCase(), key = `loginfail:${email}`;
  if (rateOn() && (await peek(key, 900)) >= 8) fail(429, 'Trop d\'échecs de connexion pour ce compte : réessayez dans 15 min');
  const { rows: [a] } = await pool.query('SELECT * FROM accounts WHERE email=$1', [email]);
  if (a && !a.password_hash) fail(401, 'Ce compte se connecte avec Google');   // compte créé par Google (migration 39)
  if (!a || !check(b.password, a.password_hash)) { await hit(key, 900); fail(401, 'Email ou mot de passe incorrect'); }
  const role = a.role ?? (a.is_admin ? 'admin' : 'player'); await adminCookie(c, { id: a.id, role });
  return { token: await signToken(a.id, role), admin: role === 'admin', role };
});
def(authRoutes, 'get', '/auth/me', null, async c => {
  const { rows: [a] } = await pool.query('SELECT id,email,role FROM accounts WHERE id=$1', [c.get('acc').sub]); if (!a) fail(401, 'Compte inconnu');
  await adminCookie(c, a);   // session restaurée : cookie des fichiers admin renouvelé (ou retiré si le compte n'est plus admin)
  return { id: a.id, email: a.email, role: a.role, admin: a.role === 'admin' };
});
def(authRoutes, 'post', '/auth/logout', null, async c => { deleteCookie(c, ADM, { path: '/' }); return { ok: true }; });
/** Contrôle Nginx (auth_request) avant de servir le code de l'interface admin : cookie valide ET compte admin en base. */
authRoutes.get('/auth/admin-asset', async c => {
  try { const p: any = await verify(getCookie(c, ADM) ?? '', env.jwt, 'HS256'); if (p.scope !== 'admin-assets') throw new Error('portée');
    const { rows: [a] } = await pool.query('SELECT role FROM accounts WHERE id=$1', [p.sub]); if (a?.role === 'admin') return c.body(null, 204);
  } catch { /* refus */ }
  return c.body(null, 403);
});

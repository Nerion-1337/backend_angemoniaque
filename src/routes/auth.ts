import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { def, router, z } from '../lib/route.js'; import { pool, fail } from '../lib/db.js'; import { signToken } from '../middleware/auth.js'; import { env } from '../config/env.js';
export const authRoutes = router();
const hash = (p: string) => { const s = randomBytes(16).toString('hex'); return `${s}:${scryptSync(p, s, 32).toString('hex')}`; };
const check = (p: string, h: string) => { const [s, k] = h.split(':'); return timingSafeEqual(Buffer.from(k, 'hex'), scryptSync(p, s, 32)); };
const Reg = z.object({ email: z.string().email('adresse email invalide').max(120), password: z.string().min(8, '8 caractères minimum').max(100) });
const Log = z.object({ email: z.string().email('adresse email invalide'), password: z.string().min(1, 'mot de passe requis') });
def(authRoutes, 'post', '/auth/register', Reg, async (_c, b) => {
  const email = b.email.trim().toLowerCase();
  const { rows } = await pool.query('INSERT INTO accounts(email,password_hash,is_admin) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING RETURNING id,is_admin', [email, hash(b.password), email === env.adminEmail.toLowerCase()]);
  if (!rows[0]) fail(409, 'Cet email est déjà utilisé');
  return { token: await signToken(rows[0].id, rows[0].is_admin), admin: rows[0].is_admin };      // connexion automatique après inscription
});
def(authRoutes, 'post', '/auth/login', Log, async (_c, b) => {
  const { rows: [a] } = await pool.query('SELECT * FROM accounts WHERE email=$1', [b.email.trim().toLowerCase()]);
  if (!a || !check(b.password, a.password_hash)) fail(401, 'Email ou mot de passe incorrect');
  return { token: await signToken(a.id, a.is_admin), admin: a.is_admin };
});
def(authRoutes, 'get', '/auth/me', null, async c => {
  const { rows: [a] } = await pool.query('SELECT id,email,is_admin FROM accounts WHERE id=$1', [c.get('acc').sub]); if (!a) fail(401, 'Compte inconnu');
  return { id: a.id, email: a.email, admin: a.is_admin };
});

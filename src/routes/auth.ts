import { OpenAPIHono } from '@hono/zod-openapi'; import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { def, z } from '../lib/route.js'; import { pool, fail } from '../lib/db.js'; import { signToken } from '../middleware/auth.js'; import { env } from '../config/env.js';
export const authRoutes = new OpenAPIHono();
const hash = (p: string) => { const s = randomBytes(16).toString('hex'); return `${s}:${scryptSync(p, s, 32).toString('hex')}`; };
const check = (p: string, h: string) => { const [s, k] = h.split(':'); return timingSafeEqual(Buffer.from(k, 'hex'), scryptSync(p, s, 32)); };
const B = z.object({ email: z.string().email(), password: z.string().min(8) });
def(authRoutes, 'post', '/auth/register', B, async (_c, b) => {
  const { rows: [a] } = await pool.query('INSERT INTO accounts(email,password_hash,is_admin) VALUES ($1,$2,$3) RETURNING id,is_admin', [b.email, hash(b.password), b.email === env.adminEmail]);
  return { token: await signToken(a.id, a.is_admin), admin: a.is_admin };
});
def(authRoutes, 'post', '/auth/login', B, async (_c, b) => {
  const { rows: [a] } = await pool.query('SELECT * FROM accounts WHERE email=$1', [b.email]);
  if (!a || !check(b.password, a.password_hash)) fail(401, 'Identifiants invalides');
  return { token: await signToken(a.id, a.is_admin), admin: a.is_admin };
});

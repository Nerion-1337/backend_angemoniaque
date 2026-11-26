import { sign, verify } from 'hono/jwt'; import { env } from '../config/env.js';
export const signToken = (sub: number, role: string) => sign({ sub, role, exp: Math.floor(Date.now() / 1000) + 86400 }, env.jwt, 'HS256');
export const roleOf = (c: any) => c.get('acc')?.role ?? 'player';
export const auth = async (c: any, next: any) => {
  if (/^\/(auth\/(login|register|google\/)|ws|openapi)/.test(c.req.path)) return next();
  if (/^\/(forum|legal)(\/|$)/.test(c.req.path)) {   // annonces, forum, pages légales : lecture publique, jeton facultatif (les écritures l'exigent)
    try { c.set('acc', await verify((c.req.header('authorization') ?? '').replace('Bearer ', ''), env.jwt, 'HS256')); } catch { /* visiteur */ }
    return next();
  }
  try { c.set('acc', await verify((c.req.header('authorization') ?? '').replace('Bearer ', ''), env.jwt, 'HS256')); } catch { return c.json({ error: 'Non authentifié' }, 401); }
  await next();
};
export const admin = async (c: any, next: any) => roleOf(c) === 'admin' ? next() : c.json({ error: 'Réservé aux administrateurs' }, 403);
export const mod = async (c: any, next: any) => ['mod', 'admin'].includes(roleOf(c)) ? next() : c.json({ error: 'Réservé aux modérateurs' }, 403);

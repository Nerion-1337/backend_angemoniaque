import { sign, verify } from 'hono/jwt'; import { env } from '../config/env.js';
export const signToken = (sub: number, admin: boolean) => sign({ sub, admin, exp: Math.floor(Date.now() / 1000) + 86400 }, env.jwt, 'HS256');
export const auth = async (c: any, next: any) => {
  if (/^\/(auth\/(login|register)|ws|openapi)/.test(c.req.path)) return next();
  try { c.set('acc', await verify((c.req.header('authorization') ?? '').replace('Bearer ', ''), env.jwt, 'HS256')); } catch { return c.json({ error: 'Non authentifié' }, 401); }
  await next();
};
export const admin = async (c: any, next: any) => c.get('acc').admin ? next() : c.json({ error: 'Réservé aux administrateurs' }, 403);

import { sign, verify } from 'hono/jwt'; import { env } from '../config/env.js'; import { pool } from '../lib/db.js';
/**
 * Authentification par jeton Bearer (24 h). Sécurité :
 *  - un jeton à portée restreinte (`scope`, ex. cookie des fichiers admin) n'est JAMAIS accepté comme jeton d'API ;
 *  - les droits admin / modérateur sont relus EN BASE à chaque requête protégée (`dbRole`) : un compte rétrogradé, supprimé ou
 *    un jeton dont le rôle aurait été altéré n'y donne pas accès ; le rôle inscrit dans le jeton ne sert qu'à l'affichage.
 */
export const signToken = (sub: number, role: string) => sign({ sub, role, exp: Math.floor(Date.now() / 1000) + 86400 }, env.jwt, 'HS256');
const bearer = async (c: any) => { const p: any = await verify((c.req.header('authorization') ?? '').replace('Bearer ', ''), env.jwt, 'HS256'); if (p.scope || !Number.isInteger(p.sub)) throw new Error('portée'); return p; };
export const roleOf = (c: any) => c.get('acc')?.role ?? 'player';
/** Rôle du compte connecté lu en base (mis en cache pour la requête) ; 'guest' sans compte, compte inconnu ou bloqué. */
export async function dbRole(c: any): Promise<string> {
  if (c.get('dbRole')) return c.get('dbRole');
  const sub = c.get('acc')?.sub; let role = 'guest';
  if (sub) { const { rows: [a] } = await pool.query('SELECT role FROM accounts WHERE id=$1', [sub]); role = a?.role ?? 'guest'; }
  c.set('dbRole', role); return role;
}
export const auth = async (c: any, next: any) => {
  if (/^\/(auth\/(login|register|challenge|logout|admin-asset|google\/)|ws|openapi)/.test(c.req.path)) return next();
  if (/^\/(forum|legal|ranking)(\/|$)/.test(c.req.path)) {   // annonces, forum, pages légales, classement : lecture publique, jeton facultatif (les écritures l'exigent)
    try { c.set('acc', await bearer(c)); } catch { /* visiteur */ }
    return next();
  }
  try { c.set('acc', await bearer(c)); } catch { return c.json({ error: 'Non authentifié' }, 401); }
  await next();
};
export const admin = async (c: any, next: any) => (await dbRole(c)) === 'admin' ? next() : c.json({ error: 'Réservé aux administrateurs' }, 403);
export const mod = async (c: any, next: any) => ['mod', 'admin'].includes(await dbRole(c)) ? next() : c.json({ error: 'Réservé aux modérateurs' }, 403);

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js'; import { pub } from '../realtime/ws.js';
/**
 * Protections contre le spam et les robots.
 *  - IP du client : en-tête X-Real-IP posé par Nginx (écrasé à chaque requête, donc non falsifiable derrière Nginx).
 *  - Limitation de débit (`rateLimit`) : fenêtres fixes comptées dans Redis (repli en mémoire si Redis est absent), par IP ou
 *    par compte selon la règle ; 429 + Retry-After. Coupée par RATE_LIMIT=0 (tests).
 *  - Preuve de travail à l'inscription (`issueChallenge` / `verifyPow`) : le navigateur cherche un nonce tel que
 *    SHA-256(sel:nonce) commence par `bits` bits nuls (~1 s) ; jeton signé (HMAC), 10 min, à usage unique. Coupée par BOT_CHECK=0.
 *  - Politique de mot de passe (`passwordProblems`, miroir de front/src/lib/password.js).
 */
export const clientIp = (c: any) => (c.req.header('x-real-ip') ?? '').trim() || 'local';
/** Protection active : RATE_LIMIT / BOT_CHECK ≠ « 0 » ; sous Vitest, coupée sauf si le test la force à « 1 ». */
const on = (k: string) => (process.env.VITEST ? process.env[k] === '1' : process.env[k] !== '0');
const mem = new Map<string, { n: number; exp: number }>();
/** Incrémente le compteur `key` sur une fenêtre de `win` s ; renvoie { n, ttl }. */
export async function hit(key: string, win: number): Promise<{ n: number; ttl: number }> {
  const slot = Math.floor(Date.now() / 1000 / win), k = `rl:${key}:${slot}`, ttl = win - (Math.floor(Date.now() / 1000) % win);
  try { if (pub.status === 'ready') { const n = await pub.incr(k); if (n === 1) await pub.expire(k, win + 1); return { n, ttl }; } } catch { /* repli mémoire */ }
  const now = Date.now(), cur = mem.get(k); if (!cur || cur.exp < now) { mem.set(k, { n: 1, exp: now + win * 1000 }); if (mem.size > 50000) for (const [a, v] of mem) if (v.exp < now) mem.delete(a); return { n: 1, ttl }; }
  cur.n++; return { n: cur.n, ttl };
}
/** Lecture seule d'un compteur (sans l'incrémenter). */
export async function peek(key: string, win: number) {
  const slot = Math.floor(Date.now() / 1000 / win), k = `rl:${key}:${slot}`;
  try { if (pub.status === 'ready') return Number(await pub.get(k)) || 0; } catch { /* repli */ }
  const cur = mem.get(k); return cur && cur.exp > Date.now() ? cur.n : 0;
}
type Rule = { m: string; re: RegExp; max: number; win: number; by: 'ip' | 'acc'; name: string; msg?: string };
/** Règles (méthode, chemin, maximum, fenêtre en s, compté par IP ou par compte). */
export const RULES: Rule[] = [
  { m: '*', re: /^\//, max: 900, win: 60, by: 'ip', name: 'global' },
  { m: 'POST', re: /^\/auth\/register$/, max: 5, win: 3600, by: 'ip', name: 'register', msg: 'Trop de créations de compte depuis votre connexion' },
  { m: 'POST', re: /^\/auth\/login$/, max: 15, win: 300, by: 'ip', name: 'login', msg: 'Trop de tentatives de connexion' },
  { m: 'POST', re: /^\/auth\/google\/mock$/, max: 10, win: 300, by: 'ip', name: 'gmock' },
  { m: 'GET', re: /^\/auth\/(google\/start|challenge)$/, max: 30, win: 300, by: 'ip', name: 'authget' },
  { m: 'POST', re: /^\/messages$/, max: 15, win: 60, by: 'acc', name: 'chat', msg: 'Vous écrivez trop vite' },
  { m: 'POST', re: /^\/forum\/categories\/\d+\/topics$/, max: 3, win: 300, by: 'acc', name: 'ftopic', msg: 'Trop de nouveaux sujets : patientez quelques minutes' },
  { m: 'POST', re: /^\/forum\/topics\/\d+\/posts$/, max: 6, win: 60, by: 'acc', name: 'fpost', msg: 'Vous écrivez trop vite' },
  { m: 'POST', re: /^\/forum\/posts\/\d+\/report$/, max: 10, win: 3600, by: 'acc', name: 'freport' },
  { m: 'POST', re: /^\/guilds\/(posts|topics)$/, max: 8, win: 60, by: 'acc', name: 'gpost', msg: 'Vous écrivez trop vite' },
  { m: 'WRITE', re: /^\/(?!admin\/)/, max: 240, win: 60, by: 'acc', name: 'writes' },
];
const matches = (r: Rule, method: string, path: string) => (r.m === '*' || r.m === method || (r.m === 'WRITE' && method !== 'GET')) && r.re.test(path);
/** Middleware (après l'authentification) : applique chaque règle concernée ; une règle « compte » sans compte compte par IP. */
export const rateLimit = async (c: any, next: any) => {
  if (!on('RATE_LIMIT') || c.req.method === 'OPTIONS') return next();
  const method = c.req.method, path = c.req.path, acc = c.get('acc')?.sub;
  for (const r of RULES) if (matches(r, method, path)) {
    const who = r.by === 'acc' && acc ? `a${acc}` : `i${clientIp(c)}`, { n, ttl } = await hit(`${r.name}:${who}`, r.win);
    if (n > r.max) { c.header('Retry-After', String(ttl)); return c.json({ error: `${r.msg ?? 'Trop de requêtes'} : réessayez dans ${ttl < 90 ? `${ttl} s` : `${Math.ceil(ttl / 60)} min`}` }, 429); }
  }
  return next();
};
// ---------------------------------------------------------------- preuve de travail
const b64 = (s: string) => Buffer.from(s).toString('base64url'), sign = (s: string) => createHmac('sha256', env.jwt).update(`pow:${s}`).digest('base64url');
export const powBits = () => Math.min(24, Math.max(8, Number(process.env.POW_BITS) || 16));
export const botCheck = () => on('BOT_CHECK');
export const rateOn = () => on('RATE_LIMIT');
export function issueChallenge(bits = powBits(), ttlS = 600) {
  const body = b64(JSON.stringify({ s: randomBytes(12).toString('hex'), b: bits, e: Date.now() + ttlS * 1000 }));
  return { token: `${body}.${sign(body)}`, bits };
}
/** Bits nuls en tête d'un condensé. */
export const leadingZeroBits = (buf: Buffer) => { let n = 0; for (const x of buf) { if (x === 0) { n += 8; continue; } n += Math.clz32(x) - 24; break; } return n; };
const used = new Map<string, number>();
/** Vérifie une preuve : signature, expiration, difficulté, usage unique. Renvoie le motif du refus, ou null. */
export async function verifyPow(token: unknown, nonce: unknown): Promise<string | null> {
  if (typeof token !== 'string' || (typeof nonce !== 'string' && typeof nonce !== 'number')) return 'Vérification anti-robot manquante : rechargez la page';
  const [body, sig] = token.split('.'); if (!body || !sig) return 'Vérification anti-robot invalide';
  const want = Buffer.from(sign(body)), got = Buffer.from(sig); if (want.length !== got.length || !timingSafeEqual(want, got)) return 'Vérification anti-robot invalide';
  let ch: any; try { ch = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return 'Vérification anti-robot invalide'; }
  if (!(ch.e > Date.now())) return 'Vérification anti-robot expirée : réessayez';
  if (leadingZeroBits(createHash('sha256').update(`${ch.s}:${nonce}`).digest()) < ch.b) return 'Vérification anti-robot échouée';
  try { if (pub.status === 'ready') { if ((await pub.set(`pow:${ch.s}`, '1', 'EX', 660, 'NX')) !== 'OK') return 'Vérification anti-robot déjà utilisée'; return null; } } catch { /* repli */ }
  const now = Date.now(); for (const [k, e] of used) if (e < now) used.delete(k); if (used.has(ch.s)) return 'Vérification anti-robot déjà utilisée'; used.set(ch.s, ch.e); return null;
}
// ---------------------------------------------------------------- mot de passe (miroir de front/src/lib/password.js)
const COMMON = ['password', 'motdepasse', 'azerty', 'qwerty', 'qwertz', 'abc', 'admin', 'welcome', 'bienvenue', 'soleil', 'bonjour', 'iloveyou', 'jetaime', 'dragon', 'monkey', 'football', 'letmein', 'angemoniaque', 'master', 'secret', 'princesse', 'loulou', 'chouchou'];
const SEQ = '0123456789 abcdefghijklmnopqrstuvwxyz azertyuiop qsdfghjklm wxcvbn qwertyuiop asdfghjkl zxcvbnm';
export function passwordClasses(pw: string) { return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length; }
/** Entropie estimée (bits) : longueur × log2(taille de l'alphabet utilisé), pénalisée par les répétitions. */
export function passwordBits(pw: string) {
  const pool = (/[a-z]/.test(pw) ? 26 : 0) + (/[A-Z]/.test(pw) ? 26 : 0) + (/[0-9]/.test(pw) ? 10 : 0) + (/[^A-Za-z0-9]/.test(pw) ? 33 : 0);
  const uniq = new Set(pw).size; return pool ? Math.round(Math.min(pw.length, uniq * 1.5) * Math.log2(pool)) : 0;
}
/** Problèmes d'un mot de passe (vide = accepté) : 12 caractères, 3 types sur 4, ≥ 60 bits, pas de mot courant, de suite ni d'email. */
export function passwordProblems(pw: string, email = '') {
  const out: string[] = [], low = pw.toLowerCase(), local = email.split('@')[0]?.toLowerCase() ?? '';
  if (pw.length < 12) out.push('12 caractères minimum');
  if (passwordClasses(pw) < 3) out.push('au moins 3 types : minuscules, majuscules, chiffres, symboles');
  if (COMMON.some(w => low.replace(/[^a-z]/g, '').includes(w) && w.length >= 4)) out.push('pas de mot trop courant (password, azerty, admin…)');
  if (/(.)\1{3,}/.test(pw)) out.push('pas plus de 3 caractères identiques à la suite');
  for (let i = 0; i + 4 <= low.length; i++) if (SEQ.includes(low.slice(i, i + 4))) { out.push('pas de suite évidente (1234, abcd, azer…)'); break; }
  if (local.length >= 4 && low.includes(local)) out.push('ne doit pas contenir votre adresse email');
  if (!out.length && passwordBits(pw) < 60) out.push('trop prévisible : allongez-le ou variez les caractères');
  return out;
}

import { randomBytes } from 'node:crypto';
/** Secret de signature des jetons : JWT_SECRET (≥ 16 caractères, pas une valeur d'exemple). Sinon, secret aléatoire propre au
 *  processus (les sessions tombent au redémarrage) : jamais de secret connu, qui permettrait de forger un jeton admin. */
const WEAK = new Set(['dev-secret', 'change-me-too', 'change-me', 'secret', 'changeme']);
function jwtSecret() {
  const s = process.env.JWT_SECRET ?? '';
  if (s.length >= 16 && !WEAK.has(s)) return s;
  console.warn('[sécurité] JWT_SECRET absent, trop court ou d\'exemple : secret aléatoire utilisé (sessions perdues au redémarrage). Réglez JWT_SECRET dans infra/.env.');
  return randomBytes(48).toString('hex');
}
export const env = { pg: process.env.DATABASE_URL ?? 'postgres://ange:ange@localhost:5432/angemoniaque', redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: jwtSecret(), adminEmail: process.env.ADMIN_EMAIL ?? 'admin@ange.local', port: 3000 };

import { pool } from '../lib/db.js'; import { hourlyTick } from '../routes/tick.js';
/**
 * Horloge du monde persistante (table game_clock, migration 17).
 * Le temps de jeu avance même serveur arrêté : à chaque appel, on rejoue UN tick horaire par heure pleine
 * écoulée depuis last_tick_at, et on avance last_tick_at d'une heure après chaque tick (le reste < 1 h est
 * conservé pour le prochain appel). Au-delà de MAX_CATCHUP_H heures d'arrêt, les heures les plus anciennes
 * sont abandonnées (borne de charge). Un verrou consultatif Postgres sérialise les instances : jamais deux
 * rattrapages simultanés, donc jamais une heure comptée deux fois.
 */
export const MAX_CATCHUP_H = 24 * 30;
const LOCK = 74_2026_11;   // clé du verrou consultatif (arbitraire, propre au jeu)
export const hoursDue = (last: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - last.getTime()) / 3600e3));
/** Rattrape les ticks dus. Retourne le nombre de ticks appliqués. `tick` est injectable (tests). */
export async function catchUp(now: () => Date = () => new Date(), tick: () => Promise<void> = hourlyTick): Promise<number> {
  const db = await pool.connect();
  let applied = 0;
  try {
    await db.query('SELECT pg_advisory_lock($1)', [LOCK]);
    let { rows: [r] } = await db.query('SELECT last_tick_at FROM game_clock WHERE id=1');
    if (!r) { await db.query('INSERT INTO game_clock(id,last_tick_at) VALUES (1,now()) ON CONFLICT (id) DO NOTHING'); return 0; }
    let due = hoursDue(new Date(r.last_tick_at), now());
    if (due > MAX_CATCHUP_H) {   // arrêt très long : on ne rejoue que les MAX_CATCHUP_H dernières heures
      await db.query('UPDATE game_clock SET last_tick_at=last_tick_at+make_interval(hours=>$1) WHERE id=1', [due - MAX_CATCHUP_H]);
      due = MAX_CATCHUP_H;
    }
    for (let i = 0; i < due; i++) {
      await tick();
      await db.query("UPDATE game_clock SET last_tick_at=last_tick_at+interval '1 hour' WHERE id=1");
      applied++;
    }
    if (applied) console.log(`horloge : ${applied} tick(s) horaire(s) rattrapé(s)`);
    return applied;
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [LOCK]).catch(() => {});
    db.release();
  }
}
/** Démarrage serveur : rattrapage immédiat puis vérification chaque minute (un tick part au plus ~1 min après l'heure). */
export function startClock(everyMs = 60_000) {
  const run = () => catchUp().catch(e => console.error('horloge :', e.message));
  run();
  return setInterval(run, everyMs);
}

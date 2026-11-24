import { pool } from '../lib/db.js';
/**
 * Cache des paramètres globaux (game_config) et invalideur du cache de contenu :
 * chaque écriture d'administration appelle bumpContent() pour repartir de la base.
 */
let cfg: Record<string, any> | null = null;
export const cfgAll = async (): Promise<Record<string, any>> => {
  if (!cfg) {
    const { rows } = await pool.query('SELECT key,value FROM game_config');
    cfg = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  }
  return cfg;
};
export const cfgNum = async (key: string, def: number) => (await cfgAll())[key] ?? def;
/** Appelé par les routes admin après toute mutation de contenu/config. */
export const bumpContent = () => { cfg = null; };
/** Plafond global des objets divins d'une famille (table divine_families, migration 16) : null = illimité.
 *  Repli sur game_config.divine_caps si la table n'existe pas encore. */
export const divineCap = async (kind: string | null): Promise<number | null> => {
  try {
    const { rows: [f] } = await pool.query('SELECT key, cap FROM divine_families WHERE key=$1', [kind]);
    if (f && f.key === kind) return f.cap ?? null;
  } catch { /* base sans migration 16 */ }
  const caps = ((await cfgAll()).divine_caps ?? {}) as Record<string, number>;
  return caps[kind ?? ''] ?? null;
};

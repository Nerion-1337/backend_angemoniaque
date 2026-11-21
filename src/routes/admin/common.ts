import { pool, fail } from '../../lib/db.js';
/** Table par type d'entité + colonnes « sûres » (INSERT/UPDATE ne touchent que celles-ci, vérifiées en base). */
export const TABLE: Record<string, string> = { monster: 'monsters', item: 'items', mount: 'mounts', building: 'buildings' };
/** Raretés (onglets admin Objets/Sorts) : « divin » regroupe les objets uniques
 *  artefacts/arcanes/reliques (table divine_items). */
export const RARITIES = ['commun', 'rare', 'epique', 'legendaire', 'divin'] as const;
/** Qui peut s'équiper (objet) / apprendre (sort) : sous-ensemble de ces 6 kinds. */
export const USABLE_KINDS = ['humain', 'ange', 'demon', 'monstre', 'structure', 'monture'] as const;
/** Le paramètre d'URL est le nom PLURIEL (monsters/items/...) ; la classe stockée est singulière (monster/item/...). */
export const URL_KIND: Record<string, string> = { monsters: 'monster', items: 'item', mounts: 'mount', buildings: 'building' };
export const kindOf = (url: string) => { const k = URL_KIND[url]; if (!k) fail(400, `Type inconnu : ${url}`); return k; };
export const colsOf = async (table: string) =>
  (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='game_schema' AND table_name=$1", [table])).rows.map((r: any) => r.column_name);
export const jsonable = (v: any) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
/** INSERT limité aux colonnes existantes de la table (clés inconnues ignorées, valeurs objets → JSONB). */
export const safeInsert = async (table: string, data: any) => {
  const cols = (await colsOf(table)).filter((c: string) => data[c] !== undefined);
  if (!cols.includes('name') || data.name === undefined) fail(400, 'Nom manquant');
  const vals = cols.map(c => jsonable(data[c]));
  const { rows: [row] } = await pool.query(`INSERT INTO ${table}(${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, vals);
  return row;
};
/** UPDATE limité aux colonnes existantes ; retourne la ligne complète. */
export const safeUpdate = async (table: string, id: number, data: any) => {
  const cols = (await colsOf(table)).filter(c => data[c] !== undefined);
  if (!cols.length) fail(400, 'Aucun champ valide');
  const set = cols.map((c, i) => `${c}=$${i + 1}`).join(',');
  const { rows: [row] } = await pool.query(`UPDATE ${table} SET ${set} WHERE id=$${cols.length + 1} RETURNING *`, [...cols.map(c => jsonable(data[c])), id]);
  if (!row) fail(404, 'Inconnu');
  return row;
};
export const requireRow = async (table: string, id: number) => {
  const { rows: [row] } = await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [id]);
  if (!row) fail(404, `${table} n°${id} inconnu`);
  return row;
};
/** Règles transverses (coûts / caps / modificateurs) d'une entité — jointes aux GET de détail. */
export const extras = async (kind: string, refId: number) => ({
  costs: (await pool.query('SELECT * FROM entity_costs WHERE kind=$1 AND ref_id=$2 ORDER BY resource', [kind, refId])).rows,
  caps: (await pool.query('SELECT * FROM entity_caps WHERE kind=$1 AND ref_id=$2 ORDER BY scope', [kind, refId])).rows,
  modifiers: (await pool.query('SELECT * FROM entity_modifiers WHERE kind=$1 AND ref_id=$2 ORDER BY id', [kind, refId])).rows
});

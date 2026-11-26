import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { resourceExists } from '../../game/startKit.js';
/** Section admin « Parchemins » : un parchemin (objet du catalogue) + des ressources → un objet, un sort ou un bâtiment (copie d'un modèle). */
export const recipeRoutes = router();
const TABLE: Record<string, string> = { item: 'items', spell: 'spells', building: 'buildings' };
const Recipe = z.object({
  scrollItemId: z.number().int().optional(),
  /** Création d'un nouvel objet parchemin (slot « scroll ») à la volée, si scrollItemId est absent. */
  newScrollName: z.string().trim().min(2).max(80).optional(),
  targetKind: z.enum(['item', 'spell', 'building']),
  targetId: z.number().int(),
  qtyOut: z.number().int().min(1).max(999).default(1),
  resources: z.record(z.number().int().min(1).max(1e6)).default({}),
  consumeScroll: z.boolean().default(true),
  atCapital: z.boolean().default(false),
  energyCost: z.number().int().min(0).max(1000).default(0),
  divineEnergyCost: z.number().int().min(0).max(1000).default(0)
});
const check = async (b: any) => {
  if (!(await pool.query(`SELECT 1 FROM ${TABLE[b.targetKind]} WHERE id=$1`, [b.targetId])).rowCount) fail(404, 'Cible inconnue');
  const bad = Object.keys(b.resources ?? {}).filter(id => !resourceExists(id)); if (bad.length) fail(404, `Ressource(s) inconnue(s) : ${bad.join(', ')}`);
  if (b.targetKind !== 'item' && b.qtyOut !== 1) fail(400, 'Quantité produite : 1 pour un sort ou un bâtiment');
};
const scrollOf = async (b: any) => {
  if (b.scrollItemId) {
    if (!(await pool.query('SELECT 1 FROM items WHERE id=$1', [b.scrollItemId])).rowCount) fail(404, 'Parchemin inconnu');
    return b.scrollItemId;
  }
  if (!b.newScrollName) fail(400, 'Choisir un parchemin existant ou nommer un nouveau parchemin');
  const { rows: [it] } = await pool.query("INSERT INTO items(name,slot,rarity,shop,data) VALUES ($1,'scroll','commun',false,'{\"kind\":\"recipe\"}') RETURNING id", [b.newScrollName]);
  return it.id;
};
const LIST = `SELECT r.*, i.name scroll_name,
  CASE r.target_kind WHEN 'item' THEN (SELECT name FROM items WHERE id=r.target_id) WHEN 'spell' THEN (SELECT name FROM spells WHERE id=r.target_id)
    ELSE (SELECT name FROM buildings WHERE id=r.target_id) END target_name
  FROM recipes r JOIN items i ON i.id=r.scroll_item_id`;
def(recipeRoutes, 'get', '/admin/content/recipes', null, async () => (await pool.query(`${LIST} ORDER BY r.id`)).rows);
def(recipeRoutes, 'post', '/admin/content/recipes', Recipe, async (c, b) => {
  await check(b);
  const scroll = await scrollOf(b);
  const { rows: [row] } = await pool.query(
    `INSERT INTO recipes(scroll_item_id,target_kind,target_id,qty_out,resources,consume_scroll,at_capital,energy_cost,divine_energy_cost)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (scroll_item_id) DO NOTHING RETURNING *`,
    [scroll, b.targetKind, b.targetId, b.qtyOut, JSON.stringify(b.resources), b.consumeScroll, b.atCapital, b.energyCost, b.divineEnergyCost]);
  if (!row) fail(409, 'Ce parchemin a déjà une recette');
  await bumpContent(); await audit(c, 'recipe.create', 'recipe', row.id, null, b);
  return row;
});
def(recipeRoutes, 'put', '/admin/content/recipes/{id}', Recipe, async (c, b) => {
  await check(b);
  const { rows: [before] } = await pool.query('SELECT * FROM recipes WHERE id=$1', [P(c, 'id')]);
  if (!before) fail(404, 'Recette inconnue');
  const scroll = b.scrollItemId ?? before.scroll_item_id;
  const { rows: [row] } = await pool.query(
    `UPDATE recipes SET scroll_item_id=$2,target_kind=$3,target_id=$4,qty_out=$5,resources=$6,consume_scroll=$7,at_capital=$8,energy_cost=$9,divine_energy_cost=$10 WHERE id=$1 RETURNING *`,
    [P(c, 'id'), scroll, b.targetKind, b.targetId, b.qtyOut, JSON.stringify(b.resources), b.consumeScroll, b.atCapital, b.energyCost, b.divineEnergyCost]);
  await bumpContent(); await audit(c, 'recipe.update', 'recipe', P(c, 'id'), before, row);
  return row;
});
def(recipeRoutes, 'delete', '/admin/content/recipes/{id}', null, async c => {
  const r = await pool.query('DELETE FROM recipes WHERE id=$1 RETURNING *', [P(c, 'id')]);
  if (!r.rowCount) fail(404, 'Recette inconnue');
  await bumpContent(); await audit(c, 'recipe.delete', 'recipe', P(c, 'id'), r.rows[0], null);
  return { ok: true };
});

import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent, divineCap } from '../../game/content.js';
import { safeInsert, safeUpdate, requireRow, extras } from './common.js';
export const itemRoutes = router();
const Item = z.object({
  name: z.string().max(80), slot: z.string().max(30).optional(), rarity: z.string().max(20).optional(),
  quantity_max: z.number().int().optional(), price: z.number().int().optional(), shop: z.boolean().optional(),
  shop_stock: z.number().int().optional(), durability: z.number().int().optional(),
  armor: z.number().int().optional(), strength_bonus: z.number().int().optional(), agility_bonus: z.number().int().optional(),
  req_strength: z.number().int().optional(), weapon_damage: z.number().int().optional(), magic_armor: z.number().int().optional(),
  data: z.record(z.any()).optional()
});
def(itemRoutes, 'get', '/admin/content/items', null, async c => {
  const q = c.req.query('q'), kind = c.req.query('kind');
  const like = q && kind !== 'divine' ? 'WHERE name ILIKE $1' : '';
  const { rows } = kind === 'divine'
    ? await pool.query(`SELECT di.*,COALESCE(ch.pseudo,'libre') holder,mo.name guardian FROM divine_items di LEFT JOIN characters ch ON ch.id=di.holder_character_id LEFT JOIN monsters mo ON mo.id=di.guardian_monster_id ORDER BY di.kind,di.id`)
    : await pool.query(`SELECT * FROM items ${like} ORDER BY id`, like ? [`%${q}%`] : []);
  return rows;
});
def(itemRoutes, 'post', '/admin/content/items', Item, async (c, b) => {
  const row = await safeInsert('items', b as any);
  await bumpContent(); await audit(c, 'item.create', 'item', row.id, null, b);
  return row;
});
def(itemRoutes, 'get', '/admin/content/items/{id}', null, async c => {
  const id = P(c, 'id');
  return { ...(await requireRow('items', id)), ...(await extras('item', id)) };
});
def(itemRoutes, 'put', '/admin/content/items/{id}', Item.partial(), async (c, b) => {
  const row = await safeUpdate('items', P(c, 'id'), b as any);
  await bumpContent(); await audit(c, 'item.update', 'item', P(c, 'id'), null, b);
  return row;
});
def(itemRoutes, 'delete', '/admin/content/items/{id}', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM character_items WHERE item_id=$1', [id])).rowCount) fail(409, 'Objet détenu par des joueurs');
  await pool.query('DELETE FROM items WHERE id=$1', [id]);
  await bumpContent(); await audit(c, 'item.delete', 'item', id, null, null);
  return { ok: true };
});
// ---- Arcanes, Reliques, Artefacts (objets uniques : plafond global, jamais de duplication) ----
def(itemRoutes, 'get', '/admin/content/divine', null, async c => {
  const kind = c.req.query('kind');
  const { rows } = await pool.query(
    `SELECT di.*,COALESCE(ch.pseudo,'libre') holder,mo.name guardian FROM divine_items di
     LEFT JOIN characters ch ON ch.id=di.holder_character_id LEFT JOIN monsters mo ON mo.id=di.guardian_monster_id
     ${kind ? 'WHERE di.kind=$1' : ''} ORDER BY di.kind,di.id`, kind ? [kind] : []);
  return rows;
});
def(itemRoutes, 'post', '/admin/content/divine', z.object({
  kind: z.enum(['relique', 'arcane', 'artefact']), guardian_monster_id: z.number().int().optional(), n: z.number().int().min(1).max(20).default(1)
}), async (c, b) => {
  const cap = await divineCap(b.kind);
  const { rows: [ex] } = await pool.query('SELECT count(*)::int n FROM divine_items WHERE kind=$1', [b.kind]);
  if (cap !== null && ex.n + b.n > cap) fail(409, `Plafond de ${cap} ${b.kind}(s) (il en existe ${ex.n})`);
  for (let i = 0; i < b.n; i++)
    await pool.query('INSERT INTO divine_items(kind,guardian_monster_id) VALUES ($1,$2)', [b.kind, b.guardian_monster_id ?? null]);
  await bumpContent(); await audit(c, 'divine.create', 'divine', null, null, b);
  return { ok: true, created: b.n, cap };
});

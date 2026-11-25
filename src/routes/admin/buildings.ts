import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { safeInsert, safeUpdate, requireRow, extras } from './common.js';
export const buildingRoutes = router();
const Building = z.object({
  name: z.string().max(80), kind: z.string().max(30).optional(), invulnerable: z.boolean().optional(), owner_id: z.number().int().optional(),
  structure: z.number().int().optional(), size: z.number().int().optional(),
  prerequisites: z.record(z.any()).optional(), data: z.record(z.any()).optional(),
  /** Lot 4 : armure de la structure ; case occupable ; bonus de l'occupant ; attaques possibles contre l'occupant. */
  armor: z.number().int().min(0).optional(), occupiable: z.boolean().optional(),
  bonus_armor: z.number().int().optional(), bonus_magic_armor: z.number().int().optional(), bonus_see: z.number().int().optional(), bonus_range: z.number().int().optional(),
  occupant_attack: z.object({ melee: z.boolean(), ranged: z.boolean(), spell: z.boolean() }).optional()
});
def(buildingRoutes, 'get', '/admin/content/buildings', null, async c => {
  const q = c.req.query('q');
  const { rows } = q ? await pool.query('SELECT b.*,ch.pseudo owner FROM buildings b LEFT JOIN characters ch ON ch.id=b.owner_id WHERE b.name ILIKE $1 ORDER BY b.name', [`%${q}%`])
    : await pool.query('SELECT b.*,ch.pseudo owner FROM buildings b LEFT JOIN characters ch ON ch.id=b.owner_id ORDER BY b.name');
  return rows;
});
def(buildingRoutes, 'post', '/admin/content/buildings', Building, async (c, b) => {
  const row = await safeInsert('buildings', b as any);
  await bumpContent(); await audit(c, 'building.create', 'building', row.id, null, b);
  return row;
});
def(buildingRoutes, 'get', '/admin/content/buildings/{id}', null, async c => {
  const id = P(c, 'id');
  return { ...(await requireRow('buildings', id)), ...(await extras('building', id)),
    position: (await pool.query('SELECT map_id,coord_x,coord_y FROM positions WHERE building_id=$1', [id])).rows[0] ?? null };
});
def(buildingRoutes, 'put', '/admin/content/buildings/{id}', Building.partial(), async (c, b) => {
  const row = await safeUpdate('buildings', P(c, 'id'), b as any);
  await bumpContent(); await audit(c, 'building.update', 'building', P(c, 'id'), null, b);
  return row;
});
def(buildingRoutes, 'delete', '/admin/content/buildings/{id}', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM positions WHERE building_id=$1', [id])).rowCount) fail(409, 'Bâtiment placé sur une carte : supprimez d\'abord sa position');
  await pool.query('DELETE FROM buildings WHERE id=$1', [id]);
  await bumpContent(); await audit(c, 'building.delete', 'building', id, null, null);
  return { ok: true };
});
/** Sorts liés à un bâtiment (entity_spells, lot 4) : actifs = lançables par le propriétaire à côté, passifs = appliqués chaque heure. */
def(buildingRoutes, 'get', '/admin/content/buildings/{id}/spells', null, async c => (await pool.query(
  "SELECT es.id, es.spell_id, es.mode, s.name, s.effects FROM entity_spells es JOIN spells s ON s.id=es.spell_id WHERE es.kind='building' AND es.ref_id=$1 ORDER BY s.name", [P(c, 'id')])).rows);

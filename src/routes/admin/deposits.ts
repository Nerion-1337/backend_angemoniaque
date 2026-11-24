import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { resourceExists } from '../../game/startKit.js'; import { resName } from '../../game/deposits.js';
/** Section admin « Ressources » : gisements (ressource, zone d'un monde, stock, régénération, rendement par récolte). */
export const depositRoutes = router();
const Deposit = z.object({
  mapId: z.number().int(), xMin: z.number().int().min(0), yMin: z.number().int().min(0), xMax: z.number().int().min(0), yMax: z.number().int().min(0),
  resource: z.string().max(60), stockMax: z.number().int().min(1).max(1e9), stock: z.number().int().min(0).max(1e9).optional(),
  regenPerH: z.number().int().min(0).max(1e9).default(0), yieldPerHarvest: z.number().int().min(1).max(1e6).default(1), active: z.boolean().default(true)
});
const check = async (b: any) => {
  const { rows: [m] } = await pool.query('SELECT width w, height h FROM maps WHERE id=$1', [b.mapId]);
  if (!m) fail(404, 'Monde inconnu');
  if (b.xMax < b.xMin || b.yMax < b.yMin) fail(400, 'Zone invalide (max < min)');
  if (b.xMax >= m.w || b.yMax >= m.h) fail(400, `Zone hors du monde (${m.w}×${m.h})`);
  if (!resourceExists(b.resource)) fail(404, `Ressource inconnue : ${b.resource}`);
};
const vals = (b: any) => [b.mapId, b.xMin, b.yMin, b.xMax, b.yMax, b.resource, Math.min(b.stock ?? b.stockMax, b.stockMax), b.stockMax, b.regenPerH, b.yieldPerHarvest, b.active];
def(depositRoutes, 'get', '/admin/content/deposits', null, async c => {
  const mapId = c.req.query('mapId');
  const { rows } = await pool.query(`SELECT * FROM resource_deposits ${mapId ? 'WHERE map_id=$1' : ''} ORDER BY map_id, id`, mapId ? [Number(mapId)] : []);
  return rows.map((r: any) => ({ ...r, resource_name: resName(r.resource) }));
});
def(depositRoutes, 'post', '/admin/content/deposits', Deposit, async (c, b) => {
  await check(b);
  const { rows: [row] } = await pool.query(`INSERT INTO resource_deposits(map_id,x_min,y_min,x_max,y_max,resource,stock,stock_max,regen_per_h,yield_per_harvest,active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, vals(b));
  await bumpContent(); await audit(c, 'deposit.create', 'deposit', row.id, null, b);
  return row;
});
def(depositRoutes, 'put', '/admin/content/deposits/{id}', Deposit, async (c, b) => {
  await check(b);
  const { rows: [row] } = await pool.query(`UPDATE resource_deposits SET map_id=$1,x_min=$2,y_min=$3,x_max=$4,y_max=$5,resource=$6,stock=$7,stock_max=$8,regen_per_h=$9,yield_per_harvest=$10,active=$11
    WHERE id=$12 RETURNING *`, [...vals(b), P(c, 'id')]);
  if (!row) fail(404, 'Gisement inconnu');
  await bumpContent(); await audit(c, 'deposit.update', 'deposit', P(c, 'id'), null, b);
  return row;
});
def(depositRoutes, 'delete', '/admin/content/deposits/{id}', null, async c => {
  const r = await pool.query('DELETE FROM resource_deposits WHERE id=$1 RETURNING *', [P(c, 'id')]);
  if (!r.rowCount) fail(404, 'Gisement inconnu');
  await bumpContent(); await audit(c, 'deposit.delete', 'deposit', P(c, 'id'), r.rows[0], null);
  return { ok: true };
});

import { def, router, z, P } from '../../lib/route.js'; import { pool, fail, tx } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { resourceExists } from '../../game/startKit.js'; import { Activation, checkActivation, describeActivation } from '../../game/activation.js'; import { resName, shareTotals, KINDS } from '../../game/deposits.js';
/**
 * Section admin « Ressources » : secteurs (zone d'un monde, nom, actif) et leurs ressources (part de cases %, type de case
 * éventuel, stock, régénération, rendement par récolte). Somme des parts ≤ 100 % pour chaque type de case.
 */
export const depositRoutes = router();
const Share = z.object({
  resource: z.string().max(60), percent: z.number().int().min(1).max(100), kind: z.enum(KINDS as [string, ...string[]]).nullable().optional(),
  stockMax: z.number().int().min(1).max(1e9), stock: z.number().int().min(0).max(1e9).optional(),
  regenPerH: z.number().int().min(0).max(1e9).default(0), yieldPerHarvest: z.number().int().min(1).max(1e6).default(1),
});
const Sector = z.object({
  mapId: z.number().int(), name: z.string().max(60).default(''), xMin: z.number().int().min(0), yMin: z.number().int().min(0), xMax: z.number().int().min(0), yMax: z.number().int().min(0),
  active: z.boolean().default(true), resources: z.array(Share).min(1).max(20),
});
const KIND_FR: any = { plain: 'plaine', forest: 'forêt', mountain: 'massif', arid: 'terre aride', snow: 'pics glacés', ether: 'pics d’éther', volcano: 'volcan', shallow: 'eau peu profonde', deep: 'eau profonde' };
const check = async (b: any) => {
  const { rows: [m] } = await pool.query('SELECT width w, height h FROM maps WHERE id=$1', [b.mapId]);
  if (!m) fail(404, 'Monde inconnu');
  if (b.xMax < b.xMin || b.yMax < b.yMin) fail(400, 'Zone invalide (max < min)');
  if (b.xMax >= m.w || b.yMax >= m.h) fail(400, `Zone hors du monde (${m.w}×${m.h})`);
  for (const s of b.resources) if (!resourceExists(s.resource)) fail(404, `Ressource inconnue : ${s.resource}`);
  if (new Set(b.resources.map((s: any) => s.resource)).size < b.resources.length) fail(400, 'Une ressource figure deux fois dans le secteur');
  const over = Object.entries(shareTotals(b.resources)).filter(([, v]) => (v as number) > 100);
  if (over.length) fail(400, `Parts supérieures à 100 % : ${over.map(([k, v]) => `${KIND_FR[k]} ${v} %`).join(', ')}`);
};
const LIST = `SELECT d.*, COALESCE(json_agg(json_build_object('id', r.id, 'resource', r.resource, 'percent', r.percent, 'kind', r.kind, 'stock', r.stock, 'stock_max', r.stock_max,
    'regen_per_h', r.regen_per_h, 'yield_per_harvest', r.yield_per_harvest) ORDER BY r.id) FILTER (WHERE r.id IS NOT NULL), '[]') resources
  FROM resource_deposits d LEFT JOIN deposit_resources r ON r.deposit_id=d.id`;
const named = (d: any) => ({ ...d, resources: d.resources.map((r: any) => ({ ...r, resource_name: resName(r.resource) })) });
const one = async (db: any, id: number) => named((await db.query(`${LIST} WHERE d.id=$1 GROUP BY d.id`, [id])).rows[0]);
/** Remplace les ressources du secteur ; stock absent → plein. */
const writeShares = async (db: any, id: number, shares: any[]) => {
  await db.query('DELETE FROM deposit_resources WHERE deposit_id=$1', [id]);
  for (const s of shares) await db.query(`INSERT INTO deposit_resources(deposit_id,resource,percent,kind,stock,stock_max,regen_per_h,yield_per_harvest) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, s.resource, s.percent, s.kind ?? null, Math.min(s.stock ?? s.stockMax, s.stockMax), s.stockMax, s.regenPerH, s.yieldPerHarvest]);
};
def(depositRoutes, 'get', '/admin/content/deposits', null, async c => {
  const mapId = c.req.query('mapId');
  const { rows } = await pool.query(`${LIST} ${mapId ? 'WHERE d.map_id=$1' : ''} GROUP BY d.id ORDER BY d.map_id, d.id`, mapId ? [Number(mapId)] : []);
  return rows.map(named);
});
def(depositRoutes, 'post', '/admin/content/deposits', Sector, async (c, b) => {
  await check(b);
  const row = await tx(async db => {
    const { rows: [d] } = await db.query('INSERT INTO resource_deposits(map_id,name,x_min,y_min,x_max,y_max,active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [b.mapId, b.name, b.xMin, b.yMin, b.xMax, b.yMax, b.active]);
    await writeShares(db, d.id, b.resources); return one(db, d.id);
  });
  await bumpContent(); await audit(c, 'deposit.create', 'deposit', row.id, null, b);
  return row;
});
def(depositRoutes, 'put', '/admin/content/deposits/{id}', Sector, async (c, b) => {
  await check(b);
  const row = await tx(async db => {
    const r = await db.query('UPDATE resource_deposits SET map_id=$1,name=$2,x_min=$3,y_min=$4,x_max=$5,y_max=$6,active=$7 WHERE id=$8',
      [b.mapId, b.name, b.xMin, b.yMin, b.xMax, b.yMax, b.active, P(c, 'id')]);
    if (!r.rowCount) fail(404, 'Secteur inconnu');
    await writeShares(db, P(c, 'id'), b.resources); return one(db, P(c, 'id'));
  });
  await bumpContent(); await audit(c, 'deposit.update', 'deposit', P(c, 'id'), null, b);
  return row;
});
def(depositRoutes, 'delete', '/admin/content/deposits/{id}', null, async c => {
  const r = await pool.query('DELETE FROM resource_deposits WHERE id=$1 RETURNING *', [P(c, 'id')]);
  if (!r.rowCount) fail(404, 'Secteur inconnu');
  await bumpContent(); await audit(c, 'deposit.delete', 'deposit', P(c, 'id'), r.rows[0], null);
  return { ok: true };
});

/** Conditions de récolte par ressource (migration 31) : groupes alternatifs ; aucun groupe = récolte libre (ligne supprimée). */
def(depositRoutes, 'get', '/admin/content/resource-rules', null, async () => {
  const { rows } = await pool.query('SELECT * FROM resource_rules ORDER BY resource');
  for (const r of rows) Object.assign(r, { resource_name: resName(r.resource), needs: await describeActivation(pool, r.harvest) });
  return rows;
});
def(depositRoutes, 'put', '/admin/content/resource-rules/{resource}', Activation, async (c, b) => {
  const res = c.req.param('resource');
  if (!resourceExists(res)) fail(404, `Ressource inconnue : ${res}`);
  await checkActivation(pool, b);
  if (!b.groups.length) await pool.query('DELETE FROM resource_rules WHERE resource=$1', [res]);
  else await pool.query('INSERT INTO resource_rules(resource,harvest) VALUES ($1,$2) ON CONFLICT (resource) DO UPDATE SET harvest=EXCLUDED.harvest', [res, JSON.stringify(b)]);
  await bumpContent(); await audit(c, 'resource.rules', 'resource', null, null, { resource: res, ...b });
  return { resource: res, harvest: b };
});

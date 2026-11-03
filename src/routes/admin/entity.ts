import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { TABLE, kindOf, requireRow } from './common.js';
/** Règles transverses (D2) : coûts en ressources, plafonds (caps), modificateurs bonus/malus & effets. */
export const entityRoutes = router();
const refId = async (kind: string, id: number) => { requireRow(TABLE[kind], id); return id; };
const Cost = z.object({ resource: z.string().max(60), qty: z.number().int().nonnegative() });
const Cap = z.object({ scope: z.enum(['global', 'per_player', 'per_zone']), value: z.number().int().positive() });
const Mod = z.object({
  stat: z.string().max(60), value: z.number(), is_percent: z.boolean().optional(),
  effect_key: z.string().max(60).optional(), duration_h: z.number().int().optional(),
  is_active: z.boolean().optional(), description: z.string().max(200).optional()
});
def(entityRoutes, 'post', '/admin/content/{kind}/{id}/costs', Cost, async (c, b) => {
  const kind = kindOf(c.req.param('kind')), id = await refId(kind, P(c, 'id'));
  const { rows: [row] } = await pool.query(
    'INSERT INTO entity_costs(kind,ref_id,resource,qty) VALUES ($1,$2,$3,$4) ON CONFLICT (kind,ref_id,resource) DO UPDATE SET qty=EXCLUDED.qty RETURNING *',
    [kind, id, b.resource, b.qty]);
  await bumpContent(); await audit(c, 'cost.set', kind, id, null, b);
  return row;
});
def(entityRoutes, 'delete', '/admin/content/{kind}/{id}/costs/{resource}', null, async c => {
  const kind = kindOf(c.req.param('kind')), id = P(c, 'id'), res = c.req.param('resource');
  const r = await pool.query('DELETE FROM entity_costs WHERE kind=$1 AND ref_id=$2 AND resource=$3', [kind, id, res]);
  if (!r.rowCount) fail(404, 'Coût inconnu');
  await bumpContent(); await audit(c, 'cost.remove', kind, id, null, { resource: res });
  return { ok: true };
});
def(entityRoutes, 'post', '/admin/content/{kind}/{id}/caps', Cap, async (c, b) => {
  const kind = kindOf(c.req.param('kind')), id = await refId(kind, P(c, 'id'));
  const { rows: [row] } = await pool.query(
    'INSERT INTO entity_caps(kind,ref_id,scope,value) VALUES ($1,$2,$3,$4) ON CONFLICT (kind,ref_id,scope) DO UPDATE SET value=EXCLUDED.value RETURNING *',
    [kind, id, b.scope, b.value]);
  await bumpContent(); await audit(c, 'cap.set', kind, id, null, b);
  return row;
});
def(entityRoutes, 'delete', '/admin/content/{kind}/{id}/caps/{scope}', null, async c => {
  const kind = kindOf(c.req.param('kind')), id = P(c, 'id'), scope = c.req.param('scope');
  const r = await pool.query('DELETE FROM entity_caps WHERE kind=$1 AND ref_id=$2 AND scope=$3', [kind, id, scope]);
  if (!r.rowCount) fail(404, 'Plafond inconnu');
  await bumpContent(); await audit(c, 'cap.remove', kind, id, null, { scope });
  return { ok: true };
});
def(entityRoutes, 'post', '/admin/content/{kind}/{id}/modifiers', Mod, async (c, b) => {
  const kind = kindOf(c.req.param('kind')), id = await refId(kind, P(c, 'id'));
  const { rows: [row] } = await pool.query(
    `INSERT INTO entity_modifiers(kind,ref_id,stat,value,is_percent,effect_key,duration_h,is_active,description)
     VALUES ($1,$2,$3,$4,COALESCE($5,FALSE),$6,$7,COALESCE($8,FALSE),$9) RETURNING *`,
    [kind, id, b.stat, b.value, b.is_percent ?? false, b.effect_key ?? null, b.duration_h ?? null, b.is_active ?? false, b.description ?? null]);
  await bumpContent(); await audit(c, 'modifier.create', kind, id, null, b);
  return row;
});
def(entityRoutes, 'put', '/admin/content/{kind}/{id}/modifiers/{mid}', Mod.partial(), async (c, b) => {
  const kind = kindOf(c.req.param('kind')), id = P(c, 'id'), mid = P(c, 'mid');
  const ALLOWED = ['stat', 'value', 'is_percent', 'effect_key', 'duration_h', 'is_active', 'description'];
  const keys = Object.keys(b).filter(k => ALLOWED.includes(k) && b[k] !== undefined);
  if (!keys.length) fail(400, 'Aucun champ à modifier');
  const r = await pool.query(
    `UPDATE entity_modifiers SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} WHERE id=$${keys.length + 1} AND kind=$${keys.length + 2} AND ref_id=$${keys.length + 3} RETURNING *`,
    [...keys.map(k => b[k]), mid, kind, id]);
  if (!r.rowCount) fail(404, 'Modificateur inconnu');
  await bumpContent(); await audit(c, 'modifier.update', kind, id, null, b);
  return (r.rows[0] as any);
});
def(entityRoutes, 'delete', '/admin/content/{kind}/{id}/modifiers/{mid}', null, async c => {
  const kind = kindOf(c.req.param('kind')), id = P(c, 'id'), mid = P(c, 'mid');
  const r = await pool.query('DELETE FROM entity_modifiers WHERE id=$1 AND kind=$2 AND ref_id=$3', [mid, kind, id]);
  if (!r.rowCount) fail(404, 'Modificateur inconnu');
  await bumpContent(); await audit(c, 'modifier.delete', kind, id, null, { mid });
  return { ok: true };
});

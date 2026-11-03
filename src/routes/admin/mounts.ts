import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { safeInsert, safeUpdate, requireRow, extras } from './common.js';
export const mountRoutes = router();
const Mount = z.object({
  name: z.string().max(80), hp_max: z.number().int().optional(), armor: z.number().int().optional(),
  energy_max: z.number().int().optional(), speed: z.number().positive().optional(), carry: z.number().int().optional(),
  bonus_see: z.number().int().optional(), bonus_range: z.number().int().optional(),
  flying: z.boolean().optional(), strength: z.number().int().optional(), agility: z.number().int().optional(),
  recovery: z.number().int().optional(), aquatic: z.boolean().optional(),
  special_attack_name: z.string().max(60).optional(), special_attack_damage: z.number().int().optional(),
  special_attack_energy: z.number().int().optional()
});
def(mountRoutes, 'get', '/admin/content/mounts', null, async c => {
  const q = c.req.query('q');
  const { rows } = q ? await pool.query('SELECT * FROM mounts WHERE name ILIKE $1 ORDER BY name', [`%${q}%`])
    : await pool.query('SELECT * FROM mounts ORDER BY name');
  return rows;
});
def(mountRoutes, 'post', '/admin/content/mounts', Mount, async (c, b) => {
  const row = await safeInsert('mounts', b as any);
  await bumpContent(); await audit(c, 'mount.create', 'mount', row.id, null, b);
  return row;
});
def(mountRoutes, 'get', '/admin/content/mounts/{id}', null, async c => {
  const id = P(c, 'id');
  return { ...(await requireRow('mounts', id)), ...(await extras('mount', id)) };
});
def(mountRoutes, 'put', '/admin/content/mounts/{id}', Mount.partial(), async (c, b) => {
  const row = await safeUpdate('mounts', P(c, 'id'), b as any);
  await bumpContent(); await audit(c, 'mount.update', 'mount', P(c, 'id'), null, b);
  return row;
});
def(mountRoutes, 'delete', '/admin/content/mounts/{id}', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM character_mounts WHERE mount_id=$1', [id])).rowCount) fail(409, 'Monture possédée par des joueurs');
  await pool.query('DELETE FROM mounts WHERE id=$1', [id]);
  await bumpContent(); await audit(c, 'mount.delete', 'mount', id, null, null);
  return { ok: true };
});

import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { safeInsert, safeUpdate, requireRow, extras } from './common.js';
export const monsterRoutes = router();
const Monster = z.object({
  name: z.string().max(80), hp_max: z.number().int().optional(), hp_current: z.number().int().optional(),
  recovery: z.number().int().optional(), see: z.number().int().optional(),
  strength: z.number().int().optional(), agility: z.number().int().optional(),
  energy_max: z.number().int().optional(), range: z.number().int().optional(), armor: z.number().int().optional(),
  gain_xp_hour: z.number().int().optional(), gold_current: z.number().optional(),
  guards_item: z.enum(['relique', 'arcane', 'artefact']).optional(), data: z.record(z.any()).optional()
});
def(monsterRoutes, 'get', '/admin/content/monsters', null, async c => {
  const q = c.req.query('q');
  const { rows } = q ? await pool.query('SELECT * FROM monsters WHERE name ILIKE $1 ORDER BY name', [`%${q}%`])
    : await pool.query('SELECT * FROM monsters ORDER BY name');
  return rows;
});
def(monsterRoutes, 'post', '/admin/content/monsters', Monster, async (c, b) => {
  const row = await safeInsert('monsters', b as any);
  await bumpContent(); await audit(c, 'monster.create', 'monster', row.id, null, b);
  return row;
});
def(monsterRoutes, 'get', '/admin/content/monsters/{id}', null, async c => {
  const id = P(c, 'id');
  return { ...(await requireRow('monsters', id)), ...(await extras('monster', id)) };
});
def(monsterRoutes, 'put', '/admin/content/monsters/{id}', Monster.partial(), async (c, b) => {
  const row = await safeUpdate('monsters', P(c, 'id'), b as any);
  await bumpContent(); await audit(c, 'monster.update', 'monster', P(c, 'id'), null, b);
  return row;
});
def(monsterRoutes, 'delete', '/admin/content/monsters/{id}', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM positions WHERE monsters_id=$1', [id])).rowCount) fail(409, 'Ce monstre est placé sur une carte');
  if ((await pool.query('SELECT 1 FROM character_monster WHERE monster_id=$1', [id])).rowCount) fail(409, 'Des joueurs ont invoqué ce monstre');
  if ((await pool.query('SELECT 1 FROM divine_items WHERE guardian_monster_id=$1', [id])).rowCount) fail(409, 'Ce monstre est gardien d\'objets divins');
  await pool.query('DELETE FROM monsters WHERE id=$1', [id]);
  await bumpContent(); await audit(c, 'monster.delete', 'monster', id, null, null);
  return { ok: true };
});

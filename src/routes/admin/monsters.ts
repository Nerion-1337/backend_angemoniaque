import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { safeInsert, safeUpdate, requireRow, extras } from './common.js'; import { RespawnLimit } from '../../game/respawn.js';
export const monsterRoutes = router();
const Monster = z.object({
  name: z.string().max(80), hp_max: z.number().int().optional(), hp_current: z.number().int().optional(),
  recovery: z.number().int().optional(), see: z.number().int().optional(),
  strength: z.number().int().optional(), agility: z.number().int().optional(),
  energy_max: z.number().int().optional(), range: z.number().int().optional(), armor: z.number().int().optional(),
  gain_xp_hour: z.number().int().optional(), gold_current: z.number().optional(),
  guards_item: z.enum(['relique', 'arcane', 'artefact']).optional(), data: z.record(z.any()).optional(),
  /** Réapparition (migration 24) : recréé ou non, délai (h), conditions sur les éléments limités chez les joueurs. */
  respawn: z.boolean().optional(), reincarnate_delay_h: z.number().int().min(0).max(8760).optional(),
  respawn_limits: z.array(RespawnLimit).max(20).optional()
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

// ── Tables de butin (Étape 2 phase 2) ─────────────────────────────────────────
const Loot = z.object({
  itemId: z.number().int().optional(), divineId: z.number().int().optional(), resource: z.string().max(40).optional(),
  dropRate: z.number().min(0).max(100), qtyMin: z.number().int().min(1).default(1), qtyMax: z.number().int().min(1).default(1)
});
def(monsterRoutes, 'get', '/admin/content/monsters/{id}/loot', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM monsters WHERE id=$1', [id])).rowCount === 0) fail(404, 'Monstre inconnu');
  const { rows } = await pool.query(`SELECT ml.*, i.name item_name, di.kind divine_kind, di.id divine_ref
    FROM monster_loot ml LEFT JOIN items i ON i.id=ml.item_id LEFT JOIN divine_items di ON di.id=ml.divine_id
    WHERE ml.monster_id=$1 ORDER BY ml.id`, [id]);
  return rows;
});
def(monsterRoutes, 'post', '/admin/content/monsters/{id}/loot', Loot, async (c, b) => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM monsters WHERE id=$1', [id])).rowCount === 0) fail(404, 'Monstre inconnu');
  if (!b.itemId && !b.divineId && !b.resource) fail(400, 'Choisir un objet, un objet divin ou une ressource');
  if (b.itemId && (await pool.query('SELECT 1 FROM items WHERE id=$1', [b.itemId])).rowCount === 0) fail(404, 'Objet inconnu');
  if (b.divineId && (await pool.query('SELECT 1 FROM divine_items WHERE id=$1', [b.divineId])).rowCount === 0) fail(404, 'Objet divin inconnu');
  const { rows: [row] } = await pool.query(
    'INSERT INTO monster_loot(monster_id,item_id,divine_id,resource,drop_rate,qty_min,qty_max) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [id, b.itemId ?? null, b.divineId ?? null, b.resource ?? null, b.dropRate, b.qtyMin, b.qtyMax]);
  await bumpContent(); await audit(c, 'monster.loot', 'monster', id, null, b);
  return row;
});
def(monsterRoutes, 'delete', '/admin/content/monsters/{id}/loot/{lootId}', null, async c => {
  const id = P(c, 'id');
  const r = await pool.query('DELETE FROM monster_loot WHERE id=$1 AND monster_id=$2 RETURNING id', [P(c, 'lootId'), id]);
  if (!r.rowCount) fail(404, 'Entrée de butin inconnue');
  await bumpContent(); await audit(c, 'monster.loot.delete', 'monster', id, null, { lootId: P(c, 'lootId') });
  return { ok: true };
});

// ── Règles de spawn (Étape 2 phase 2) ─────────────────────────────────────────
const Spawn = z.object({
  mapId: z.number().int(), xMin: z.number().int(), yMin: z.number().int(), xMax: z.number().int(), yMax: z.number().int(),
  maxInstances: z.number().int().min(1).default(1), intervalH: z.number().int().min(0).default(1),
  probability: z.number().min(0).max(100).default(100), conditions: z.record(z.any()).optional(), active: z.boolean().default(true)
});
def(monsterRoutes, 'get', '/admin/content/monsters/{id}/spawns', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM monsters WHERE id=$1', [id])).rowCount === 0) fail(404, 'Monstre inconnu');
  const { rows } = await pool.query(`SELECT sr.*, m.name_file map_name FROM spawn_rules sr JOIN maps m ON m.id=sr.map_id WHERE sr.monster_id=$1 ORDER BY sr.id`, [id]);
  return rows;
});
def(monsterRoutes, 'post', '/admin/content/monsters/{id}/spawns', Spawn, async (c, b) => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM monsters WHERE id=$1', [id])).rowCount === 0) fail(404, 'Monstre inconnu');
  if ((await pool.query('SELECT 1 FROM maps WHERE id=$1', [b.mapId])).rowCount === 0) fail(404, 'Carte inconnue');
  if (b.xMax < b.xMin || b.yMax < b.yMin) fail(400, 'Rectangle invalide');
  const { rows: [row] } = await pool.query(
    `INSERT INTO spawn_rules(monster_id,map_id,x_min,y_min,x_max,y_max,max_instances,interval_h,probability,conditions,active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [id, b.mapId, b.xMin, b.yMin, b.xMax, b.yMax, b.maxInstances, b.intervalH, b.probability, JSON.stringify(b.conditions ?? {}), b.active]);
  await bumpContent(); await audit(c, 'monster.spawn', 'monster', id, null, b);
  return row;
});
def(monsterRoutes, 'put', '/admin/content/monsters/{id}/spawns/{ruleId}', Spawn.partial(), async (c, b) => {
  const id = P(c, 'id');
  const { rows: [row] } = await pool.query(
    `UPDATE spawn_rules SET
       map_id=COALESCE($2,map_id), x_min=COALESCE($3,x_min), y_min=COALESCE($4,y_min), x_max=COALESCE($5,x_max), y_max=COALESCE($6,y_max),
       max_instances=COALESCE($7,max_instances), interval_h=COALESCE($8,interval_h), probability=COALESCE($9,probability),
       conditions=COALESCE($10,conditions), active=COALESCE($11,active)
     WHERE id=$1 AND monster_id=$12 RETURNING *`,
    [P(c, 'ruleId'), b.mapId, b.xMin, b.yMin, b.xMax, b.yMax, b.maxInstances, b.intervalH, b.probability, b.conditions ? JSON.stringify(b.conditions) : null, b.active, id]);
  if (!row) fail(404, 'Règle de spawn inconnue');
  await bumpContent(); await audit(c, 'monster.spawn.update', 'monster', id, null, b);
  return row;
});
def(monsterRoutes, 'delete', '/admin/content/monsters/{id}/spawns/{ruleId}', null, async c => {
  const id = P(c, 'id');
  const r = await pool.query('DELETE FROM spawn_rules WHERE id=$1 AND monster_id=$2 RETURNING id', [P(c, 'ruleId'), id]);
  if (!r.rowCount) fail(404, 'Règle de spawn inconnue');
  await bumpContent(); await audit(c, 'monster.spawn.delete', 'monster', id, null, { ruleId: P(c, 'ruleId') });
  return { ok: true };
});

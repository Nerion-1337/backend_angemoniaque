import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { Kit, checkKit } from '../../game/startKit.js'; import { Requirements, checkReq } from '../../game/rankUp.js'; import { bumpContent } from '../../game/content.js';
export const raceRoutes = router();
const nInt = (max: number) => z.number().int().min(0).max(max).nullable().optional();
const Race = z.object({ key: z.string().max(40), name: z.string().max(80), base_stats: z.record(z.number()).optional(), color: z.string().max(30).optional(), active: z.boolean().optional(),
  /** Apparition des nouveaux personnages : monde + centre + rayon (null = capitale de la race). */
  spawn_map_id: nInt(1_000_000), spawn_x: nInt(10_000), spawn_y: nInt(10_000), spawn_radius: z.number().int().min(0).max(100).optional(),
  /** Limites : par compte (null = illimité) et population totale (null = illimité). Le compte admin est exempté. */
  max_per_account: nInt(1000), max_total: nInt(1_000_000) });
const SPAWN_COLS = ['spawn_map_id', 'spawn_x', 'spawn_y', 'spawn_radius', 'max_per_account', 'max_total'] as const;
/** Zone d'apparition cohérente : carte existante et centre dans ses bornes. */
const checkSpawn = async (b: any) => {
  if (b.spawn_map_id == null) return;
  const { rows: [m] } = await pool.query('SELECT width w, height h FROM maps WHERE id=$1', [b.spawn_map_id]);
  if (!m) fail(404, `Monde n°${b.spawn_map_id} inconnu`);
  if (b.spawn_x == null || b.spawn_y == null) fail(400, 'Centre de la zone d’apparition (x, y) requis');
  if (b.spawn_x >= m.w || b.spawn_y >= m.h) fail(400, `Centre hors du monde (${m.w}×${m.h})`);
};
const setSpawn = async (id: number, b: any) => {
  const cols = SPAWN_COLS.filter(k => b[k] !== undefined);
  if (cols.length) await pool.query(`UPDATE races SET ${cols.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1`, [id, ...cols.map(k => b[k])]);
};
def(raceRoutes, 'get', '/admin/content/races', null, async () => {
  const { rows: races } = await pool.query('SELECT * FROM races ORDER BY key');
  const { rows: ranks } = await pool.query('SELECT * FROM specializations ORDER BY race, current_rank');
  return races.map((r: any) => ({ ...r, ranks: ranks.filter((s: any) => s.race === r.key) }));
});
def(raceRoutes, 'post', '/admin/content/races', Race, async (c, b) => {
  await checkSpawn(b);
  const { rows: [row] } = await pool.query(
    'INSERT INTO races(key,name,base_stats,color,active) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO NOTHING RETURNING *',
    [b.key, b.name, b.base_stats ?? {}, b.color ?? null, b.active ?? true]);
  if (!row) fail(409, 'Race déjà existante');
  await setSpawn(row.id, b);
  await bumpContent(); await audit(c, 'race.create', 'race', row.id, null, b);
  return row;
});
def(raceRoutes, 'put', '/admin/content/races/{id}', Race.partial(), async (c, b) => {
  await checkSpawn(b);
  const { rows: [row] } = await pool.query('UPDATE races SET name=$1,base_stats=COALESCE($2,base_stats),color=COALESCE($3,color),active=COALESCE($4,active) WHERE id=$5 RETURNING *',
    [b.name, b.base_stats ? JSON.stringify(b.base_stats) : null, b.color, b.active, P(c, 'id')]);
  if (!row) fail(404, 'Race inconnue');
  await setSpawn(P(c, 'id'), b);
  await bumpContent(); await audit(c, 'race.update', 'race', P(c, 'id'), null, b);
  return (await pool.query('SELECT * FROM races WHERE id=$1', [P(c, 'id')])).rows[0];
});
def(raceRoutes, 'delete', '/admin/content/races/{id}', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM characters WHERE race=(SELECT key FROM races WHERE id=$1)', [id])).rowCount) fail(409, 'Des personnages utilisent cette race');
  if ((await pool.query('SELECT 1 FROM specializations WHERE race=(SELECT key FROM races WHERE id=$1)', [id])).rowCount) fail(409, 'Supprimez d\'abord ses rangs');
  await pool.query('DELETE FROM races WHERE id=$1', [id]);
  await bumpContent(); await audit(c, 'race.delete', 'race', id, null, null);
  return { ok: true };
});
// ---- Arbre des rangs (paliers d'évolution, prérequis, multiplicateurs par rang) ----
def(raceRoutes, 'get', '/admin/content/ranks', null, async c => {
  const race = c.req.query('race');
  const { rows } = race
    ? await pool.query('SELECT * FROM specializations WHERE race=$1 ORDER BY current_rank', [race])
    : await pool.query('SELECT * FROM specializations ORDER BY race, current_rank');
  return rows;
});
def(raceRoutes, 'post', '/admin/content/ranks', z.object({
  race: z.string().max(40), name: z.string().max(60), current_rank: z.number().int().positive(),
  max_population_percent: z.number().min(0).max(100).default(100), gain_xp_hour: z.number().int().optional(),
  hp_max: z.number().int().optional(), recovery: z.number().int().optional(), see: z.number().int().optional(),
  strength: z.number().int().optional(), agility: z.number().int().optional(),
  energy_max: z.number().int().optional(), divine_energy_max: z.number().int().optional(),
  prereq_xp: z.number().int().optional(), multipliers: z.record(z.number()).optional(), evolution: z.string().max(300).optional()
}), async (c, b) => {
  if ((await pool.query('SELECT 1 FROM races WHERE key=$1', [b.race])).rowCount !== 1) fail(400, 'Race inconnue');
  const keys = Object.keys(b).filter(k => k !== 'race');
  const { rows: [row] } = await pool.query(
    `INSERT INTO specializations(race,${keys.join(',')}) VALUES ($1,${keys.map((_, i) => '$' + (i + 2)).join(',')}) RETURNING *`,
    [b.race, ...keys.map(k => b[k] ?? null)]);
  await bumpContent(); await audit(c, 'rank.create', 'rank', row.id, null, b);
  return row;
});
def(raceRoutes, 'put', '/admin/content/ranks/{id}', z.record(z.any()), async (c, b) => {
  const ALLOWED = ['race', 'name', 'current_rank', 'max_population_percent', 'gain_xp_hour', 'hp_max', 'recovery', 'see', 'strength', 'agility', 'energy_max', 'divine_energy_max', 'prereq_xp', 'multipliers', 'evolution'];
  const keys = Object.keys(b).filter(k => ALLOWED.includes(k) && b[k] !== undefined);
  if (!keys.length) fail(400, 'Aucun champ à modifier');
  if (b.race !== undefined && (await pool.query('SELECT 1 FROM races WHERE key=$1', [b.race])).rowCount !== 1) fail(400, 'Race inconnue');
  const { rows: [row] } = await pool.query(
    `UPDATE specializations SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} WHERE id=$${keys.length + 1} RETURNING *`,
    [...keys.map(k => (typeof b[k] === 'object' ? JSON.stringify(b[k]) : b[k])), P(c, 'id')]);
  if (!row) fail(404, 'Rang inconnu');
  await bumpContent(); await audit(c, 'rank.update', 'rank', P(c, 'id'), null, b);
  return row;
});
def(raceRoutes, 'delete', '/admin/content/ranks/{id}', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM characters WHERE specialization_id=$1', [id])).rowCount) fail(409, 'Des personnages sont à ce rang');
  await pool.query('DELETE FROM specializations WHERE id=$1', [id]);
  await bumpContent(); await audit(c, 'rank.delete', 'rank', id, null, null);
  return { ok: true };
});

/** Équipement de départ d'une race (rang, or, XP, ressources, objets sac/coffre, sorts, montures) : remplace le kit entier. */
def(raceRoutes, 'put', '/admin/content/races/{id}/start-kit', Kit, async (c, b) => {
  const id = P(c, 'id');
  const { rows: [r] } = await pool.query('SELECT key, start_kit FROM races WHERE id=$1', [id]);
  if (!r) fail(404, 'Race inconnue');
  await checkKit(pool, r.key, b);
  const { rows: [row] } = await pool.query('UPDATE races SET start_kit=$2 WHERE id=$1 RETURNING *', [id, JSON.stringify(b)]);
  await bumpContent(); await audit(c, 'race.start_kit', 'race', id, r.start_kit, b);
  return row;
});

/** Conditions de passage À ce rang (lot 3) : objets, ressources, énergie, définitif / temporaire (durée), consommation. {} = aucune. */
def(raceRoutes, 'put', '/admin/content/ranks/{id}/requirements', z.union([Requirements, z.object({}).strict()]), async (c, b) => {
  const id = P(c, 'id');
  const { rows: [before] } = await pool.query('SELECT requirements FROM specializations WHERE id=$1', [id]);
  if (!before) fail(404, 'Rang inconnu');
  if (Object.keys(b).length) await checkReq(pool, b as any);
  const { rows: [row] } = await pool.query('UPDATE specializations SET requirements=$2 WHERE id=$1 RETURNING *', [id, JSON.stringify(b)]);
  await bumpContent(); await audit(c, 'rank.requirements', 'rank', id, before.requirements, b);
  return row;
});

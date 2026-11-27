import { def, router, z } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js'; import { audit } from '../../lib/audit.js'; import { multisOf } from '../../game/rules.js';
/**
 * Section admin « Améliorations » : coût en XP des améliorations de caractéristiques (stat_cost_rules). Coût du prochain point =
 * base × multiplicateur du palier ; palier = achats ÷ « améliorations par palier » ; autant de paliers que de multiplicateurs
 * (`multis`, 1 à 20, migration 45), le dernier vaut au-delà. Ancien format multi_1..3 encore accepté en entrée.
 * Une caractéristique sans ligne ne s'améliore pas. Liste fermée (la colonne est écrite telle quelle par l'amélioration).
 */
export const statCostRoutes = router();
export const UPGRADABLE = ['hp_max', 'energy_max', 'divine_energy_max', 'recovery', 'see', 'range', 'strength', 'agility', 'armor', 'magic_armor'] as const;
const M = z.number().min(0).max(1000);
const Rule = z.object({ base_xp_cost: z.number().int().min(0).max(1e9), numb_up: z.number().int().min(1).max(1e6),
  multis: z.array(M).min(1).max(20).optional(), multi_1: M.optional(), multi_2: M.optional(), multi_3: M.optional() })
  .transform(r => ({ base_xp_cost: r.base_xp_cost, numb_up: r.numb_up, multis: r.multis ?? [r.multi_1 ?? 1, r.multi_2 ?? 2, r.multi_3 ?? 3] }));
const stat = (c: any) => { const s = c.req.param('stat'); if (!(UPGRADABLE as readonly string[]).includes(s)) fail(400, `Caractéristique non améliorable : ${s}`); return s; };
def(statCostRoutes, 'get', '/admin/content/stat-costs', null, async () => ({
  stats: UPGRADABLE, rules: (await pool.query('SELECT stat, base_xp_cost, numb_up, multis, multi_1, multi_2, multi_3 FROM stat_cost_rules ORDER BY stat')).rows
    .map((r: any) => ({ stat: r.stat, base_xp_cost: r.base_xp_cost, numb_up: r.numb_up, multis: multisOf(r) })) }));
def(statCostRoutes, 'put', '/admin/content/stat-costs/{stat}', Rule, async (c, b) => {
  const s = stat(c);
  const { rows: [row] } = await pool.query(`INSERT INTO stat_cost_rules(stat,base_xp_cost,numb_up,multis) VALUES ($1,$2,$3,$4)
    ON CONFLICT (stat) DO UPDATE SET base_xp_cost=EXCLUDED.base_xp_cost, numb_up=EXCLUDED.numb_up, multis=EXCLUDED.multis RETURNING stat`,
    [s, b.base_xp_cost, b.numb_up, b.multis]);
  await audit(c, 'stat_cost.set', 'stat_cost', undefined, null, { stat: s, ...b });
  return { ok: true, stat: row.stat };
});
def(statCostRoutes, 'delete', '/admin/content/stat-costs/{stat}', null, async c => {
  const s = stat(c); await pool.query('DELETE FROM stat_cost_rules WHERE stat=$1', [s]); await audit(c, 'stat_cost.delete', 'stat_cost', undefined, null, { stat: s });
  return { ok: true };
});

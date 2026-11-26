import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { FaithCfg, PactCfg, faithCfg, pactCfg, defaultMaxPacts, STATS } from '../../game/faithPact.js';
/**
 * Sections admin « Foi » et « Pacte » (migration 44) : réglages de la foi (gains du dieu, prières, bénédictions par
 * caractéristique), caractéristiques transférées par les pactes, compositions de pacte, nombre de pactes par rang.
 */
export const faithPactRoutes = router();
const saveCfg = async (key: string, value: any) =>
  pool.query('INSERT INTO game_config(key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()', [key, JSON.stringify(value)]);

def(faithPactRoutes, 'get', '/admin/content/faith', null, async () => ({ ...(await faithCfg()), stats: STATS }));
def(faithPactRoutes, 'put', '/admin/content/faith', FaithCfg, async (c, b) => {
  await saveCfg('faith', b); await bumpContent(); await audit(c, 'config.faith', 'config', undefined, null, b); return b;
});
def(faithPactRoutes, 'get', '/admin/content/pact', null, async () => ({ ...(await pactCfg()), all: STATS, tiers: (await pool.query('SELECT * FROM pact_tiers ORDER BY sort, id')).rows }));
def(faithPactRoutes, 'put', '/admin/content/pact', PactCfg, async (c, b) => {
  await saveCfg('pact', { stats: [...new Set(b.stats)] }); await bumpContent(); await audit(c, 'config.pact', 'config', undefined, null, b); return b;
});

const Tier = z.object({
  name: z.string().trim().min(1).max(40), xp_hour: z.number().int().min(0).max(1e6), gold_hour: z.number().int().min(0).max(1e6),
  percent: z.number().int().min(1).max(100), duration_h: z.number().min(1).max(8760), cooldown_h: z.number().min(0).max(8760), sort: z.number().int().min(0).max(1000).optional(),
});
const COLS = ['name', 'xp_hour', 'gold_hour', 'percent', 'duration_h', 'cooldown_h', 'sort'] as const;
const dup = (e: any) => { if (e?.code === '23505') fail(409, 'Une composition porte déjà ce nom'); throw e; };
def(faithPactRoutes, 'post', '/admin/content/pact-tiers', Tier, async (c, b) => {
  const { rows: [r] } = await pool.query(`INSERT INTO pact_tiers(${COLS.join(',')}) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,(SELECT COALESCE(max(sort),0)+1 FROM pact_tiers))) RETURNING *`,
    COLS.map(k => (b as any)[k] ?? null)).catch(dup);
  await audit(c, 'pact_tier.create', 'pact_tier', r.id, null, b); return r;
});
def(faithPactRoutes, 'put', '/admin/content/pact-tiers/{id}', Tier.partial(), async (c, b) => {
  const keys = COLS.filter(k => (b as any)[k] !== undefined); if (!keys.length) fail(400, 'Rien à modifier');
  const { rows: [r] } = await pool.query(`UPDATE pact_tiers SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`, [P(c, 'id'), ...keys.map(k => (b as any)[k])]).catch(dup);
  if (!r) fail(404, 'Composition inconnue'); await audit(c, 'pact_tier.update', 'pact_tier', P(c, 'id'), null, b); return r;
});
/** Supprimer une composition : les pactes qui l'utilisaient n'en ont plus (l'Ange / le Démon doit en choisir une autre). */
def(faithPactRoutes, 'delete', '/admin/content/pact-tiers/{id}', null, async c => {
  const r = await pool.query('DELETE FROM pact_tiers WHERE id=$1', [P(c, 'id')]); if (!r.rowCount) fail(404, 'Composition inconnue');
  await audit(c, 'pact_tier.delete', 'pact_tier', P(c, 'id'), null, null); return { ok: true };
});

/** Pactes simultanés par rang (toutes races) : valeur réglée ou règle par défaut (NULL). */
def(faithPactRoutes, 'get', '/admin/content/pact-limits', null, async () =>
  (await pool.query('SELECT id, race, name, current_rank, max_pacts FROM specializations ORDER BY race, current_rank')).rows
    .map((r: any) => ({ ...r, default_max: defaultMaxPacts(r.race, r.current_rank) })));
def(faithPactRoutes, 'put', '/admin/content/pact-limits/{id}', z.object({ maxPacts: z.number().int().min(0).max(1000).nullable() }), async (c, b) => {
  const r = await pool.query('UPDATE specializations SET max_pacts=$2 WHERE id=$1', [P(c, 'id'), b.maxPacts]); if (!r.rowCount) fail(404, 'Rang inconnu');
  await audit(c, 'rank.max_pacts', 'rank', P(c, 'id'), null, b); return { ok: true };
});

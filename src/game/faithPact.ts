import { z } from '../lib/route.js'; import { CAPS, POOLS } from './spellEffects.js'; import { cfgAll } from './content.js';
/**
 * Foi et Pactes réglés en admin (migration 44) : réglages (game_config.faith / game_config.pact), calculs purs et
 * application d'un bonus temporaire (temp_buffs, rétabli au tick horaire).
 */
export const STATS = CAPS;
const Stat = z.enum(CAPS);
/** Réserve associée à un maximum : augmenter / baisser le max ajoute / retire aussi la réserve courante. */
export const POOL_OF: Record<string, string> = { hp_max: 'hp_current', energy_max: 'energy_current', divine_energy_max: 'divine_energy_current' };

export const Blessing = z.object({ max: z.number().int().min(1).max(1e6), maxH: z.number().int().min(1).max(8760), cost: z.number().int().min(0).max(1e6) });
export const FaithCfg = z.object({
  followersStep: z.number().int().min(1).max(1e6), xpHour: z.number().int().min(0).max(1e6), goldHour: z.number().int().min(0).max(1e6),
  prayers: z.number().int().min(0).max(100), prayerPeriodH: z.number().min(1).max(8760),
  blessings: z.record(Stat, Blessing),
});
export const PactCfg = z.object({ stats: z.array(Stat).max(CAPS.length) });
export type FaithCfgT = z.infer<typeof FaithCfg>;
const FAITH_DEFAULT: FaithCfgT = { followersStep: 1, xpHour: 2, goldHour: 2, prayers: 1, prayerPeriodH: 72, blessings: {} };
export const faithCfg = async (): Promise<FaithCfgT> => { const r = FaithCfg.safeParse({ ...FAITH_DEFAULT, ...((await cfgAll()).faith ?? {}) }); return r.success ? r.data : FAITH_DEFAULT; };
export const pactCfg = async () => { const r = PactCfg.safeParse((await cfgAll()).pact ?? {}); return r.success ? r.data : { stats: ['strength', 'agility'] as any[] }; };

/** Coût d'une bénédiction : coût du maximum × (valeur / max) × (durée / durée max), arrondi au supérieur. */
export const blessingCost = (b: { max: number; maxH: number; cost: number }, value: number, hours: number) =>
  Math.ceil(b.cost * (value / b.max) * (hours / b.maxH) - 1e-9);
/** Part d'une caractéristique transférée par un pacte : pourcentage, arrondi au supérieur (0 si la caractéristique est nulle). */
export const pactAmount = (value: number, percent: number) => (value > 0 ? Math.ceil((value * percent) / 100 - 1e-9) : 0);
/** XP / or par heure d'un dieu : par tranche complète de `followersStep` fidèles acceptés. */
export const godIncome = (followers: number, f: Pick<FaithCfgT, 'followersStep' | 'xpHour' | 'goldHour'>) => {
  const k = Math.floor(followers / f.followersStep); return { xp: k * f.xpHour, gold: k * f.goldHour };
};
/** Pactes simultanés par défaut quand le rang n'a pas de réglage (`max_pacts` NULL) : Humain 1 ; Ange / Démon 3, +1 par rang au-dessus de 2. */
export const defaultMaxPacts = (race: string, rank: number) => (race === 'human' ? 1 : ['angel', 'demon'].includes(race) ? 3 + Math.max(0, rank - 2) : 0);
/** Délai lisible (secondes → « 1 h 05 » / « 12 min »). */
export const fmtWait = (s: number) => { const t = Math.ceil(s / 60), h = Math.floor(t / 60), m = t % 60; return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${Math.max(1, m)} min`; };   // minutes arrondies au total (jamais « 47 h 60 »)

/** Bonus (ou malus) temporaire d'une caractéristique ; un maximum déplace aussi sa réserve (jamais sous 0). */
export async function applyBuff(db: any, charId: number, stat: string, delta: number, source: string, hours: number) {
  if (!delta || !(CAPS as readonly string[]).includes(stat)) return;
  const pool = POOL_OF[stat];
  await db.query(`UPDATE characters SET ${stat}=${stat}+$2${pool ? `, ${pool}=GREATEST(0, LEAST(${stat}+$2, ${pool}+$2))` : ''} WHERE id=$1`, [charId, delta]);
  await db.query("INSERT INTO temp_buffs(character_id,stat,delta,source,expires_at) VALUES ($1,$2,$3,$4,now()+make_interval(secs => $5::numeric * 3600))", [charId, stat, delta, source, hours]);
}
/** Retire tout de suite les bonus temporaires choisis (`where` sur temp_buffs) : caractéristique rétablie, réserve ramenée sous son maximum. */
export async function expireBuffs(db: any, where: string, params: any[] = []) {
  const { rows } = await db.query(`DELETE FROM temp_buffs WHERE ${where} RETURNING character_id, stat, delta`, params);
  for (const r of rows) if ((CAPS as readonly string[]).includes(r.stat)) {
    await db.query(`UPDATE characters SET ${r.stat}=GREATEST(0, ${r.stat}-$2) WHERE id=$1`, [r.character_id, r.delta]);
    for (const [cur, max] of Object.values(POOLS)) if (max === r.stat) await db.query(`UPDATE characters SET ${cur}=LEAST(${cur}, ${max}) WHERE id=$1`, [r.character_id]);
  }
  return rows.length;
}
/** Fiche publique d'un personnage (classement, demandes de pacte / de foi) : pseudo, rang, race, guilde. */
export const CARD_SQL = `SELECT c.id, c.pseudo, c.race, rc.name race_name, s.name rank_name, s.current_rank, g.name guild
  FROM characters c JOIN specializations s ON s.id=c.specialization_id LEFT JOIN guilds g ON g.id=c.guild_id LEFT JOIN races rc ON rc.key=c.race`;

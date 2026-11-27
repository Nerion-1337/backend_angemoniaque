import { cfgAll } from './content.js';
/**
 * Gains d'XP ponctuels (migration 35) : objet utilisé (coup porté avec une arme, parchemin utilisé), sort lancé, monstre tué.
 * Face à une cible, le gain est pondéré par l'écart de rang (rang de la cible − rang du personnage) selon la table réglée dans
 * « Races & rangs » (game_config.xp_rank_diff : { "écart": pourcentage }). Écart absent de la table : la ligne la plus proche
 * (au-delà des bornes : la borne). Sans cible : 100 %.
 */
export const DEFAULT_RANK_DIFF: Record<string, number> = { '-2': 50, '-1': 75, '0': 100, '1': 125, '2': 150 };
/** Pourcentage pour un écart donné (pur) ; table vide → 100. Égalité de distance : la ligne la plus basse. */
export function rankPercent(table: Record<string, number> | null | undefined, diff: number) {
  const keys = Object.keys(table ?? {}).map(Number).filter(Number.isFinite);
  if (!keys.length) return 100;
  const k = keys.sort((a, b) => Math.abs(a - diff) - Math.abs(b - diff) || a - b)[0];
  return Math.max(0, Number(table![String(k)]) || 0);
}
export const rankTable = async (): Promise<Record<string, number>> => (await cfgAll()).xp_rank_diff ?? DEFAULT_RANK_DIFF;
/** Rang d'un personnage : palier de son rang. */
export async function charRank(db: any, charId: number): Promise<number> {
  const { rows: [r] } = await db.query('SELECT COALESCE(s.current_rank,1) r FROM characters c LEFT JOIN specializations s ON s.id=c.specialization_id WHERE c.id=$1', [charId]);
  return r?.r ?? 1;
}
/** Rang d'une cible : personnage, monstre (monsters.rank), invocation (rang de son maître). */
export async function targetRank(db: any, t: { kind: string; id: number; row: any }) {
  if (t.kind === 'monster') return Number(t.row.rank ?? 1);
  if (t.kind === 'character') return charRank(db, t.id);
  return t.row.owner_id ? charRank(db, t.row.owner_id) : 1;
}
export type XpTarget = { kind: string; id: number; row: any } | null | undefined;
/** Crédite `base` XP (pondérée par l'écart de rang face à `target`) ; renvoie l'XP réellement gagnée. */
export async function gainXp(db: any, charId: number, base: number, target?: XpTarget) {
  if (!(base > 0)) return 0;
  const pct = target ? rankPercent(await rankTable(), (await targetRank(db, target)) - (await charRank(db, charId))) : 100;
  const xp = Math.round(base * pct / 100);
  if (xp > 0) await db.query('UPDATE characters SET xp=xp+$2 WHERE id=$1', [charId, xp]);
  return xp;
}
/** XP des objets « utilisés » à l'attaque : armes équipées (main principale et seconde main). */
export async function weaponXp(db: any, charId: number): Promise<number> {
  const { rows: [r] } = await db.query("SELECT COALESCE(sum(i.xp_use),0)::int n FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.equipped_slot IN ('weapon_main','weapon_off')", [charId]);
  return r.n;
}
export const COMBAT_KEYS = ['xp_hit_player', 'xp_dodge', 'train_energy', 'train_xp'] as const;
export type CombatXp = Record<typeof COMBAT_KEYS[number], number>;
/** Valeurs GÉNÉRALES (game_config.combat_xp, migration 47), appliquées à tout rang qui ne précise rien. */
export const combatDefaults = async (): Promise<CombatXp> => {
  const c = (await cfgAll()).combat_xp ?? {};
  return Object.fromEntries(COMBAT_KEYS.map(k => [k, Math.max(0, Math.trunc(Number(c[k]) || 0))])) as CombatXp;
};
/** Réglages de combat / entraînement d'un personnage : valeur de son rang si précisée (non NULL), sinon la valeur générale. */
export async function rankCombat(db: any, charId: number): Promise<CombatXp> {
  const def = await combatDefaults();
  const { rows: [r] } = await db.query(`SELECT s.xp_hit_player, s.xp_dodge, s.train_energy, s.train_xp FROM characters c LEFT JOIN specializations s ON s.id=c.specialization_id WHERE c.id=$1`, [charId]);
  return Object.fromEntries(COMBAT_KEYS.map(k => [k, r?.[k] ?? def[k]])) as CombatXp;
}
/** XP de base d'un coup PORTÉ (touché) : joueur → `xp_hit_player` du rang de l'attaquant ; monstre → son `xp_hit` ; invocation → `xp_hit` de son type ;
 *  structure → son `xp_hit` (migration 47). */
export async function hitXp(db: any, attackerId: number, t: { kind: string; row: any }) {
  if (t.kind === 'character') return (await rankCombat(db, attackerId)).xp_hit_player;
  if (t.kind === 'monster' || t.kind === 'building') return Number(t.row.xp_hit ?? 0);
  if (t.kind === 'summon' && t.row.monster_id) return Number((await db.query('SELECT xp_hit FROM monsters WHERE id=$1', [t.row.monster_id])).rows[0]?.xp_hit ?? 0);
  return 0;
}

import { z } from '../lib/route.js'; import { fail } from '../lib/db.js';
import { applyDamage, type Target } from './combatlib.js'; import { applyArmor } from './rules.js';
/**
 * Moteur de sorts paramétrable (spells.effects, migration 20). Un sort sans effets ({}) garde son comportement historique.
 * - target : self (lanceur), single (une case à portée), area (toutes les entités à `radius` d'une case à portée).
 * - affects : enemies | allies | all (alliés = même race que le lanceur et ses invocations).
 * - damage : dégâts instantanés (réduits par l'armure magique, peuvent tuer) ; heal : PV rendus (sans dépasser le max).
 * - dot : { damage, hours } dégâts par heure au tick (jamais mortels, PV min 1).
 * - summon : { kind, refId, qty, durationH } invoque un élément (game/spellSummon.ts).
 * - stats : [{ stat, value }] ± ; capacités (*_max, force…) modifiées pour `durationH` heures (0 = permanent) ;
 *   réserves (hp, energy, divine_energy) : la valeur actuelle est rendue / retirée, bornée à [0 (1 pour hp), max].
 */
export const CAPS = ['strength', 'agility', 'armor', 'magic_armor', 'see', 'range', 'recovery', 'hp_max', 'energy_max', 'divine_energy_max'] as const;
export const POOLS: Record<string, [string, string]> = { hp: ['hp_current', 'hp_max'], energy: ['energy_current', 'energy_max'], divine_energy: ['divine_energy_current', 'divine_energy_max'] };
const STAT_KEYS = [...CAPS, ...Object.keys(POOLS)] as [string, ...string[]];
export const Effects = z.object({
  target: z.enum(['self', 'single', 'area']).default('single'),
  range: z.number().int().min(0).max(30).default(4),
  radius: z.number().int().min(0).max(15).default(0),
  affects: z.enum(['enemies', 'allies', 'all']).default('enemies'),
  damage: z.number().int().min(0).max(1e6).default(0),
  heal: z.number().int().min(0).max(1e6).default(0),
  dot: z.object({ damage: z.number().int().min(1).max(1e6), hours: z.number().int().min(1).max(720) }).nullable().optional(),
  stats: z.array(z.object({ stat: z.enum(STAT_KEYS), value: z.number().int().min(-1e6).max(1e6) })).max(12).default([]),
  durationH: z.number().int().min(0).max(8760).default(0),
  /** Invocation (lot D) : monstre (instance de combat), monture (type montable), objet (`qty` exemplaires), bâtiment (copie) ; durationH 0 = permanent. */
  summon: z.object({ kind: z.enum(['monster', 'item', 'building']), refId: z.number().int(), qty: z.number().int().min(1).max(99).default(1),
    durationH: z.number().int().min(0).max(8760).default(0) }).nullable().optional()
});
export type EffectsT = z.infer<typeof Effects>;
/** Le sort utilise-t-il le moteur (effets réglés) ? */
export const hasEffects = (e: any) => !!e && Object.keys(e).length > 0;
/** Un effet est hostile s'il blesse ou retire quelque chose. Pure. */
export const isHarmful = (e: EffectsT) => e.damage > 0 || !!e.dot || e.stats.some(s => s.value < 0);
/** Camp d'une cible par rapport au lanceur. Pure. */
export const isAlly = (casterRace: string, casterId: number, t: { kind: string; row: any }) =>
  t.kind === 'character' ? t.row.race === casterRace : t.kind === 'summon' ? t.row.owner_id === casterId : false;
export const keepTarget = (affects: string, ally: boolean) => affects === 'all' || (affects === 'allies') === ally;
/** Nouvelle valeur d'une réserve après ±value, bornée à [min, max]. Pure. */
export const poolValue = (cur: number, max: number, value: number, min = 0) => Math.max(min, Math.min(max, cur + value));

/** Applique les effets à une cible ; renvoie un résumé lisible. */
export async function applyEffects(db: any, caster: any, spellId: number, e: EffectsT, t: Target) {
  const out: string[] = [];
  if (e.damage > 0) { const dmg = applyArmor(e.damage, t.magicArmor), r = await applyDamage(db, t, dmg, caster.id); out.push(`-${dmg} PV${r.killed ? ' (vaincu)' : ''}`); if (r.killed) return out.join(', '); }
  const tbl = { character: 'characters', monster: 'monsters', summon: 'summons' }[t.kind];
  if (e.heal > 0) { await db.query(`UPDATE ${tbl} SET hp_current=LEAST(hp_max, hp_current+$2) WHERE id=$1`, [t.id, e.heal]); out.push(`+${e.heal} PV`); }
  if (e.dot) {   // dégâts sur la durée : réduits par l'armure magique de la cible au moment du lancer (minimum 1/h)
    const dph = applyArmor(e.dot.damage, t.magicArmor);
    await db.query("INSERT INTO spell_dots(target_kind,target_id,spell_id,caster_id,damage_per_h,until) VALUES ($1,$2,$3,$4,$5,now()+make_interval(hours=>$6))", [t.kind, t.id, spellId, caster.id, dph, e.dot.hours]); out.push(`-${dph} PV/h pendant ${e.dot.hours} h`); }
  for (const s of e.stats) {
    if (POOLS[s.stat]) {   // réserve : valeur actuelle rendue / retirée, jamais au-delà du max (PV min 1 : seuls les dégâts tuent)
      const [cur, max] = POOLS[s.stat]; if (t.kind !== 'character' && s.stat !== 'hp') continue;
      await db.query(`UPDATE ${tbl} SET ${cur}=GREATEST($3, LEAST(${max}, ${cur}+$2)) WHERE id=$1`, [t.id, s.value, s.stat === 'hp' ? 1 : 0]);
      out.push(`${s.value > 0 ? '+' : ''}${s.value} ${s.stat}`);
    } else if (t.kind === 'character') {   // capacité : max relevé / abaissé (temporaire si durationH > 0) ; la réserve suit à la baisse
      await db.query(`UPDATE characters SET ${s.stat}=GREATEST(0, ${s.stat}+$2) WHERE id=$1`, [t.id, s.value]);
      for (const [p, [cur, max]] of Object.entries(POOLS)) if (max === s.stat) await db.query(`UPDATE characters SET ${cur}=LEAST(${cur}, ${max}) WHERE id=$1`, [t.id]);
      if (e.durationH > 0) await db.query("INSERT INTO temp_buffs(character_id,stat,delta,source,expires_at) VALUES ($1,$2,$3,$4,now()+make_interval(hours=>$5))", [t.id, s.stat, s.value, `spell:${spellId}`, e.durationH]);
      out.push(`${s.value > 0 ? '+' : ''}${s.value} ${s.stat}${e.durationH ? ` (${e.durationH} h)` : ''}`);
    }
  }
  return out.join(', ') || 'aucun effet';
}

/** Cibles d'un sort à partir de la case visée (déjà validée à portée). `entities` = cibles chargées sur la zone. */
/** `selfSummonId` : créature contrôlée qui lance le sort — « soi-même » la désigne alors, pas le héros. */
export function pickTargets(e: EffectsT, caster: any, center: { x: number; y: number }, entities: Target[], selfSummonId?: number) {
  if (e.target === 'self') return entities.filter(t => (selfSummonId ? t.kind === 'summon' && t.id === selfSummonId : t.kind === 'character' && t.id === caster.id));
  const inRange = (t: Target) => Math.max(Math.abs(t.pos.coord_x - center.x), Math.abs(t.pos.coord_y - center.y)) <= (e.target === 'area' ? e.radius : 0);
  return entities.filter(t => inRange(t) && keepTarget(e.affects, isAlly(caster.race, caster.id, t) || (t.kind === 'character' && t.id === caster.id)));
}

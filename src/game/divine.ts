import { effectiveRank } from './rules.js'; import { fail, log } from '../lib/db.js'; import { divineCap, cfgNum } from './content.js';
export const KIND: Record<string, string> = { human: 'artefact', demon: 'arcane', angel: 'relique' };
export const required = (targetRank: number) => targetRank - 1;   // hypothèse : rang visé N exige N-1 objets
export const held = async (db: any, id: number, kind: string) => (await db.query('SELECT count(*)::int n FROM divine_items WHERE holder_character_id=$1 AND kind=$2', [id, kind])).rows[0].n;
/** Caractéristiques de palier (base d'un rang) reportées sur la fiche au changement de rang. */
export const SPEC_STATS = ['hp_max', 'recovery', 'see', 'strength', 'agility', 'energy_max', 'divine_energy_max'] as const;
/**
 * Change le rang d'un personnage (montée OU descente) : chaque caractéristique de palier reçoit la DIFFÉRENCE entre la base du
 * nouveau rang et celle de l'ancien ; les points achetés par le joueur sont donc conservés (jamais sous 0). `keep` : colonnes
 * laissées telles quelles (valeurs saisies par l'admin dans la même modification). Sans rang d'origine : relevé au niveau du rang.
 * Réserves (PV, énergie, énergie divine actuels) : reçoivent le même écart que leur maximum (180/210 → 330/360 et retour),
 * puis bornées : PV entre 1 et le max, énergies entre 0 et le max.
 */
const RESERVE: Record<string, string> = { hp_max: 'hp_current', energy_max: 'energy_current', divine_energy_max: 'divine_energy_current' };
export async function applySpec(db: any, charId: number, specId: number, keep: readonly string[] = []) {
  const val = (k: string) => `GREATEST(0, c.${k} + s.${k} - COALESCE(o.${k}, LEAST(c.${k}, s.${k})))`;   // nouvelle valeur de la caractéristique k
  const cols = SPEC_STATS.filter(k => !keep.includes(k));
  const set = [...cols.map(k => `, ${k}=${val(k)}`),
    ...cols.filter(k => RESERVE[k] && !keep.includes(RESERVE[k])).map(k => `, ${RESERVE[k]}=c.${RESERVE[k]} + ${val(k)} - c.${k}`)].join('');
  await db.query(`UPDATE characters c SET specialization_id=s.id${set}
    FROM specializations s LEFT JOIN specializations o ON o.id=(SELECT specialization_id FROM characters WHERE id=$1) WHERE s.id=$2 AND c.id=$1`, [charId, specId]);
  await db.query(`UPDATE characters SET hp_current=LEAST(hp_max, GREATEST(1, hp_current)), energy_current=LEAST(energy_max, GREATEST(0, energy_current)),
    divine_energy_current=LEAST(divine_energy_max, GREATEST(0, divine_energy_current)) WHERE id=$1`, [charId]);
}
/** Surcharge divine : plus d'objets que requis => rang supérieur gratuit, quota ignoré. */
export async function refreshSurcharge(db: any, charId: number) {
  const { rows: [ch] } = await db.query('SELECT c.race, s.current_rank FROM characters c JOIN specializations s ON s.id=c.specialization_id WHERE c.id=$1', [charId]);
  const kind = KIND[ch?.race]; if (!kind) return;
  const { rows: specs } = await db.query('SELECT id,current_rank FROM specializations WHERE race=$1', [ch.race]);
  const req: Record<number, number> = {}; specs.forEach((s: any) => req[s.current_rank] = required(s.current_rank));
  const r = effectiveRank(ch.current_rank, await held(db, charId, kind), req);
  if (r > ch.current_rank) await applySpec(db, charId, specs.find((s: any) => s.current_rank === r).id);
}
export const DEAD_MAP = 3;
/** Perte à la mort (pure) : `pct` % de l'XP non dépensée et de l'or porté, arrondi à l'inférieur. */
export const deathLoss = (xp: number, gold: number, pct: number) => ({ xp: Math.floor((Math.max(0, xp) * pct) / 100), gold: Math.floor((Math.max(0, gold) * pct) / 100) });
/** Mort : objets divins au vainqueur (joueur) ou retour aux gardiens (monstre) ; perte de `death_loss_pct` % (règles générales,
 *  25 par défaut) de l'XP non dépensée et de l'or porté ; renvoi au Royaume des Morts, autour de sa porte centrale. */
export async function die(db: any, victim: any, killerCharId: number | null) {
  await db.query('UPDATE divine_items SET holder_character_id=$2 WHERE holder_character_id=$1', [victim.id, killerCharId]);
  if (killerCharId) await refreshSurcharge(db, killerCharId);
  const { rows: [m] } = await db.query('SELECT width w, height h FROM maps WHERE id=$1', [DEAD_MAP]);
  const c = await freeCell(db, DEAD_MAP, Math.floor(m.w / 2), Math.floor(m.h / 2), 20);
  await db.query('UPDATE positions SET map_id=$4, coord_x=$2, coord_y=$3 WHERE character_id=$1', [victim.id, c.x, c.y, DEAD_MAP]);
  const { rows: [v] } = await db.query('SELECT xp, gold FROM characters WHERE id=$1', [victim.id]);
  const loss = deathLoss(Number(v.xp), Number(v.gold), Math.min(100, Math.max(0, Number(await cfgNum('death_loss_pct', 25)) || 0)));
  await db.query('UPDATE characters SET hp_current=hp_max, xp=xp-$2, gold=gold-$3 WHERE id=$1', [victim.id, loss.xp, loss.gold]);
  await log(db, victim.id, `Mort : envoyé au Royaume des Morts${loss.xp || loss.gold ? ` (−${loss.xp} XP, −${loss.gold} or)` : ''}`);
}
/**
 * Transfert propre d'un objet divin (don admin / butin, phases 1-2-4) : une pièce = une ligne
 * avec UN SEUL détenteur (mise à jour du holder, jamais d'insertion => aucune duplication),
 * dans la limite du plafond global du kind (divine_caps).
 */
export async function grantDivine(db: any, toCharId: number, kind: string | null, divineId?: number) {
  if (divineId != null) {   // pièce précise (gardiennage, loot) : transfert propre, jamais d'insertion
    const { rows: [d] } = await db.query('SELECT * FROM divine_items WHERE id=$1', [divineId]);
    if (!d) fail(404, 'Objet divin inconnu');
    if (d.holder_character_id != null) fail(409, 'Cet objet divin est déjà détenu');
    const cap = await divineCap(d.kind);
    if (cap !== null && (await held(db, toCharId, d.kind)) >= cap) fail(409, `Plafond de ${cap} ${d.kind}(s) déjà détenu(s)`);
    await db.query('UPDATE divine_items SET holder_character_id=$2, guardian_monster_id=NULL WHERE id=$1', [divineId, toCharId]);
    await refreshSurcharge(db, toCharId);
    return d;
  }
  const cap = await divineCap(kind);
  if (cap !== null && (await held(db, toCharId, kind)) >= cap) fail(409, `Plafond de ${cap} ${kind}(s) déjà détenu(s)`);
  const r = await db.query('UPDATE divine_items SET holder_character_id=$2 WHERE holder_character_id IS NULL AND kind=$1 RETURNING id', [kind, toCharId]);
  if (!r.rowCount) fail(409, `Aucun ${kind} libre`);
  await refreshSurcharge(db, toCharId);
  return r.rows[0];
}
import { freeCell } from './spawn.js';

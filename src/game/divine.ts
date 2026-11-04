import { effectiveRank } from './rules.js'; import { fail } from '../lib/db.js'; import { divineCap } from './content.js';
export const KIND: Record<string, string> = { human: 'artefact', demon: 'arcane', angel: 'relique' };
export const required = (targetRank: number) => targetRank - 1;   // hypothèse : rang visé N exige N-1 objets
export const held = async (db: any, id: number, kind: string) => (await db.query('SELECT count(*)::int n FROM divine_items WHERE holder_character_id=$1 AND kind=$2', [id, kind])).rows[0].n;
export async function applySpec(db: any, charId: number, specId: number) {
  await db.query(`UPDATE characters c SET specialization_id=s.id, hp_max=GREATEST(c.hp_max,s.hp_max), recovery=GREATEST(c.recovery,s.recovery), see=GREATEST(c.see,s.see),
    strength=GREATEST(c.strength,s.strength), agility=GREATEST(c.agility,s.agility), energy_max=GREATEST(c.energy_max,s.energy_max),
    divine_energy_max=GREATEST(c.divine_energy_max,s.divine_energy_max) FROM specializations s WHERE s.id=$2 AND c.id=$1`, [charId, specId]);
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
/** Mort : objets divins au vainqueur (joueur) ou retour aux gardiens (monstre) ; renvoi au Monde des Morts. */
export async function die(db: any, victim: any, killerCharId: number | null) {
  await db.query('UPDATE divine_items SET holder_character_id=$2 WHERE holder_character_id=$1', [victim.id, killerCharId]);
  if (killerCharId) await refreshSurcharge(db, killerCharId);
  const c = await freeCell(db, 3, 50, 50, 20);
  await db.query('UPDATE positions SET map_id=3, coord_x=$2, coord_y=$3 WHERE character_id=$1', [victim.id, c.x, c.y]);
  await db.query('UPDATE characters SET hp_current=hp_max WHERE id=$1', [victim.id]);
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

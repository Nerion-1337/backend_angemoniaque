import { effectiveRank } from './rules.js';
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
import { freeCell } from './spawn.js';

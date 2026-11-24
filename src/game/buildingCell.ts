import { fail } from '../lib/db.js';
/**
 * Bâtiments occupables (migration 22) : un personnage peut se tenir sur la case d'un bâtiment `occupiable`.
 * Il reçoit alors les bonus de la structure (armure, vue, portée) et n'est attaquable que selon `occupant_attack`
 * (corps à corps = à 1 case, distance = au-delà, sort). Un bâtiment non occupable bloque sa case.
 */
export type AttackKind = 'melee' | 'ranged' | 'spell';
/** Bâtiment occupable sur une case (ou null). */
export async function occupiableAt(db: any, mapId: number, x: number, y: number) {
  const { rows: [b] } = await db.query('SELECT b.* FROM positions p JOIN buildings b ON b.id=p.building_id WHERE p.map_id=$1 AND p.coord_x=$2 AND p.coord_y=$3 AND b.occupiable', [mapId, x, y]);
  return b ?? null;
}
/** Filtre SQL : position qui bloque le passage (toute entité, sauf un bâtiment occupable). */
export const BLOCKING = `item_id IS NULL AND (building_id IS NULL OR building_id NOT IN (SELECT id FROM buildings WHERE occupiable))`;
/** Le personnage sur ce bâtiment peut-il être visé par ce type d'attaque ? (pure) */
export const attackAllowed = (b: any, kind: AttackKind) => !b || (b.occupant_attack ?? {})[kind] !== false;
export const ATTACK_LABEL: Record<AttackKind, string> = { melee: 'au corps à corps', ranged: 'à distance', spell: 'par un sort' };
/** Refuse l'attaque d'un personnage protégé par le bâtiment qu'il occupe (403). */
export async function checkOccupantAttack(db: any, t: { kind: string; pos: any }, kind: AttackKind) {
  if (t.kind !== 'character') return;
  const b = await occupiableAt(db, t.pos.map_id, t.pos.coord_x, t.pos.coord_y);
  if (!attackAllowed(b, kind)) fail(403, `Protégé par ${b.name} : impossible de l'attaquer ${ATTACK_LABEL[kind]}`);
}

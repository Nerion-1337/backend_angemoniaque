import { z } from '../lib/route.js'; import { divineCap } from './content.js';
/**
 * Réapparition réglée sur CHAQUE monstre posé (migrations 24 puis 35) : `respawn` (recréé ou non après la mort), délai
 * `reincarnate_delay_h`, et conditions `respawn_limits` : tant qu'au moins `max` exemplaires d'un élément limité
 * (objet, sort, ressource) sont chez les joueurs, le monstre ne réapparaît pas ; il réapparaît au tick où ce n'est plus le cas.
 * Objet divin porté (`divine_family`) : le monstre porte un exemplaire de la famille à la fois ; il ne réapparaît plus tant que
 * la famille est complète chez les joueurs (plafond de divine_families).
 */
export const RespawnLimit = z.object({
  kind: z.enum(['item', 'spell', 'resource']),
  ref: z.union([z.number().int(), z.string().min(1).max(60)]),
  max: z.number().int().min(1).max(1e6)
});
/** Prototype d'une instance (butin des sauvages, grille d'équipement), sinon la ligne elle-même. */
export async function protoOf(db: any, row: any) {
  const pid = Number(row.data?.prototype);
  if (!pid || pid === row.id) return row;
  return (await db.query('SELECT * FROM monsters WHERE id=$1', [pid])).rows[0] ?? row;
}
/** Exemplaires d'un élément détenus par les joueurs (objets : sac + coffre + équipés ; sorts : appris ; ressources : stocks). */
export async function inCirculation(db: any, l: z.infer<typeof RespawnLimit>) {
  const q = l.kind === 'item' ? 'SELECT COALESCE(sum(qty),0)::int n FROM character_items WHERE item_id=$1::int'
    : l.kind === 'spell' ? 'SELECT count(DISTINCT character_id)::int n FROM character_spells WHERE spell_id=$1::int'
      : "SELECT COALESCE(sum((resources->>$1::text)::numeric),0)::int n FROM characters WHERE resources ? $1::text";
  return (await db.query(q, [l.ref])).rows[0].n as number;
}
/** Exemplaires d'une famille divine détenus par des joueurs. */
export const divineHeld = async (db: any, family: string) =>
  (await db.query('SELECT count(*)::int n FROM divine_items WHERE kind=$1 AND holder_character_id IS NOT NULL', [family])).rows[0].n as number;
/** Ce qui bloque la réapparition de CE monstre (vide = il peut réapparaître). */
export async function respawnBlockers(db: any, m: any) {
  const out: string[] = [];
  for (const raw of m.respawn_limits ?? []) {
    const l = RespawnLimit.safeParse(raw); if (!l.success) continue;
    const n = await inCirculation(db, l.data);
    if (n >= l.data.max) out.push(`${l.data.kind} ${l.data.ref} : ${n}/${l.data.max}`);
  }
  if (m.divine_family) {
    const cap = await divineCap(m.divine_family), n = await divineHeld(db, m.divine_family);
    if (cap !== null && n >= cap) out.push(`${m.divine_family} : ${n}/${cap} chez les joueurs`);
  }
  return out;
}
/**
 * Donne au monstre l'exemplaire divin qu'il porte (s'il n'en porte pas déjà un de sa famille) : un exemplaire libre (ni détenteur
 * ni gardien), sinon un nouvel exemplaire si la famille n'a pas atteint son plafond. Les exemplaires d'une autre famille qu'il
 * gardait redeviennent libres. Renvoie l'id de l'exemplaire porté, ou null.
 */
export async function attachDivine(db: any, m: { id: number; divine_family?: string | null }) {
  await db.query('UPDATE divine_items SET guardian_monster_id=NULL WHERE guardian_monster_id=$1 AND holder_character_id IS NULL AND kind IS DISTINCT FROM $2', [m.id, m.divine_family ?? null]);
  if (!m.divine_family) return null;
  const { rows: [has] } = await db.query('SELECT id FROM divine_items WHERE guardian_monster_id=$1 AND holder_character_id IS NULL AND kind=$2 LIMIT 1', [m.id, m.divine_family]);
  if (has) return has.id as number;
  const { rows: [free] } = await db.query(`UPDATE divine_items SET guardian_monster_id=$1 WHERE id=(SELECT id FROM divine_items
    WHERE kind=$2 AND holder_character_id IS NULL AND guardian_monster_id IS NULL ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id`, [m.id, m.divine_family]);
  if (free) return free.id as number;
  const cap = await divineCap(m.divine_family), total = (await db.query('SELECT count(*)::int n FROM divine_items WHERE kind=$1', [m.divine_family])).rows[0].n;
  if (cap !== null && total >= cap) return null;
  const { rows: [ins] } = await db.query(`INSERT INTO divine_items(kind,item_id,guardian_monster_id)
    VALUES ($1,(SELECT min(id) FROM items WHERE divine_family=$1),$2) RETURNING id`, [m.divine_family, m.id]);
  return ins.id as number;
}

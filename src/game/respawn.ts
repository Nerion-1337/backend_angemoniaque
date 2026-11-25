import { z } from '../lib/route.js';
/**
 * Réapparition des monstres réglée par TYPE (migration 24) : `respawn` (recréé ou non après la mort), délai
 * `reincarnate_delay_h`, et conditions `respawn_limits` : tant qu'au moins `max` exemplaires d'un élément limité
 * (objet, sort, ressource) sont chez les joueurs, le monstre ne réapparaît pas ; il réapparaît au tick où ce n'est
 * plus le cas.
 */
export const RespawnLimit = z.object({
  kind: z.enum(['item', 'spell', 'resource']),
  ref: z.union([z.number().int(), z.string().min(1).max(60)]),
  max: z.number().int().min(1).max(1e6)
});
/** Réglages de réapparition : ceux du type (prototype) pour une instance placée, sinon la ligne elle-même. */
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
/** Ce qui bloque la réapparition d'une instance (vide = elle peut réapparaître). */
export async function respawnBlockers(db: any, proto: any) {
  const out: string[] = [];
  for (const raw of proto.respawn_limits ?? []) {
    const l = RespawnLimit.safeParse(raw); if (!l.success) continue;
    const n = await inCirculation(db, l.data);
    if (n >= l.data.max) out.push(`${l.data.kind} ${l.data.ref} : ${n}/${l.data.max}`);
  }
  return out;
}

/**
 * Couches d'une case (migration 46) : au plus un élément AU SOL et un élément DANS LES AIRS par case (`positions.air`, tenu par
 * trigger : monstre / invocation dont le type vole, personnage monté sur une invocation volante). Un bâtiment occupe les deux
 * couches (on ne le survole pas pour s'y poser) ; un objet au sol ne compte pas.
 */
export const isAirLoco = (l?: string[] | null) => !!l?.includes('air');
/** L'acteur (héros monté ou créature contrôlée) est-il dans les airs ? */
export const actorAir = (a: any) => !!(a?.mount ?? a?.loco)?.flying;
/** Une entité ou un bâtiment occupe-t-il déjà cette couche de la case ? `exceptPos` : position ignorée (déplacement). */
export async function cellTaken(db: any, mapId: number, x: number, y: number, air = false, exceptPos = 0) {
  return !!(await db.query(`SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL AND id<>$5
    AND (building_id IS NOT NULL OR air=$4)`, [mapId, x, y, air, exceptPos])).rowCount;
}

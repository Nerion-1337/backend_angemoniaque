import { FLY_LEVEL } from './levels.js'; import { activeMount, summonLoco } from './movement.js';
/**
 * Portée des attaques (migration 36).
 *  - Portée d'attaque du héros = sa portée (caractéristique, hauteur, bâtiment…) + (portée de son arme − 1) ; sans arme : portée 1.
 *  - Distance à la cible = Pythagore entre la distance au sol (cases) et l'écart de hauteur au-dessus du sol : à pied 0, monture
 *    terrestre / aquatique = sa taille (1 à 3), monture / créature / monstre volant = niveau 6. Le relief du terrain n'entre pas
 *    dans ce calcul (il donne déjà +1 de portée par niveau).
 *    Ex. : arme de portée 1 contre un cavalier (hauteur 1) collé : √(1²+1²) ≈ 1,41 > 1 → hors d'atteinte ; portée 2 : touche.
 *  - Arme à distance : « pleine puissance jusqu'à N cases » ; au-delà, les dégâts baissent linéairement jusqu'à 50 % à la portée max.
 */
export const dist3 = (ground: number, dh: number) => Math.hypot(ground, dh);
/** Distance au sol maximale (cases) pour rester à portée d'une cible à `dh` niveaux d'écart ; 0 = inatteignable. */
export const groundReach = (range: number, dh: number) => (range < dh ? 0 : Math.floor(Math.sqrt(range * range - dh * dh) + 1e-9));
/** Puissance (%) d'un coup à la distance `d` : 100 jusqu'à `fullAt`, puis linéaire jusqu'à 50 % à `range`. */
export function powerAt(d: number, range: number, fullAt: number | null | undefined) {
  if (fullAt == null || d <= fullAt || range <= fullAt) return 100;
  return Math.max(50, Math.round(100 - 50 * Math.min(1, (d - fullAt) / (range - fullAt))));
}
/** Hauteur au-dessus du sol d'une monture montée (null = à pied). */
export const mountElevation = (m: any) => (!m ? 0 : m.flying ? FLY_LEVEL : Math.min(3, Math.max(1, Number(m.size) || 1)));
/** Hauteur de l'acteur (héros monté ou créature contrôlée). */
export const actorElevation = (a: any) => (a.sm ? (a.loco?.flying ? FLY_LEVEL : 0) : mountElevation(a.mount));
/** Hauteur d'une cible : personnage (sa monture), invocation (volante ?), monstre (déplacement aérien ?). */
export async function targetElevation(db: any, t: { kind: string; id: number; row: any }) {
  if (t.kind === 'character') return mountElevation(await activeMount(db, t.id));
  if (t.kind === 'summon') return (await summonLoco(db, t.row))?.flying ? FLY_LEVEL : 0;
  const l: string[] = t.row.locomotion ?? []; return l.includes('air') ? FLY_LEVEL : 0;
}
/** Arme portée la plus longue (main principale ou seconde main) : { reach, fullAt, name } ; sans arme : portée 1. */
export async function weaponReach(db: any, charId: number) {
  const { rows: [w] } = await db.query(`SELECT i.name, i.reach, i.full_power_at FROM character_items ci JOIN items i ON i.id=ci.item_id
    WHERE ci.character_id=$1 AND ci.equipped_slot IN ('weapon_main','weapon_off') ORDER BY i.reach DESC, i.id LIMIT 1`, [charId]);
  return { reach: Math.max(1, Number(w?.reach) || 1), fullAt: w?.full_power_at ?? null, name: w?.name ?? null };
}

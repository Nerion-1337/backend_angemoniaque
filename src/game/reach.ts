import { FLY_LEVEL } from './levels.js'; import { activeMount, summonLoco } from './movement.js';
/**
 * Portée des attaques (migrations 36 et 46). Deux portées :
 *  - arme de MÊLÉE (`items.ranged` faux) : sa seule portée (épée 1, lance 2) ; ni la portée du personnage ni la hauteur ne s'y ajoutent ;
 *  - arme À DISTANCE (arc…) : portée du personnage (caractéristique, hauteur du terrain / de la monture, bâtiment…) + (portée de l'arme − 1).
 *  Sans arme : mêlée, portée 1. Créature contrôlée : sa propre portée.
 *  - Distance à la cible = Pythagore entre la distance au sol (cases) et l'écart de hauteur au-dessus du sol : à pied 0, monture
 *    terrestre / aquatique = sa taille (1 à 3), monture / créature / monstre volant = niveau 6. Le relief du terrain n'entre pas
 *    dans ce calcul (il donne déjà +1 de portée par niveau).
 *    Ex. : arme de portée 1 contre un cavalier (hauteur 1) collé : √(1²+1²) ≈ 1,41 > 1 → hors d'atteinte ; portée 2 : touche.
 *  - Arme à grande portée (migration 37) : puissance de départ à la case 1 (`power_start` %), 100 % à la case X (`full_power_at`),
 *    puissance restante à la dernière case de portée (`power_end` %), linéaire entre ces points ; dégâts arrondis au supérieur.
 */
export const dist3 = (ground: number, dh: number) => Math.hypot(ground, dh);
/** Distance au sol maximale (cases) pour rester à portée d'une cible à `dh` niveaux d'écart ; 0 = inatteignable. */
export const groundReach = (range: number, dh: number) => (range < dh ? 0 : Math.floor(Math.sqrt(range * range - dh * dh) + 1e-9));
/** Puissance (%) d'un coup à la distance `d` (≥ 1, non arrondie) : `start` à la case 1 → 100 à `fullAt` → `end` à `range`.
 *  Sans case de pleine puissance : 100 partout. */
export function powerAt(d: number, range: number, fullAt: number | null | undefined, start = 100, end = 100) {
  if (fullAt == null) return 100;
  if (d <= fullAt) return fullAt <= 1 ? 100 : start + (100 - start) * Math.max(0, d - 1) / (fullAt - 1);
  if (range <= fullAt) return 100;
  return 100 + (end - 100) * Math.min(1, (d - fullAt) / (range - fullAt));
}
/** Dégâts après puissance : arrondis au supérieur. */
export const powered = (dmg: number, pct: number) => Math.ceil(dmg * pct / 100 - 1e-9);
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
  const { rows: [w] } = await db.query(`SELECT i.name, i.reach, i.ranged, i.full_power_at, i.power_start, i.power_end FROM character_items ci JOIN items i ON i.id=ci.item_id
    WHERE ci.character_id=$1 AND ci.equipped_slot IN ('weapon_main','weapon_off') ORDER BY i.ranged DESC, i.reach DESC, i.id LIMIT 1`, [charId]);
  return { reach: Math.max(1, Number(w?.reach) || 1), ranged: !!w?.ranged, fullAt: w?.full_power_at ?? null, start: w?.power_start ?? 100, end: w?.power_end ?? 100, name: w?.name ?? null };
}
/** Portée d'attaque (pure) : `actorRange` = portée du personnage (hauteur comprise) ; mêlée = portée de l'arme seule. */
export const attackRange = (actorRange: number, w: { reach: number; ranged: boolean }) => (w.ranged ? actorRange + w.reach - 1 : w.reach);

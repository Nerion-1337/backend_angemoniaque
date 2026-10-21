import { BURN_DAMAGE } from './terrain.js';
export { BURN_DAMAGE };
/** Durée d'une brûlure après passage sur une case de volcan (renouvelée à chaque passage). Dégâts : BURN_DAMAGE par tick horaire (routes/tick.ts), sans jamais tuer (PV min. 1). */
export const BURN_HOURS = 3;
export const ignite = (db: any, charId: number) => db.query("UPDATE characters SET burn_until = now() + ($2::int * interval '1 hour') WHERE id=$1", [charId, BURN_HOURS]);

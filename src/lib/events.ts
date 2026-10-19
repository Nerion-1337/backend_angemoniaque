/** Événements de combat pour les spectateurs de la carte : données publiques uniquement
 *  (jamais les PV exacts — règle de confidentialité de `map.ts`). */
export const combatEvent = (target: number, killed: boolean, missed = false) => ({ type: 'combat', target, killed, missed });

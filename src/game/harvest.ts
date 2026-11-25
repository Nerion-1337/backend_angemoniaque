import { activate, describeActivation, hasActivation } from './activation.js'; import { resName } from './deposits.js';
/**
 * Conditions de récolte d'une ressource du catalogue (resource_rules, migration 31) : mêmes groupes alternatifs que l'activation
 * d'un bâtiment (objets, sort, ressources, or, rang…) ; les objets ÉQUIPÉS comptent (outil en main). Valent partout : terrain
 * naturel et secteurs. Sans ligne ou sans groupe : récolte libre.
 */
export const harvestRule = async (db: any, resource: string | null) =>
  resource ? (await db.query('SELECT harvest FROM resource_rules WHERE resource=$1', [resource])).rows[0]?.harvest ?? null : null;
/** Refuse (403, ce qui manque par option) ou consomme ce que l'option remplie prévoit. */
export async function checkHarvest(db: any, ch: any, resource: string) {
  const rule = await harvestRule(db, resource);
  if (!hasActivation({ activation: rule })) return;
  await activate(db, ch, { name: resName(resource), activation: rule }, { equipped: true, verb: 'Récolte autorisée :', err: `Récolte de ${resName(resource)} impossible` });
}
/** Texte public pour la carte de case (null = libre). */
export async function harvestNeeds(db: any, resource: string | null) {
  const rule = await harvestRule(db, resource);
  return hasActivation({ activation: rule }) ? describeActivation(db, rule) : null;
}

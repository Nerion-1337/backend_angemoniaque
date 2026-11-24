import { pool, fail } from '../lib/db.js'; import { RES_BY_ID } from './resources.js'; import { RES2_BY_ID } from './resources2.js';
/**
 * Gisements de ressources (resource_deposits, migration 23) : une ressource du catalogue sur une zone d'un monde, avec un
 * stock partagé par la zone. Récolter sur une case de la zone puise dans le stock ; le tick horaire le régénère.
 */
export const resName = (id: string) => ((RES_BY_ID as any)[id] ?? (RES2_BY_ID as any)[id])?.name ?? id;
/** Gisement actif couvrant une case (le plus petit, puis le plus récent), ou null. */
export async function depositAt(db: any, mapId: number, x: number, y: number, lock = false) {
  const { rows: [d] } = await db.query(
    `SELECT * FROM resource_deposits WHERE active AND map_id=$1 AND $2 BETWEEN x_min AND x_max AND $3 BETWEEN y_min AND y_max
     ORDER BY (x_max-x_min+1)*(y_max-y_min+1), id DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [mapId, x, y]);
  return d ?? null;
}
/** Quantité récoltée (pure) : le rendement, borné par le stock. */
export const harvestQty = (stock: number, yieldPer: number) => Math.max(0, Math.min(stock, yieldPer));
/** Puise dans le gisement ; 409 s'il est épuisé. Renvoie { resourceId, name, qty, left }. */
export async function takeFromDeposit(db: any, d: any) {
  const qty = harvestQty(d.stock, d.yield_per_harvest);
  if (!qty) fail(409, `Gisement épuisé (${resName(d.resource)}) : il se régénère de ${d.regen_per_h}/h`);
  await db.query('UPDATE resource_deposits SET stock=stock-$2 WHERE id=$1', [d.id, qty]);
  return { resourceId: d.resource, name: resName(d.resource), qty, left: d.stock - qty };
}
/** Vue publique pour la carte de case. */
export const depositPublic = (d: any) => d && { resourceId: d.resource, resource: resName(d.resource), stock: d.stock, stockMax: d.stock_max, regenPerH: d.regen_per_h, yieldPerHarvest: d.yield_per_harvest };
/** Tick horaire : régénération des stocks jusqu'au maximum. */
export const regenDeposits = () => pool.query('UPDATE resource_deposits SET stock=LEAST(stock_max, stock+regen_per_h) WHERE active AND regen_per_h > 0 AND stock < stock_max');

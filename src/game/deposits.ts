import { pool, fail } from '../lib/db.js'; import { RES_BY_ID } from './resources.js'; import { RES2_BY_ID } from './resources2.js'; import { RES3_BY_ID } from './resources3.js'; import { terrain } from './terrain.js';
/**
 * Secteurs de ressources (resource_deposits + deposit_resources, migrations 23 et 30) : une zone d'un monde qui contient une
 * ou plusieurs ressources, chacune avec sa part de cases (%), un type de case éventuel et son propre stock. Une case reçoit une
 * seule ressource (tirage déterministe, miroir front `admin/deposits.js:pickShare`) ; la part restante garde le terrain naturel.
 */
export const resName = (id: string) => ((RES_BY_ID as any)[id] ?? (RES2_BY_ID as any)[id] ?? (RES3_BY_ID as any)[id])?.name ?? id;
/** Tirage 0..99 d'une case dans un secteur (entiers 32 bits : identique navigateur / serveur). */
export const cellRoll = (x: number, y: number, sid: number) => {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(sid | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) % 100;
};
/** Ressource du secteur sur cette case (ou null = terrain naturel) : parts des ressources admises sur ce type de case, dans l'ordre. */
export function pickShare(shares: any[], kind: string, x: number, y: number, sid: number) {
  const roll = cellRoll(x, y, sid); let acc = 0;
  for (const s of shares) { if (s.kind && s.kind !== kind) continue; acc += s.percent; if (roll < acc) return s; }
  return null;
}
/** Somme des parts par type de case (seuls les types touchés) : { forest: 70, plain: 30, … } ; chaque total doit être ≤ 100. */
export const KINDS = ['plain', 'forest', 'mountain', 'arid', 'snow', 'ether', 'volcano', 'shallow', 'deep'];
export const shareTotals = (shares: any[]) => Object.fromEntries(KINDS.map(k => [k, shares.filter(s => !s.kind || s.kind === k).reduce((a, s) => a + s.percent, 0)]).filter(([, v]) => v));
/** Ressource de secteur d'une case : le plus petit secteur actif qui lui attribue une ressource (puis le plus récent). Ligne deposit_resources + secteur, ou null. */
export async function depositAt(db: any, mapId: number, x: number, y: number, lock = false) {
  const { rows } = await db.query(
    `SELECT d.id, d.name, COALESCE(json_agg(r ORDER BY r.id) FILTER (WHERE r.id IS NOT NULL), '[]') shares FROM resource_deposits d LEFT JOIN deposit_resources r ON r.deposit_id=d.id
     WHERE d.active AND d.map_id=$1 AND $2 BETWEEN d.x_min AND d.x_max AND $3 BETWEEN d.y_min AND d.y_max
     GROUP BY d.id ORDER BY (d.x_max-d.x_min+1)*(d.y_max-d.y_min+1), d.id DESC`, [mapId, x, y]);
  const kind = terrain(x, y, mapId).kind;
  for (const d of rows) {
    const s = pickShare(d.shares, kind, x, y, d.id); if (!s) continue;
    const r = lock ? (await db.query('SELECT * FROM deposit_resources WHERE id=$1 FOR UPDATE', [s.id])).rows[0] : s;
    return { ...r, sector: d.name, sector_id: d.id };
  }
  return null;
}
/** Quantité récoltée (pure) : le rendement, borné par le stock. */
export const harvestQty = (stock: number, yieldPer: number) => Math.max(0, Math.min(stock, yieldPer));
/** Puise dans le stock de la ressource du secteur ; 409 s'il est épuisé. Renvoie { resourceId, name, qty, left }. */
export async function takeFromDeposit(db: any, d: any) {
  const qty = harvestQty(d.stock, d.yield_per_harvest);
  if (!qty) fail(409, `Gisement épuisé (${resName(d.resource)}) : il se régénère de ${d.regen_per_h}/h`);
  await db.query('UPDATE deposit_resources SET stock=stock-$2 WHERE id=$1', [d.id, qty]);
  return { resourceId: d.resource, name: resName(d.resource), qty, left: d.stock - qty };
}
/** Vue publique pour la carte de case. */
export const depositPublic = (d: any) => d && { sector: d.sector, resourceId: d.resource, resource: resName(d.resource), stock: d.stock, stockMax: d.stock_max, regenPerH: d.regen_per_h, yieldPerHarvest: d.yield_per_harvest };
/** Tick horaire : régénération des stocks (secteurs actifs) jusqu'au maximum. */
export const regenDeposits = () => pool.query(`UPDATE deposit_resources r SET stock=LEAST(stock_max, stock+regen_per_h) FROM resource_deposits d
  WHERE d.id=r.deposit_id AND d.active AND r.regen_per_h > 0 AND r.stock < r.stock_max`);

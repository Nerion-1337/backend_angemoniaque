import { resName } from './deposits.js';
/**
 * Sac et coffre (migration 33) : les objets prennent un emplacement chacun ; les ressources (characters.resources pour le sac,
 * chest_resources pour le coffre) se rangent par piles de `stack_max` (resource_rules, défaut 20) : une pile = un emplacement.
 */
export const DEFAULT_STACK = 20;
/** Quantité par emplacement de chaque ressource (défaut 20). */
export async function stackOf(db: any) {
  const { rows } = await db.query('SELECT resource, stack_max FROM resource_rules');
  const m = new Map(rows.map((r: any) => [r.resource, r.stack_max]));
  return (id: string) => (m.get(id) as number) ?? DEFAULT_STACK;
}
/** Emplacements occupés par des ressources : une pile par tranche de `stack` unités. */
export const resSlots = (res: Record<string, number> | null, st: (id: string) => number) =>
  Object.entries(res ?? {}).reduce((n, [k, q]) => n + Math.ceil(Math.max(0, Number(q) || 0) / st(k)), 0);
/** Piles affichables : [{ id, name, qty, stack }] (une entrée par emplacement). */
export const resStacks = (res: Record<string, number> | null, st: (id: string) => number) => {
  const out: { id: string; name: string; qty: number; stack: number }[] = [];
  for (const [k, q0] of Object.entries(res ?? {})) { let q = Math.max(0, Number(q0) || 0); const s = st(k); while (q > 0) { out.push({ id: k, name: resName(k), qty: Math.min(q, s), stack: s }); q -= s; } }
  return out.sort((a, b) => a.name.localeCompare(b.name) || b.qty - a.qty);
};
/** Sac : { size, used } (objets non équipés hors coffre + piles de ressources). */
export async function bagState(db: any, id: number) {
  const { rows: [c] } = await db.query(`SELECT bag_size, resources, (SELECT count(*)::int FROM character_items WHERE character_id=$1 AND NOT in_chest AND equipped_slot IS NULL) items FROM characters WHERE id=$1`, [id]);
  const st = await stackOf(db);
  return { size: c.bag_size, used: c.items + resSlots(c.resources, st), st, resources: c.resources ?? {} };
}
/** Coffre : { size, used } (objets du coffre + piles de ressources du coffre). */
export async function chestState(db: any, id: number) {
  const { rows: [c] } = await db.query(`SELECT chest_size, chest_resources, (SELECT count(*)::int FROM character_items WHERE character_id=$1 AND in_chest) items FROM characters WHERE id=$1`, [id]);
  const st = await stackOf(db);
  return { size: c.chest_size, used: c.items + resSlots(c.chest_resources, st), st, resources: c.chest_resources ?? {} };
}
/** Emplacements libres dans le sac. */
export const bagRoom = async (db: any, id: number) => { const b = await bagState(db, id); return b.size - b.used; };
/** Emplacements supplémentaires nécessaires pour ajouter `qty` d'une ressource à une réserve. */
export const extraSlots = (res: Record<string, number>, id: string, qty: number, st: (id: string) => number) =>
  Math.ceil((Math.max(0, Number(res[id]) || 0) + qty) / st(id)) - Math.ceil(Math.max(0, Number(res[id]) || 0) / st(id));

/** Catégorie d'affichage (filtres de l'Hôtel de ville, 2026-11-28) d'un objet `i` : structure (parchemin de construction ou de
 *  structure), invocation (parchemin d'un sort d'invocation), sort (parchemin d'un autre sort), ressource, sinon objet. */
export const ITEM_CAT = (i: string) => `(CASE WHEN ${i}.data->>'kind' IN ('wall','tower','factory','totem','building') OR EXISTS (SELECT 1 FROM recipes r WHERE r.scroll_item_id=${i}.id AND r.target_kind='building') THEN 'structure'
  WHEN EXISTS (SELECT 1 FROM recipes r JOIN spells s ON s.id=r.target_id WHERE r.scroll_item_id=${i}.id AND r.target_kind='spell' AND (s.kind='summon' OR s.effects ? 'summon')) THEN 'invocation'
  WHEN EXISTS (SELECT 1 FROM recipes r WHERE r.scroll_item_id=${i}.id AND r.target_kind='spell') THEN 'sort'
  WHEN ${i}.slot='resource' OR ${i}.data->>'kind' LIKE 'resource%' THEN 'ressource' ELSE 'objet' END)`;
export const SPELL_CAT = (s: string) => `(CASE WHEN ${s}.kind='summon' OR ${s}.effects ? 'summon' THEN 'invocation' ELSE 'sort' END)`;

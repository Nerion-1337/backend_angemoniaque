import { def, router, z, P } from '../lib/route.js'; import { pool, tx, ownChar, fail, log } from '../lib/db.js'; import { copyBuilding } from '../game/spellSummon.js';
import { actor, spend, spendDivine } from '../game/movement.js'; import { terrain } from '../game/terrain.js'; import { broadcast } from '../realtime/ws.js';
import { atCapital } from './market.js'; import { bagRoom } from '../game/bag.js';
/**
 * Fabrication : un parchemin (dans le SAC) + les ressources de sa recette → objet (au sac), sort appris, ou bâtiment
 * (copie du modèle, posée sur une case adjacente libre). Recette : parchemin consommé ou non, hôtel de ville requis ou non,
 * coût en énergie (payé par le personnage).
 */
export const craft = router();
/** Ressources manquantes pour une recette (clé = id du catalogue). Pure. */
export const missing = (need: Record<string, number>, have: Record<string, number>) =>
  Object.fromEntries(Object.entries(need ?? {}).filter(([k, q]) => (have?.[k] ?? 0) < q).map(([k, q]) => [k, q - (have?.[k] ?? 0)]));
const RECIPES = `SELECT r.*, i.name scroll_name,
  CASE r.target_kind WHEN 'item' THEN (SELECT name FROM items WHERE id=r.target_id) WHEN 'spell' THEN (SELECT name FROM spells WHERE id=r.target_id)
    ELSE (SELECT name FROM buildings WHERE id=r.target_id) END target_name
  FROM recipes r JOIN items i ON i.id=r.scroll_item_id
  WHERE r.scroll_item_id IN (SELECT item_id FROM character_items WHERE character_id=$1 AND NOT in_chest)`;
/** Recettes accessibles : celles dont le parchemin est dans le sac, avec les ressources manquantes. */
def(craft, 'get', '/craft/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  const { rows } = await db.query(`${RECIPES} ORDER BY r.id`, [me.id]);
  return rows.map((r: any) => ({ ...r, missing: missing(r.resources, me.resources) }));
}));
def(craft, 'post', '/craft', z.object({ characterId: z.number(), recipeId: z.number(), x: z.number().int().optional(), y: z.number().int().optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId);
  const { rows: [r] } = await db.query(`${RECIPES} AND r.id=$2`, [me.id, b.recipeId]);
  if (!r) fail(403, 'Parchemin requis dans le sac');
  if (r.at_capital) await atCapital(db, me);
  const lack = missing(r.resources, me.resources);
  if (Object.keys(lack).length) fail(409, `Ressources manquantes : ${Object.entries(lack).map(([k, q]) => `${k} ×${q}`).join(', ')}`);
  const a = await actor(db, me);
  // Résultat (contrôles AVANT toute consommation)
  let place: { x: number; y: number } | null = null;
  if (r.target_kind === 'spell' && (await db.query('SELECT 1 FROM character_spells WHERE character_id=$1 AND spell_id=$2', [me.id, r.target_id])).rowCount) fail(409, 'Sort déjà appris');
  if (r.target_kind === 'building') {
    if (b.x === undefined || b.y === undefined) fail(400, 'Case cible requise');
    if (Math.max(Math.abs(b.x - a.mp.coord_x), Math.abs(b.y - a.mp.coord_y)) !== 1) fail(409, 'Choisissez une case adjacente');
    if (['shallow', 'deep', 'volcano'].includes(terrain(b.x, b.y, a.mp.map_id).kind) || (await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [a.mp.map_id, b.x, b.y])).rowCount) fail(409, 'Case indisponible');
    place = { x: b.x, y: b.y };
  }
  await spendDivine(db, me, r.divine_energy_cost ?? 0); await spend(db, me, a, r.energy_cost, 'action');
  // Consommation : ressources, puis parchemin si la recette le prévoit
  for (const [k, q] of Object.entries(r.resources ?? {}))
    await db.query("UPDATE characters SET resources=jsonb_set(resources, ARRAY[$2::text], to_jsonb(COALESCE((resources->>$2)::int,0) - $3)) WHERE id=$1", [me.id, k, q]);
  if (r.consume_scroll)
    await db.query('DELETE FROM character_items WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND NOT in_chest LIMIT 1)', [me.id, r.scroll_item_id]);
  if (r.target_kind === 'item') {
    if (await bagRoom(db, me.id) <= 0) fail(409, 'Inventaire plein');
    const up = await db.query('UPDATE character_items SET qty=qty+$3 WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND NOT in_chest AND equipped_slot IS NULL LIMIT 1)', [me.id, r.target_id, r.qty_out]);
    if (!up.rowCount) await db.query('INSERT INTO character_items(character_id,item_id,qty) VALUES ($1,$2,$3)', [me.id, r.target_id, r.qty_out]);
  } else if (r.target_kind === 'spell') {
    await db.query('INSERT INTO character_spells(character_id,spell_id) VALUES ($1,$2)', [me.id, r.target_id]);
  } else {
    await copyBuilding(db, r.target_id, me.id, a.mp.map_id, place!.x, place!.y);   // copie complète (caractéristiques + sorts liés)
    broadcast(a.mp.map_id, { type: 'built' });
  }
  await log(db, me.id, `Fabrique : ${r.target_name}`);
  return { ok: true, kind: r.target_kind, name: r.target_name };
}));

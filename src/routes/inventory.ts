import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z, P } from '../lib/route.js'; import { tx, ownChar, fail } from '../lib/db.js';
export const inventory = new OpenAPIHono();
const GROUP: Record<string, string[]> = { weapon: ['weapon_main', 'weapon_off'], shield: ['weapon_off'], bow: ['bow'], head: ['head'], chest: ['chest'], foot: ['foot'], amulet: ['amulet'],
  ring: ['ring_l', 'ring_r'], bracelet: ['bracelet_l', 'bracelet_r'], special: ['special_1', 'special_2', 'special_3', 'special_4', 'special_5'] };
def(inventory, 'get', '/inventory/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  const items = (await db.query('SELECT i.id,i.name,i.slot,i.rarity,ci.equipped_slot FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND NOT ci.in_chest', [me.id])).rows;
  return { items, specialSlots: me.race === 'human' ? 5 : 4, bagMax: 20, resources: me.resources };
}));
def(inventory, 'post', '/inventory/equip', z.object({ characterId: z.number(), itemId: z.number(), slot: z.string().nullable() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const { rows: [it] } = await db.query('SELECT i.* FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND i.id=$2 AND NOT ci.in_chest LIMIT 1', [me.id, b.itemId]); if (!it) fail(404, 'Objet introuvable');
  if (b.slot === null) { await db.query('UPDATE character_items SET equipped_slot=NULL WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND equipped_slot IS NOT NULL LIMIT 1)', [me.id, it.id]); return { ok: true }; }
  if (!GROUP[it.slot]?.includes(b.slot)) fail(400, 'Emplacement incompatible'); if (b.slot === 'special_5' && me.race !== 'human') fail(400, 'Emplacement réservé aux Humains');
  if ((await db.query('SELECT 1 FROM character_items WHERE character_id=$1 AND equipped_slot=$2', [me.id, b.slot])).rowCount) fail(409, 'Emplacement occupé');
  if (b.slot === 'weapon_off' && (await db.query("SELECT 1 FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.equipped_slot='weapon_main' AND i.data->>'hands'='2'", [me.id])).rowCount) fail(409, 'Arme à deux mains équipée');
  await db.query('UPDATE character_items SET equipped_slot=$3 WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND equipped_slot IS NULL LIMIT 1)', [me.id, it.id, b.slot]); return { ok: true };
}));

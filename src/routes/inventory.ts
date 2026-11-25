import { OpenAPIHono } from '@hono/zod-openapi'; import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log } from '../lib/db.js'; import { bagState, resStacks } from '../game/bag.js';
import { gainXp } from '../game/xp.js';
export const inventory = router();
/** Emplacements acceptés par type d'objet. Plus d'emplacement « arc » : un arc est une arme à deux mains (`two_handed`, migration 32). */
/** Emplacements portés par un monstre ou une créature possédée (migration 35) : ceux d'un personnage, sans objets spéciaux. */
export const MONSTER_SLOTS = ['weapon_main', 'weapon_off', 'head', 'chest', 'foot', 'amulet', 'ring_l', 'ring_r', 'bracelet_l', 'bracelet_r'] as const;
export const GROUP: Record<string, string[]> = { weapon: ['weapon_main', 'weapon_off'], shield: ['weapon_off'], head: ['head'], chest: ['chest'], foot: ['foot'], amulet: ['amulet'],
  ring: ['ring_l', 'ring_r'], bracelet: ['bracelet_l', 'bracelet_r'], special: ['special_1', 'special_2', 'special_3', 'special_4', 'special_5'] };
def(inventory, 'get', '/inventory/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  const items = (await db.query(`SELECT i.id,i.name,i.slot,i.two_handed,i.rarity,i.data,i.armor,i.magic_armor,i.bonuses,i.req_strength,i.weapon_damage,i.reach,i.full_power_at,i.power_start,i.power_end,i.strength_bonus,i.agility_bonus,ci.equipped_slot, GREATEST(0, EXTRACT(EPOCH FROM (ci.equipped_at + interval '12 hours' - now())))::int lock_seconds, ci.qty FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND NOT ci.in_chest`, [me.id])).rows;
  const bag = await bagState(db, me.id);
  return { items, lockHours: 12, specialSlots: me.race === 'human' ? 5 : 4, bagMax: bag.size, bagUsed: bag.used, resources: me.resources, resStacks: resStacks(bag.resources, bag.st) };
}));
def(inventory, 'post', '/inventory/equip', z.object({ characterId: z.number(), itemId: z.number(), slot: z.string().nullable() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const { rows: [it] } = await db.query('SELECT i.* FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND i.id=$2 AND NOT ci.in_chest LIMIT 1', [me.id, b.itemId]); if (!it) fail(404, 'Objet introuvable');
  if (b.slot === null) {       // un équipement mis en place est verrouillé 12 h
    const r = await db.query("UPDATE character_items SET equipped_slot=NULL, equipped_at=NULL WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND equipped_slot IS NOT NULL AND (equipped_at IS NULL OR equipped_at <= now() - interval '12 hours') LIMIT 1)", [me.id, it.id]);
    if (!r.rowCount) { const { rows: [lk] } = await db.query("SELECT GREATEST(0, EXTRACT(EPOCH FROM (min(equipped_at) + interval '12 hours' - now())))::int secs FROM character_items WHERE character_id=$1 AND item_id=$2 AND equipped_slot IS NOT NULL", [me.id, it.id]);
      fail(409, `Équipement verrouillé : encore ${Math.floor((lk?.secs ?? 0) / 3600)} h ${Math.ceil(((lk?.secs ?? 0) % 3600) / 60)} min`); }
    return { ok: true }; }
  if (!GROUP[it.slot]?.includes(b.slot)) fail(400, 'Emplacement incompatible');
  if (it.two_handed && b.slot !== 'weapon_main') fail(400, 'Arme à deux mains : main principale seulement');
  if (it.two_handed && (await db.query("SELECT 1 FROM character_items WHERE character_id=$1 AND equipped_slot='weapon_off'", [me.id])).rowCount) fail(409, 'Arme à deux mains : libérez d\'abord l\'autre main'); if (b.slot === 'special_5' && me.race !== 'human') fail(400, 'Emplacement réservé aux Humains');
  if ((await db.query('SELECT 1 FROM character_items WHERE character_id=$1 AND equipped_slot=$2', [me.id, b.slot])).rowCount) fail(409, 'Emplacement occupé');
  if (b.slot === 'weapon_off' && (await db.query("SELECT 1 FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.equipped_slot='weapon_main' AND i.two_handed", [me.id])).rowCount) fail(409, 'Arme à deux mains équipée : l\'autre main est occupée');
  await db.query('UPDATE character_items SET equipped_slot=$3, equipped_at=now() WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND equipped_slot IS NULL LIMIT 1)', [me.id, it.id, b.slot]); return { ok: true };
}));
/** Utiliser un objet du sac. Parchemin d'agrandissement du sac (data = { kind: 'bag', add, max }) : +add emplacements jusqu'à max ; consommé. */
def(inventory, 'post', '/inventory/use', z.object({ characterId: z.number(), itemId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId);
  const { rows: [line] } = await db.query('SELECT ci.ctid::text, ci.qty, i.name, i.data, i.xp_use FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.item_id=$2 AND NOT ci.in_chest AND ci.equipped_slot IS NULL LIMIT 1', [me.id, b.itemId]);
  if (!line) fail(404, 'Objet absent du sac');
  const d = line.data ?? {};
  if (d.kind !== 'bag') fail(400, 'Cet objet ne s\'utilise pas ainsi');
  const add = Math.max(0, Number(d.add) || 0), max = Math.max(0, Number(d.max) || 0);
  if (!add || me.bag_size >= max) fail(409, `Votre sac a déjà ${me.bag_size} emplacements : ce parchemin l'agrandit jusqu'à ${max} au plus`);
  const size = Math.min(max, me.bag_size + add);
  await db.query('UPDATE characters SET bag_size=$2 WHERE id=$1', [me.id, size]);
  if ((line.qty ?? 1) > 1) await db.query('UPDATE character_items SET qty=qty-1 WHERE ctid=$1::tid', [line.ctid]); else await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [line.ctid]);
  const xp = await gainXp(db, me.id, line.xp_use ?? 0);   // XP d'utilisation de l'objet (migration 35)
  await log(db, me.id, `Utilise ${line.name} : sac à ${size} emplacements${xp ? ` (+${xp} XP)` : ''}`);
  return { ok: true, bagSize: size, xp };
}));

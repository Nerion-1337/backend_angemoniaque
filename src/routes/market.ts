import { OpenAPIHono } from '@hono/zod-openapi'; import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, posOf, fail, log, dist } from '../lib/db.js';
import { cfgNum } from '../game/content.js'; import { bagRoom, bagState, chestState, resStacks, extraSlots } from '../game/bag.js'; import { resName } from '../game/deposits.js';
import { ITEM_CAT, SPELL_CAT } from '../game/bag.js';
export const market = router();
const TBL: Record<string, [string, string]> = { item: ['character_items', 'item_id'], spell: ['character_spells', 'spell_id'] };
/** Coffre réglé par capitale (admin Bâtiments, data.chestStart / chestMax) : taille de départ (10) et capacité max (aucune). */
export async function chestLimits(db: any, race: string) {
  const { rows: [b] } = await db.query("SELECT data FROM buildings WHERE kind='capital' AND data->>'race'=$1 LIMIT 1", [race]);
  const n = (v: any) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.trunc(Number(v)) : null);
  return { start: n(b?.data?.chestStart) ?? 10, max: n(b?.data?.chestMax) };
}
export async function atCapital(db: any, ch: any) {
  const mp = await posOf(db, ch.id); const { rows } = await db.query(`SELECT p.coord_x,p.coord_y,p.map_id FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.kind='capital' AND b.data->>'race'=$1`, [ch.race]);
  if (!rows.some((r: any) => r.map_id === mp.map_id && dist(mp, r) <= 2)) fail(409, 'Rendez-vous à la capitale de votre faction');
}
/** Boutique de l'hôtel de ville : objets et sorts en vente (shop) pour la race du personnage (shop_races vide = toutes). */
const FOR_RACE = `shop AND (shop_races='[]'::jsonb OR shop_races ? $1)`;
def(market, 'get', '/shop', null, async c => { const { pool } = await import('../lib/db.js');
  const cid = Number(c.req.query('characterId')); const race = cid ? (await ownChar(pool, c, cid)).race : null;
  const w = race ? FOR_RACE : 'shop', a = race ? [race] : [];
  return { items: (await pool.query(`SELECT id,name,slot,price,shop_stock stock,armor,weapon_damage,req_strength,rarity, ${ITEM_CAT('items')} cat FROM items WHERE ${w} ORDER BY price`, a)).rows,
    spells: (await pool.query(`SELECT id,name,kind,price,energy_cost,divine_energy_cost,description,rarity, ${SPELL_CAT('spells')} cat FROM spells WHERE ${w} ORDER BY price`, a)).rows,
    mapUpgrade: { price: await mapUpgradePrice() } }; });
/** Carte des ressources (migrations 32, 38) : la carte du monde met en valeur la ressource choisie. Achetée à l'Hôtel de ville, elle
 *  n'ouvre QUE le monde de cette capitale (`characters.map_worlds`) ; les autres mondes s'ouvrent par leur parchemin. Prix réglé en admin. */
export const mapUpgradePrice = async () => Number(await cfgNum('map_upgrade_price', 500));
def(market, 'post', '/shop/map-upgrade', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me); const world = (await posOf(db, me.id)).map_id;
  if ((me.map_worlds ?? []).includes(world)) fail(409, 'Vous avez déjà la carte des ressources de ce monde');
  const price = await mapUpgradePrice(); if (me.gold < price) fail(409, 'Or insuffisant');
  await db.query('UPDATE characters SET gold=gold-$2, map_worlds=array_append(map_worlds,$3) WHERE id=$1', [me.id, price, world]); await log(db, me.id, `Achète la carte des ressources du monde ${world} (${price} or)`); return { ok: true, world };
}));
def(market, 'post', '/shop/learn', z.object({ characterId: z.number(), spellId: z.number() }), (c, b) => tx(async db => {      // les sorts de base s'apprennent à la capitale
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me); const { rows: [sp] } = await db.query(`SELECT * FROM spells WHERE id=$2 AND ${FOR_RACE}`, [me.race, b.spellId]); if (!sp) fail(404, 'Sort introuvable');
  if ((await db.query('SELECT 1 FROM character_spells WHERE character_id=$1 AND spell_id=$2', [me.id, sp.id])).rowCount) fail(409, 'Sort déjà appris'); if (me.gold < sp.price) fail(409, 'Or insuffisant');
  await db.query('UPDATE characters SET gold=gold-$2 WHERE id=$1', [me.id, sp.price]); await db.query('INSERT INTO character_spells(character_id,spell_id) VALUES ($1,$2)', [me.id, sp.id]); await log(db, me.id, `Apprend le sort ${sp.name}`); return { ok: true };
}));
def(market, 'post', '/shop/buy', z.object({ characterId: z.number(), itemId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me);
  const { rows: [it] } = await db.query(`SELECT * FROM items WHERE id=$2 AND ${FOR_RACE}`, [me.race, b.itemId]); if (!it) fail(404, 'Article introuvable');
  if (it.shop_stock <= 0) fail(409, 'Réserve de la faction épuisée'); if (me.gold < it.price) fail(409, 'Or insuffisant'); if (await bagRoom(db, me.id) <= 0) fail(409, 'Inventaire plein');
  await db.query('UPDATE items SET shop_stock=shop_stock-1 WHERE id=$1', [it.id]); await db.query('UPDATE characters SET gold=gold-$2 WHERE id=$1', [me.id, it.price]); await db.query('INSERT INTO character_items(character_id,item_id) VALUES ($1,$2)', [me.id, it.id]); return { ok: true };
}));
def(market, 'post', '/market/list', z.object({ characterId: z.number(), kind: z.enum(['item', 'spell']), refId: z.number(), price: z.number().int().positive() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me); const [t, col] = TBL[b.kind];
  const r = await db.query(`DELETE FROM ${t} WHERE ctid=(SELECT ctid FROM ${t} WHERE character_id=$1 AND ${col}=$2 ${b.kind === 'item' ? 'AND equipped_slot IS NULL' : ''} LIMIT 1)`, [me.id, b.refId]);
  if (!r.rowCount) fail(404, 'Objet non possédé (ou équipé)');
  await db.query('INSERT INTO market_listings(seller_id,race,kind,ref_id,price) VALUES ($1,$2,$3,$4,$5)', [me.id, me.race, b.kind, b.refId, b.price]); return { ok: true };
}));
def(market, 'get', '/market/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId')); await atCapital(db, me);
  return (await db.query(`SELECT l.*, COALESCE(i.name,s.name) name, COALESCE(i.rarity,s.rarity) rarity, CASE WHEN l.kind='item' THEN ${ITEM_CAT('i')} ELSE ${SPELL_CAT('s')} END cat FROM market_listings l LEFT JOIN items i ON l.kind='item' AND i.id=l.ref_id LEFT JOIN spells s ON l.kind='spell' AND s.id=l.ref_id WHERE NOT l.sold AND l.race=$1`, [me.race])).rows; }));
def(market, 'post', '/market/{id}/buy', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me);
  const { rows: [l] } = await db.query('SELECT * FROM market_listings WHERE id=$1 AND NOT sold AND race=$2 FOR UPDATE', [P(c, 'id'), me.race]); if (!l) fail(404, 'Annonce introuvable (même race uniquement)');
  if (me.gold < l.price) fail(409, 'Or insuffisant'); const [t, col] = TBL[l.kind];
  await db.query('UPDATE characters SET gold=gold-$2 WHERE id=$1', [me.id, l.price]); await db.query('UPDATE characters SET gold=gold+$2 WHERE id=$1', [l.seller_id, l.price]);
  await db.query(`INSERT INTO ${t}(character_id,${col}) VALUES ($1,$2)`, [me.id, l.ref_id]); await db.query('UPDATE market_listings SET sold=true WHERE id=$1', [l.id]); await log(db, me.id, `Achat marketplace #${l.id}`); return { ok: true };
}));
def(market, 'get', '/chest/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId')); await atCapital(db, me);
  const ch = await chestState(db, me.id);
  return { size: me.chest_size, max: (await chestLimits(db, me.race)).max, used: ch.used, nextCost: 50 * me.chest_size, items: (await db.query(`SELECT i.id,i.name,i.rarity, ${ITEM_CAT('i')} cat FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.in_chest`, [me.id])).rows,
    resources: resStacks(ch.resources, ch.st) }; }));
/** Ressources entre sac et coffre (tout, ou `qty`) : place vérifiée en piles des deux côtés. */
def(market, 'post', '/chest/resource', z.object({ characterId: z.number(), resource: z.string().max(60), qty: z.number().int().min(1).optional(), to: z.enum(['chest', 'bag']) }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me); const toChest = b.to === 'chest';
  const from = toChest ? await bagState(db, me.id) : await chestState(db, me.id), dest = toChest ? await chestState(db, me.id) : await bagState(db, me.id);
  const have = Number(from.resources[b.resource]) || 0, qty = Math.min(have, b.qty ?? have);
  if (!qty) fail(404, `Aucune ressource « ${resName(b.resource)} » ${toChest ? 'dans le sac' : 'dans le coffre'}`);
  if (dest.used + extraSlots(dest.resources, b.resource, qty, dest.st) > dest.size) fail(409, toChest ? 'Coffre plein' : 'Sac plein');
  const [src, dst] = toChest ? ['resources', 'chest_resources'] : ['chest_resources', 'resources'];
  await db.query(`UPDATE characters SET ${src}=jsonb_set(${src}, ARRAY[$2::text], to_jsonb(COALESCE((${src}->>$2)::int,0) - $3)),
    ${dst}=jsonb_set(${dst}, ARRAY[$2::text], to_jsonb(COALESCE((${dst}->>$2)::int,0) + $3)) WHERE id=$1`, [me.id, b.resource, qty]);
  return { ok: true, qty };
}));
def(market, 'post', '/chest/expand', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me); const cost = 50 * me.chest_size;   // coût progressif
  const { max } = await chestLimits(db, me.race); if (max && me.chest_size >= max) fail(409, `Coffre à sa capacité maximale (${max} emplacements)`);
  if (me.gold < cost) fail(409, `Or insuffisant (${cost})`); await db.query('UPDATE characters SET gold=gold-$2, chest_size=chest_size+1 WHERE id=$1', [me.id, cost]); return { size: me.chest_size + 1, cost };
}));
def(market, 'post', '/chest/move', z.object({ characterId: z.number(), itemId: z.number(), to: z.enum(['chest', 'bag']) }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me); const toChest = b.to === 'chest';
  if (toChest) { const ch = await chestState(db, me.id); if (ch.used >= ch.size) fail(409, 'Coffre plein'); }
  if (!toChest && await bagRoom(db, me.id) <= 0) fail(409, 'Inventaire plein');
  const r = await db.query(`UPDATE character_items SET in_chest=$3 WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND in_chest=$4 AND equipped_slot IS NULL LIMIT 1)`, [me.id, b.itemId, toChest, !toChest]);
  if (!r.rowCount) fail(404, 'Objet introuvable'); return { ok: true };
}));

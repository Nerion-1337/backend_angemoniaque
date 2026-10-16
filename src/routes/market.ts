import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z, P } from '../lib/route.js'; import { tx, ownChar, posOf, fail, log, dist } from '../lib/db.js';
export const market = new OpenAPIHono();
const TBL: Record<string, [string, string]> = { item: ['character_items', 'item_id'], spell: ['character_spells', 'spell_id'], mount: ['character_mounts', 'mount_id'] };
const BAG_MAX = 20;
async function atCapital(db: any, ch: any) {
  const mp = await posOf(db, ch.id); const { rows } = await db.query(`SELECT p.coord_x,p.coord_y,p.map_id FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.kind='capital' AND b.data->>'race'=$1`, [ch.race]);
  if (!rows.some((r: any) => r.map_id === mp.map_id && dist(mp, r) <= 2)) fail(409, 'Rendez-vous à la capitale de votre faction');
}
const bagCount = async (db: any, id: number) => (await db.query('SELECT count(*)::int n FROM character_items WHERE character_id=$1 AND NOT in_chest AND equipped_slot IS NULL', [id])).rows[0].n;
def(market, 'get', '/shop', null, async c => (await (await import('../lib/db.js')).pool.query('SELECT id,name,slot,price FROM items WHERE shop ORDER BY price')).rows);
def(market, 'post', '/shop/buy', z.object({ characterId: z.number(), itemId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me);
  const { rows: [it] } = await db.query('SELECT * FROM items WHERE id=$1 AND shop', [b.itemId]); if (!it) fail(404, 'Article introuvable');
  if (me.gold < it.price) fail(409, 'Or insuffisant'); if (await bagCount(db, me.id) >= BAG_MAX) fail(409, 'Inventaire plein');
  await db.query('UPDATE characters SET gold=gold-$2 WHERE id=$1', [me.id, it.price]); await db.query('INSERT INTO character_items(character_id,item_id) VALUES ($1,$2)', [me.id, it.id]); return { ok: true };
}));
def(market, 'post', '/market/list', z.object({ characterId: z.number(), kind: z.enum(['item', 'spell', 'mount']), refId: z.number(), price: z.number().int().positive() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me); const [t, col] = TBL[b.kind];
  const r = await db.query(`DELETE FROM ${t} WHERE ctid=(SELECT ctid FROM ${t} WHERE character_id=$1 AND ${col}=$2 ${b.kind === 'item' ? 'AND equipped_slot IS NULL' : ''} LIMIT 1)`, [me.id, b.refId]);
  if (!r.rowCount) fail(404, 'Objet non possédé (ou équipé)');
  await db.query('INSERT INTO market_listings(seller_id,race,kind,ref_id,price) VALUES ($1,$2,$3,$4,$5)', [me.id, me.race, b.kind, b.refId, b.price]); return { ok: true };
}));
def(market, 'get', '/market/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId')); await atCapital(db, me);
  return (await db.query(`SELECT l.*, COALESCE(i.name,s.name,m.name) name FROM market_listings l LEFT JOIN items i ON l.kind='item' AND i.id=l.ref_id LEFT JOIN spells s ON l.kind='spell' AND s.id=l.ref_id LEFT JOIN mounts m ON l.kind='mount' AND m.id=l.ref_id WHERE NOT l.sold AND l.race=$1`, [me.race])).rows; }));
def(market, 'post', '/market/{id}/buy', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me);
  const { rows: [l] } = await db.query('SELECT * FROM market_listings WHERE id=$1 AND NOT sold AND race=$2 FOR UPDATE', [P(c, 'id'), me.race]); if (!l) fail(404, 'Annonce introuvable (même race uniquement)');
  if (me.gold < l.price) fail(409, 'Or insuffisant'); const [t, col] = TBL[l.kind];
  await db.query('UPDATE characters SET gold=gold-$2 WHERE id=$1', [me.id, l.price]); await db.query('UPDATE characters SET gold=gold+$2 WHERE id=$1', [l.seller_id, l.price]);
  await db.query(`INSERT INTO ${t}(character_id,${col}) VALUES ($1,$2)`, [me.id, l.ref_id]); await db.query('UPDATE market_listings SET sold=true WHERE id=$1', [l.id]); await log(db, me.id, `Achat marketplace #${l.id}`); return { ok: true };
}));
def(market, 'get', '/chest/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId')); await atCapital(db, me);
  return { size: me.chest_size, nextCost: 50 * me.chest_size, items: (await db.query('SELECT i.id,i.name FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.in_chest', [me.id])).rows }; }));
def(market, 'post', '/chest/expand', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me); const cost = 50 * me.chest_size;   // coût progressif
  if (me.gold < cost) fail(409, `Or insuffisant (${cost})`); await db.query('UPDATE characters SET gold=gold-$2, chest_size=chest_size+1 WHERE id=$1', [me.id, cost]); return { size: me.chest_size + 1, cost };
}));
def(market, 'post', '/chest/move', z.object({ characterId: z.number(), itemId: z.number(), to: z.enum(['chest', 'bag']) }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); await atCapital(db, me); const toChest = b.to === 'chest';
  if (toChest && (await db.query('SELECT count(*)::int n FROM character_items WHERE character_id=$1 AND in_chest', [me.id])).rows[0].n >= me.chest_size) fail(409, 'Coffre plein');
  if (!toChest && await bagCount(db, me.id) >= BAG_MAX) fail(409, 'Inventaire plein');
  const r = await db.query(`UPDATE character_items SET in_chest=$3 WHERE ctid=(SELECT ctid FROM character_items WHERE character_id=$1 AND item_id=$2 AND in_chest=$4 AND equipped_slot IS NULL LIMIT 1)`, [me.id, b.itemId, toChest, !toChest]);
  if (!r.rowCount) fail(404, 'Objet introuvable'); return { ok: true };
}));

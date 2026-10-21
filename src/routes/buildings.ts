import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log, dist } from '../lib/db.js';
import { actor, travel } from '../game/movement.js'; import { terrain } from '../game/terrain.js'; import { broadcast } from '../realtime/ws.js';
export const buildings = router();
const BUILD_COST = 10;      // énergie de l'action (en plus du trajet) ; l'interaction avec un bâtiment coûte 0
def(buildings, 'post', '/buildings/place', z.object({ characterId: z.number(), kind: z.enum(['wall', 'tower', 'factory', 'totem', 'ship']), x: z.number().int().optional(), y: z.number().int().optional(), totem: z.object({ stat: z.string(), delta: z.number(), radius: z.number() }).optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), a = await actor(db, me);
  const { rows: [sc] } = await db.query("SELECT ci.ctid::text, i.name FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND i.slot='scroll' AND i.data->>'kind'=$2 AND NOT ci.in_chest LIMIT 1", [me.id, b.kind]);
  if (!sc) fail(403, 'Parchemin de construction requis');
  if (b.kind === 'ship') {       // le navire devient une monture aquatique (parchemin consommé)
    if ((await db.query("SELECT 1 FROM character_mounts cm JOIN mounts m ON m.id=cm.mount_id WHERE cm.character_id=$1 AND m.name='Navire'", [me.id])).rowCount) fail(409, 'Vous possédez déjà un navire');
    const { spend } = await import('../game/movement.js'); await spend(db, me, a, BUILD_COST); await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [sc.ctid]);
    await db.query("INSERT INTO character_mounts(character_id,mount_id,energy_current,hp_current) SELECT $1,id,energy_max,hp_max FROM mounts WHERE name='Navire'", [me.id]); await log(db, me.id, 'Construit : navire'); return { ok: true, cost: BUILD_COST };
  }
  if (b.x === undefined || b.y === undefined) fail(400, 'Case cible requise');
  if (['shallow', 'deep', 'volcano'].includes(terrain(b.x, b.y, a.mp.map_id).kind) || (await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [a.mp.map_id, b.x, b.y])).rowCount) fail(409, 'Case indisponible');
  const t = await travel(db, me, a, b, 1, BUILD_COST);
  await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [sc.ctid]);
  const { rows: [bd] } = await db.query('INSERT INTO buildings(name,kind,owner_id,data) VALUES ($1,$2,$3,$4) RETURNING id', [b.kind, b.kind, me.id, JSON.stringify({ hp: 200, ...(b.totem ? { totem: b.totem } : {}) })]);
  await db.query('INSERT INTO positions(map_id,coord_x,coord_y,building_id) VALUES ($1,$2,$3,$4)', [a.mp.map_id, b.x, b.y, bd.id]);
  await log(db, me.id, `Construit : ${b.kind}`); broadcast(a.mp.map_id, { type: 'built' }); return { ok: true, cost: t.cost + BUILD_COST };
}));
def(buildings, 'post', '/buildings/{id}/interact', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), a = await actor(db, me);
  const { rows: [bd] } = await db.query('SELECT b.*,p.map_id,p.coord_x,p.coord_y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.id=$1', [P(c, 'id')]);
  if (!bd || bd.map_id !== a.mp.map_id || dist(a.mp, bd) > 1) fail(409, 'Trop loin (case adjacente requise)'); return { id: bd.id, name: bd.name, kind: bd.kind, data: bd.data };
}));

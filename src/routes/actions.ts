import { def, router, z } from '../lib/route.js'; import { tx, ownChar, fail, log, trimLog } from '../lib/db.js';
import { depositAt, takeFromDeposit } from '../game/deposits.js'; import { checkHarvest } from '../game/harvest.js'; import { bagState, extraSlots } from '../game/bag.js'; import { harvestQty, resName } from '../game/deposits.js';
import { actor, travel, spend } from '../game/movement.js'; import { terrain } from '../game/terrain.js'; import { broadcast } from '../realtime/ws.js';
import { cellTaken, actorAir } from '../game/layers.js';
export const actions = router();
const XY = z.object({ characterId: z.number(), x: z.number().int(), y: z.number().int() }), GATHER = 4;
def(actions, 'post', '/actions/move', XY, (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId), a = await actor(db, ch); const r = await travel(db, ch, a, b, 0);
  await log(db, ch.id, `Déplacement vers ${b.x},${b.y}`); await trimLog(db, ch.id); broadcast(r.mapId, { type: 'moved' }); return { ok: true, cost: r.cost };
}));
/** Récolte : sur place, ou à distance (trajet + 4 énergie). */
def(actions, 'post', '/actions/gather', z.object({ characterId: z.number(), x: z.number().int().optional(), y: z.number().int().optional() }), (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId), a = await actor(db, ch); const tx_ = b.x ?? a.mp.coord_x, ty = b.y ?? a.mp.coord_y, t = terrain(tx_, ty, a.mp.map_id);
  if (a.sm) fail(409, 'Une créature ne peut pas récolter : revenez à votre personnage');
  const dep = await depositAt(db, a.mp.map_id, tx_, ty, true);   // gisement placé en admin : sa ressource et son stock priment sur le terrain
  if ((!t.resource && !dep) || (t.kind === 'deep' && !(a.mount ?? a.loco)?.aquatic && !(a.mount ?? a.loco)?.flying)) fail(409, 'Rien à récolter ici');
  if (dep && !dep.stock) await takeFromDeposit(db, dep);   // épuisé : refus AVANT tout trajet
  const rid = dep ? dep.resource : t.resourceId, bag = await bagState(db, ch.id);   // place dans le sac (piles), AVANT tout trajet
  if (bag.used + extraSlots(bag.resources, rid, dep ? harvestQty(dep.stock, dep.yield_per_harvest) : 1, bag.st) > bag.size) fail(409, `Sac plein : plus de place pour ${resName(rid)} (${bag.used}/${bag.size} emplacements)`);
  await checkHarvest(db, ch, rid);   // objets / sort exigés (outil équipé compris), AVANT tout trajet
  if (tx_ !== a.mp.coord_x || ty !== a.mp.coord_y) { if (await cellTaken(db, a.mp.map_id, tx_, ty, actorAir(a))) fail(409, 'Case occupée'); await travel(db, ch, a, { x: tx_, y: ty }, 0, GATHER); } else await spend(db, ch, a, GATHER);
  const got = dep ? await takeFromDeposit(db, dep) : { resourceId: t.resourceId, name: t.resource, qty: 1, left: null };
  await db.query(`UPDATE characters SET resources=jsonb_set(resources,$2,to_jsonb(COALESCE((resources->>$3)::int,0)+$4)) WHERE id=$1`, [ch.id, `{${got.resourceId}}`, got.resourceId, got.qty]);
  await log(db, ch.id, `Récolte : ${got.name}${got.qty > 1 ? ` ×${got.qty}` : ''}`); broadcast(a.mp.map_id, { type: 'moved' }); return { ok: true, resource: got.name, qty: got.qty, left: got.left };
}));
/** « S'approcher à côté de… » : trajet jusqu'à la case adjacente d'une cible/structure. */
def(actions, 'post', '/actions/approach', XY, (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId), a = await actor(db, ch); const r = await travel(db, ch, a, b, 1);
  await log(db, ch.id, `S'approche de ${b.x},${b.y}`); broadcast(r.mapId, { type: 'moved' }); return { ok: true, cost: r.cost };
}));

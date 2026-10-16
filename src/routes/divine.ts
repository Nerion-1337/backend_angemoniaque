import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z } from '../lib/route.js'; import { tx, ownChar, posOf, fail, log, dist } from '../lib/db.js';
import { KIND, required, held, applySpec } from '../game/divine.js'; import { freeCell } from '../game/spawn.js'; import { broadcast } from '../realtime/ws.js';
export const divine = new OpenAPIHono();
def(divine, 'post', '/divine/door', z.object({ characterId: z.number(), buildingId: z.number() }), (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId); const mp = await posOf(db, ch.id);
  const { rows: [bd] } = await db.query(`SELECT b.*, p.map_id, p.coord_x, p.coord_y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.id=$1 AND b.kind='door'`, [b.buildingId]);
  if (!bd || bd.map_id !== mp.map_id || dist(mp, bd) > 1) fail(409, 'Porte hors de portée');
  if (!(await held(db, ch.id, bd.data.requires))) fail(403, `Objet divin requis : ${bd.data.requires}`);
  await db.query('UPDATE divine_items SET holder_character_id=NULL WHERE id=(SELECT id FROM divine_items WHERE holder_character_id=$1 AND kind=$2 LIMIT 1)', [ch.id, bd.data.requires]); // retour au gardien
  const [m, x, y] = bd.data.to; const cell = await freeCell(db, m, x, y, 3);
  await db.query('UPDATE positions SET map_id=$2,coord_x=$3,coord_y=$4 WHERE character_id=$1', [ch.id, m, cell.x, cell.y]);
  await log(db, ch.id, `Franchit ${bd.name}`); broadcast(mp.map_id, { type: 'left', characterId: ch.id }); return { ok: true, map: m };
}));
def(divine, 'post', '/divine/rank-up', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId); const kind = KIND[ch.race] ?? fail(400, 'Race non concernée');
  const { rows: [next] } = await db.query('SELECT s.* FROM specializations s WHERE s.race=$1 AND s.current_rank=(SELECT current_rank+1 FROM specializations WHERE id=$2)', [ch.race, ch.specialization_id]);
  if (!next) fail(409, 'Rang maximal'); const need = required(next.current_rank);
  if ((await held(db, ch.id, kind)) < need) fail(403, `${need} objet(s) divin(s) requis`);
  const { rows: [q] } = await db.query('SELECT (SELECT count(*)::int FROM characters) total, (SELECT count(*)::int FROM characters WHERE specialization_id=$1) cur', [next.id]);
  if (q.cur + 1 > Math.ceil(next.max_population_percent / 100 * q.total)) fail(409, 'Quota de population atteint');
  await db.query('UPDATE divine_items SET holder_character_id=NULL WHERE id IN (SELECT id FROM divine_items WHERE holder_character_id=$1 AND kind=$2 LIMIT $3)', [ch.id, kind, need]);
  await applySpec(db, ch.id, next.id); await log(db, ch.id, `Devient ${next.name}`); return { ok: true, rank: next.name };
}));
def(divine, 'get', '/divine/{characterId}', null, c => tx(async db => {
  const ch = await ownChar(db, c, Number(c.req.param('characterId'))); return (await db.query('SELECT kind,count(*)::int n FROM divine_items WHERE holder_character_id=$1 GROUP BY kind', [ch.id])).rows;
}));

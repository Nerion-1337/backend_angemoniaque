import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, posOf, fail, log, dist } from '../lib/db.js'; import { activate, hasActivation } from '../game/activation.js';
import { KIND, required, held, applySpec } from '../game/divine.js'; import { freeCell, spawnZone } from '../game/spawn.js'; import { doors, facing, syncGates } from '../game/gates.js'; import { fmtWait } from '../game/faithPact.js'; import { broadcast } from '../realtime/ws.js';
export const divine = router();
/**
 * Portes des mondes (migration 48, game/gates.ts). État vu depuis une case adjacente : monde, ouverture, portes en face, ce que le
 * joueur peut faire (activer avec ses objets divins, franchir, choisir sa porte d'arrivée).
 */
async function doorNear(db: any, ch: any, id: number) {
  const mp = await posOf(db, ch.id), all = await doors(db), d = all.find((x: any) => x.id === id);
  if (!d || !d.placed || d.map_id !== mp.map_id || dist(mp, d) > 1) fail(409, 'Porte hors de portée');
  return { d, all, mp };
}
const pub = (x: any) => ({ id: x.id, name: x.name, realm: x.realm, leads_to: x.leads_to, placed: x.placed, open: x.open, open_in_s: x.open ? x.open_in_s : 0 });
def(divine, 'get', '/divine/door/{id}/{characterId}', null, c => tx(async db => {
  const ch = await ownChar(db, c, P(c, 'characterId')), { d, all } = await doorNear(db, ch, P(c, 'id'));
  const family = KIND[d.realm], face = d.realm === 'dead' || d.realm == null ? [] : facing(all, d);
  return { ...pub(d), hours_per_item: d.open_h_per_item, family: family ?? null, can_activate: !!family && ch.race === d.realm,
    held: family ? await held(db, ch.id, family) : 0, facing: face.map(pub), can_cross: d.realm === 'dead' || d.realm == null || face.some((f: any) => f.open),
    activation: hasActivation(d) ? d.activation : null };
}));
def(divine, 'post', '/divine/door/{id}/activate', z.object({ characterId: z.number(), count: z.number().int().min(1).max(100) }), (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId), { d } = await doorNear(db, ch, P(c, 'id')), family = KIND[d.realm];
  if (!family) fail(400, 'Cette porte ne s\'active pas');
  if (ch.race !== d.realm) fail(403, `Seul un joueur de ce monde peut activer ${d.name}`);
  const n = await held(db, ch.id, family); if (n < b.count) fail(403, `${b.count} ${family}(s) requis (vous en détenez ${n})`);
  await db.query('UPDATE divine_items SET holder_character_id=NULL WHERE id IN (SELECT id FROM divine_items WHERE holder_character_id=$1 AND kind=$2 LIMIT $3)', [ch.id, family, b.count]);
  const { rows: [r] } = await db.query(`UPDATE buildings SET open_until=GREATEST(now(), COALESCE(open_until, now())) + make_interval(secs => $2::numeric * open_h_per_item * 3600)
    WHERE id=$1 RETURNING GREATEST(0, EXTRACT(EPOCH FROM open_until - now()))::int open_in_s`, [d.id, b.count]);
  await syncGates(db);
  await log(db, ch.id, `Active ${d.name} (${b.count} ${family}) : ouverte ${fmtWait(r.open_in_s)}`); broadcast(d.map_id, { type: 'built' });
  return { ok: true, open_in_s: r.open_in_s };
}));
/** Franchir : une porte en face ouverte est exigée (Royaume des Morts : toujours, vers la zone d'apparition de sa race) ; les
 *  conditions réglées en admin s'ajoutent. Porte des Hommes → son arrivée fixe ; sinon → près d'une porte en face ouverte, au choix. */
def(divine, 'post', '/divine/door', z.object({ characterId: z.number(), buildingId: z.number(), toBuildingId: z.number().optional() }), (c, b) => tx(async db => {
  const ch = await ownChar(db, c, b.characterId), { d, all, mp } = await doorNear(db, ch, b.buildingId);
  let dest: { m: number; x: number; y: number; r: number };
  const bd = (await db.query('SELECT * FROM buildings WHERE id=$1', [d.id])).rows[0];
  if (d.realm == null) {   // porte sans monde (ancienne) : conditions réglées, sinon un objet divin rendu ; arrivée fixe
    if (hasActivation(bd)) await activate(db, ch, bd);
    else {
      if (!(await held(db, ch.id, bd.data.requires))) fail(403, `Objet divin requis : ${bd.data.requires}`);
      await db.query('UPDATE divine_items SET holder_character_id=NULL WHERE id=(SELECT id FROM divine_items WHERE holder_character_id=$1 AND kind=$2 LIMIT 1)', [ch.id, bd.data.requires]);
    }
    const [m, x, y] = bd.data.to; dest = { m, x, y, r: 3 };
  } else if (d.realm === 'dead') dest = await spawnZone(db, ch.race);
  else {
    const open = facing(all, d).filter((f: any) => f.open);
    if (!open.length) fail(409, `${d.name} est fermée : une porte de l'autre monde doit être activée (${facing(all, d).map((f: any) => f.name).join(', ') || 'aucune'})`);
    const pick = b.toBuildingId != null ? open.find((f: any) => f.id === b.toBuildingId) : open.length === 1 || d.realm === 'human' ? open[0] : null;
    if (b.toBuildingId != null && !pick) fail(409, 'Cette porte d\'arrivée n\'est pas ouverte');
    if (!pick) return { ok: false, choose: open.map(pub) };
    const to = d.data?.to;
    dest = d.realm === 'human' && Array.isArray(to) ? { m: to[0], x: to[1], y: to[2], r: 3 } : { m: pick.map_id, x: pick.coord_x, y: pick.coord_y, r: 2 };
  }
  if (d.realm != null && hasActivation(bd)) await activate(db, ch, bd);   // conditions supplémentaires réglées dans l'admin (lot E)
  const cell = await freeCell(db, dest.m, dest.x, dest.y, dest.r);
  await db.query('UPDATE positions SET map_id=$2,coord_x=$3,coord_y=$4 WHERE character_id=$1', [ch.id, dest.m, cell.x, cell.y]);
  await log(db, ch.id, `Franchit ${d.name}`); broadcast(mp.map_id, { type: 'left', characterId: ch.id }); return { ok: true, map: dest.m };
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

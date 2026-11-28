import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log, dist } from '../lib/db.js';
import { actor, travel } from '../game/movement.js'; import { activate, hasActivation, describeActivation } from '../game/activation.js'; import { Activations, activateWith, describe, missing, consumed, maxTimes } from '../game/structActivation.js'; import { doors, facing, syncGates } from '../game/gates.js'; import { pubDoor } from './divine.js'; import { Effects, pickTargets, applyEffects } from '../game/spellEffects.js'; import { loadTarget } from '../game/combatlib.js'; import { castSummon } from '../game/spellSummon.js'; import { terrain } from '../game/terrain.js'; import { broadcast } from '../realtime/ws.js'; import { checkBuildable } from '../game/gates.js';
export const buildings = router();
/**
 * État d'une structure vu depuis une case adjacente (migration 49) : activée (jusqu'à quand / définitivement), éléments d'activation
 * (libellé, ce qui manque), conditions supplémentaires ; porte des mondes : portes en face et franchissement.
 */
async function near(db: any, me: any, id: number) {
  const a = await actor(db, me), { rows: [bd] } = await db.query(`SELECT b.*, p.map_id, p.coord_x, p.coord_y, COALESCE(b.open_until='infinity', false) forever,
    COALESCE(b.open_until > now(), false) active, CASE WHEN b.open_until='infinity' THEN NULL ELSE GREATEST(0, EXTRACT(EPOCH FROM b.open_until - now()))::int END open_in_s
    FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.id=$1`, [id]);
  if (!bd || bd.map_id !== a.mp.map_id || dist(a.mp, bd) > 1) fail(409, 'Trop loin (case adjacente requise)');
  return { a, bd };
}
const WORLD_DOOR = (bd: any) => bd.kind === 'door' && ['human', 'demon', 'angel'].includes(bd.realm);
def(buildings, 'get', '/buildings/{id}/state/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId')), { bd } = await near(db, me, P(c, 'id'));
  const list = Activations.safeParse(bd.activations ?? []), els = list.success ? list.data : [];
  const raceOk = !WORLD_DOOR(bd) || me.race === bd.realm;
  const elements = []; for (const [i, e] of els.entries()) elements.push({ index: i, kind: e.kind, consume: consumed(e), hours: e.hours, max_times: maxTimes(e), label: await describe(db, e), missing: await missing(db, me, e) });
  const out: any = { id: bd.id, name: bd.name, kind: bd.kind, realm: bd.realm, leads_to: bd.leads_to, active: bd.active, forever: bd.forever, open_in_s: bd.active ? bd.open_in_s : 0,
    elements, can_activate: raceOk && (elements.length > 0 || hasActivation(bd)) && !bd.forever, race_note: raceOk ? null : `Seul un joueur de ce monde peut l'activer`,
    conditions: hasActivation(bd) ? await describeActivation(db, bd.activation) : null };
  if (bd.kind === 'door') {
    const all = await doors(db), d = all.find((x: any) => x.id === bd.id), face = bd.realm === 'dead' || bd.realm == null ? [] : facing(all, d);
    Object.assign(out, { door: true, facing: face.map(pubDoor), can_cross: bd.realm === 'dead' || bd.realm == null || face.some((f: any) => f.open) });
  }
  return out;
}));
/**
 * Activer une structure (case adjacente) : avec un élément d'activation (`element`, payé `times` fois) — la structure est activée
 * pour sa durée (porte des mondes : seulement par un joueur de son monde) — et / ou les conditions supplémentaires réglées (lot E,
 * consommées si prévu). Puis ses sorts « à activer » s'appliquent au profit de l'activateur (zone autour d'elle, camp relatif à
 * l'activateur ; invocations près de lui). Une porte se franchit par /divine/door.
 */
def(buildings, 'post', '/buildings/{id}/activate', z.object({ characterId: z.number(), element: z.number().int().min(0).optional(), times: z.number().int().min(1).max(100).optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), { a, bd } = await near(db, me, P(c, 'id'));
  const els = Activations.parse(bd.activations ?? []);
  if (!els.length && !hasActivation(bd)) fail(409, 'Cette structure ne s\'active pas');
  if (WORLD_DOOR(bd) && me.race !== bd.realm) fail(403, `Seul un joueur de ce monde peut activer ${bd.name}`);
  const option = hasActivation(bd) ? await activate(db, me, bd) : -1;   // conditions supplémentaires (lot E)
  const until = els.length ? await activateWith(db, me, bd, b.element ?? 0, b.times ?? 1) : null;
  if (bd.kind === 'door') await syncGates(db);
  if (until) await log(db, me.id, `Active ${bd.name} ${until.forever ? 'définitivement' : `jusqu'au ${until.until!.toLocaleString('fr-FR')}`}`);
  const { rows: sps } = await db.query("SELECT s.id, s.name, s.effects FROM entity_spells es JOIN spells s ON s.id=es.spell_id WHERE es.kind='building' AND es.ref_id=$1 AND es.mode='active'", [bd.id]);
  const results: any[] = [];
  for (const sp of sps) {
    const e = Effects.safeParse(sp.effects ?? {}); if (!e.success || !Object.keys(sp.effects ?? {}).length) continue;
    if (e.data.damage || e.data.heal || e.data.dot || e.data.stats.length) {
      const r = e.data.target === 'area' ? e.data.radius : 1, center = { x: bd.coord_x, y: bd.coord_y };
      const { rows: ps } = await db.query('SELECT * FROM positions WHERE map_id=$1 AND coord_x BETWEEN $2 AND $3 AND coord_y BETWEEN $4 AND $5 AND (character_id IS NOT NULL OR monsters_id IS NOT NULL OR summon_id IS NOT NULL)',
        [bd.map_id, center.x - r, center.x + r, center.y - r, center.y + r]);
      const all = (await Promise.all(ps.map((p: any) => loadTarget(db, p)))).filter(Boolean) as any[];
      const targets = e.data.target === 'area' ? pickTargets(e.data, me, center, all) : all.filter(t => t.kind === 'character' && t.id === me.id);
      for (const t of targets) results.push({ spell: sp.name, target: t.name, effect: await applyEffects(db, me, sp.id, e.data, t) });
    }
    if (e.data.summon) results.push({ spell: sp.name, target: me.pseudo, effect: await castSummon(db, me, a.mp, e.data.summon) });
  }
  broadcast(bd.map_id, { type: 'spell' });
  return { ok: true, option: option + 1, results, forever: until?.forever ?? false, until: until?.until ?? null };
}));
const BUILD_COST = 10;      // énergie de l'action (en plus du trajet) ; l'interaction avec un bâtiment coûte 0
def(buildings, 'post', '/buildings/place', z.object({ characterId: z.number(), kind: z.enum(['wall', 'tower', 'factory', 'totem']), x: z.number().int().optional(), y: z.number().int().optional(), totem: z.object({ stat: z.string(), delta: z.number(), radius: z.number() }).optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), a = await actor(db, me);
  const { rows: [sc] } = await db.query("SELECT ci.ctid::text, i.name FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND i.slot='scroll' AND i.data->>'kind'=$2 AND NOT ci.in_chest LIMIT 1", [me.id, b.kind]);
  if (!sc) fail(403, 'Parchemin de construction requis');
  if (b.x === undefined || b.y === undefined) fail(400, 'Case cible requise');
  if (['shallow', 'deep', 'volcano'].includes(terrain(b.x, b.y, a.mp.map_id).kind) || (await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [a.mp.map_id, b.x, b.y])).rowCount) fail(409, 'Case indisponible');
  await checkBuildable(db, a.mp.map_id, b.x, b.y);   // zone sans construction d'une structure (migration 48)
  const t = await travel(db, me, a, b, 1, BUILD_COST);
  await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [sc.ctid]);
  const { rows: [bd] } = await db.query('INSERT INTO buildings(name,kind,owner_id,data) VALUES ($1,$2,$3,$4) RETURNING id', [b.kind, b.kind, me.id, JSON.stringify({ hp: 200, ...(b.totem ? { totem: b.totem } : {}) })]);
  await db.query('INSERT INTO positions(map_id,coord_x,coord_y,building_id) VALUES ($1,$2,$3,$4)', [a.mp.map_id, b.x, b.y, bd.id]);
  await log(db, me.id, `Construit : ${b.kind}`); broadcast(a.mp.map_id, { type: 'built' }); return { ok: true, cost: t.cost + BUILD_COST };
}));
def(buildings, 'post', '/buildings/{id}/interact', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), a = await actor(db, me);
  const { rows: [bd] } = await db.query('SELECT b.*,p.map_id,p.coord_x,p.coord_y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.id=$1', [P(c, 'id')]);
  if (!bd || bd.map_id !== a.mp.map_id || dist(a.mp, bd) > 1) fail(409, 'Trop loin (case adjacente requise)'); return { id: bd.id, name: bd.name, kind: bd.kind, data: bd.data, activation: hasActivation(bd) ? bd.activation : null, activable: (bd.activations ?? []).length > 0 || hasActivation(bd) };
}));

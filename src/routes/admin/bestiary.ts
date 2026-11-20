import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { terrain } from '../../game/terrain.js';
export const bestiaryRoutes = router();
/**
 * Statut bestiaire pour le dashboard (Étape 2 phase 2) :
 *  - instances : monstres actuellement placés sur les cartes (ancrés + sauvages du tick),
 *  - guardians : objets divins et leur monstre gardien / détenteur éventuel.
 */
def(bestiaryRoutes, 'get', '/admin/bestiary/status', null, async c => {
  const { rows: instances } = await pool.query(
    `SELECT m.id, m.name, m.hp_current, m.hp_max, p.id pos_id, p.map_id, p.coord_x x, p.coord_y y,
       (m.data->>'spawned')::boolean spawned, (m.data->>'placed')::boolean placed,
       (m.data->>'prototype')::int prototype, m.guards_item, m.gold_current gold,
       COALESCE((m.data->>'reincarnate_h')::int, m.reincarnate_delay_h) reincarnate_h,
       mr.due_at respawn_due_at
     FROM monsters m JOIN positions p ON p.monsters_id=m.id
     LEFT JOIN monster_respawns mr ON mr.monster_id=m.id
     ORDER BY m.id`);
  const { rows: guardians } = await pool.query(
    `SELECT di.id, di.kind, di.guardian_monster_id, gm.name guardian, di.holder_character_id, hc.pseudo holder
     FROM divine_items di LEFT JOIN monsters gm ON gm.id=di.guardian_monster_id
       LEFT JOIN characters hc ON hc.id=di.holder_character_id ORDER BY di.id`);
  return { instances, guardians };
});

// ── Placement spontané (Étape 2 phase 3) ─────────────────────────────────────
/**
 * Ajoute spontanément un monstre sur une carte : crée une instance (clone du prototype,
 * comme les sauvages du tick) avec les drops de mort choisis (or / objets / ressources /
 * divins — entrées monster_loot copiées) et la réincarnation différée (reincarnateH,
 * repli sur le prototype). L'instance est ancrée : elle régnère au lieu de disparaître.
 */
const Place = z.object({
  monsterId: z.number().int(), mapId: z.number().int(), x: z.number().int(), y: z.number().int(),
  gold: z.number().optional(), items: z.boolean().default(false), resources: z.boolean().default(false),
  divine: z.boolean().default(false), reincarnateH: z.number().int().min(0).optional()
});
def(bestiaryRoutes, 'post', '/admin/bestiary/place', Place, async (c, b) => {
  const { rows: [proto] } = await pool.query('SELECT * FROM monsters WHERE id=$1', [b.monsterId]);
  if (!proto) fail(404, 'Monstre inconnu');
  const { rows: [map] } = await pool.query('SELECT width, height FROM maps WHERE id=$1', [b.mapId]);
  if (!map) fail(404, 'Carte inconnue');
  if (b.x < 0 || b.y < 0 || b.x >= map.width || b.y >= map.height) fail(400, 'Hors de la carte');
  if (['shallow', 'deep', 'volcano'].includes(terrain(b.x, b.y, b.mapId).kind)) fail(400, 'Case invadable (eau/volcan)');
  if ((await pool.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [b.mapId, b.x, b.y])).rowCount) fail(409, 'Case occupée');
  let n = 1, name = `${proto.name} #${n}`;
  while ((await pool.query('SELECT 1 FROM monsters WHERE name=$1', [name])).rowCount) name = `${proto.name} #${++n}`;
  const recH = b.reincarnateH ?? proto.reincarnate_delay_h ?? 0;
  const { rows: [ins] } = await pool.query(
    `INSERT INTO monsters(name,hp_max,hp_current,recovery,see,strength,agility,energy_max,energy_current,range,armor,magic_armor,gold_current,guards_item,reincarnate_delay_h,data)
     VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [name, proto.hp_max, proto.recovery, proto.see, proto.strength, proto.agility, proto.energy_max,
     proto.range, proto.armor, proto.magic_armor ?? 0, b.gold ?? proto.gold_current ?? 0, proto.guards_item, recH,
     JSON.stringify({ placed: true, prototype: proto.id, reincarnate_h: recH, behavior: proto.data?.behavior ?? 'passif' })]);
  // Drops de mort : entrées du butin du prototype, filtrées par les choix (objets/ressources/divins).
  const { rows: loots } = await pool.query('SELECT * FROM monster_loot WHERE monster_id=$1', [proto.id]);
  let copies = 0;
  for (const l of loots) {
    const keep = (l.item_id && b.items) || (l.resource && b.resources) || (l.divine_id && b.divine);
    if (!keep) continue;
    await pool.query('INSERT INTO monster_loot(monster_id,item_id,divine_id,resource,drop_rate,qty_min,qty_max) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [ins.id, l.item_id ?? null, l.divine_id ?? null, l.resource ?? null, l.drop_rate, l.qty_min, l.qty_max]);
    copies++;
  }
  await pool.query('INSERT INTO positions(map_id,coord_x,coord_y,monsters_id) VALUES ($1,$2,$3,$4)', [b.mapId, b.x, b.y, ins.id]);
  await bumpContent(); await audit(c, 'monster.place', 'monster', ins.id, null, b);
  return { id: ins.id, name, mapId: b.mapId, x: b.x, y: b.y, gold: b.gold ?? proto.gold_current ?? 0, dropsCopied: copies };
});
/** Retire un placement (case libérée) ; l'instance placée/sauvage est supprimée avec son butin. */
def(bestiaryRoutes, 'delete', '/admin/bestiary/place/{posId}', null, async c => {
  const { rows: [p] } = await pool.query('SELECT * FROM positions WHERE id=$1', [P(c, 'posId')]);
  if (!p?.monsters_id) fail(404, 'Placement inconnu');
  const { rows: [m] } = await pool.query('SELECT data FROM monsters WHERE id=$1', [p.monsters_id]);
  await pool.query('DELETE FROM positions WHERE id=$1', [p.id]);
  if (m && (m.data?.placed || m.data?.spawned)) await pool.query('DELETE FROM monsters WHERE id=$1', [p.monsters_id]);
  await bumpContent(); await audit(c, 'monster.unplace', 'position', p.id, null, null);
  return { ok: true };
});

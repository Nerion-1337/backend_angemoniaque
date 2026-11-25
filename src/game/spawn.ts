import { terrain } from './terrain.js'; import { fail } from '../lib/db.js'; import { protoOf, respawnBlockers } from './respawn.js';
export async function freeCell(db: any, mapId: number, cx: number, cy: number, r: number) {
  const { rows: [m] } = await db.query('SELECT width w,height h FROM maps WHERE id=$1', [mapId]);
  // Le rayon s’élargit si l’aire est saturée (capitale encombrée en base de dev) : on préfère
  // naître un peu plus loin plutôt que de renoncer. Échec seulement si toute la carte est occupée.
  for (let rad = r; ; rad += 2) {
    for (let i = 0; i < 100; i++) {
      const x = cx + Math.floor(Math.random() * (2 * rad + 1)) - rad, y = cy + Math.floor(Math.random() * (2 * rad + 1)) - rad;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h || ['shallow', 'deep', 'volcano'].includes(terrain(x, y, mapId).kind)) continue;
      if (!(await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [mapId, x, y])).rowCount) return { x, y };
    }
    if (rad * 2 >= Math.max(m.w, m.h)) return fail(503, 'Aucune case libre');
  }
}
const CAPITAL: Record<string, string> = { human: 'Hôtel de ville', demon: 'Bastion Infernal', angel: 'Sanctuaire de la Providence' };
/** Zone d'apparition d'une race : réglage admin (races.spawn_*), sinon la capitale de la race (rayon 4). */
export async function spawnZone(db: any, race: string): Promise<{ m: number; x: number; y: number; r: number }> {
  const { rows: [z] } = await db.query('SELECT spawn_map_id m, spawn_x x, spawn_y y, spawn_radius r FROM races WHERE key=$1', [race]).catch(() => ({ rows: [] }));
  if (z?.m != null && z.x != null && z.y != null) return { m: z.m, x: z.x, y: z.y, r: z.r ?? 4 };
  const { rows: [b] } = await db.query('SELECT p.map_id m,p.coord_x x,p.coord_y y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.name=$1', [CAPITAL[race] ?? CAPITAL.human]);
  return { ...b, r: 4 };
}
export async function spawn(db: any, charId: number, race: string) {
  const z = await spawnZone(db, race);
  const c = await freeCell(db, z.m, z.x, z.y, z.r);
  await db.query('INSERT INTO positions(map_id,coord_x,coord_y,character_id) VALUES ($1,$2,$3,$4)', [z.m, c.x, c.y, charId]);
}
/**
 * Spawn horaire (Étape 2 phase 2) : pour chaque spawn_rules actif, si la fréquence (interval_h)
 * et la probabilité (probability) le permettent, crée une instance du monstre sur une case libre
 * du rectangle [x_min..x_max]×[y_min..y_max], après vérification des plafonds :
 *  - spawn_rules.max_instances (instances totales du prototype),
 *  - entity_caps (kind 'monster', scope global / per_zone).
 * L'unicité de case (uq_cell) est garantie par freeCellRect ; les instances sont des lignes
 * monsters dédiées (name = « Protos #n », data.spawned=true) qui disparaissent à leur mort.
 */
export async function hourlySpawns(db: any) {
  const { rows: rules } = await db.query('SELECT * FROM spawn_rules WHERE active ORDER BY id');
  outer: for (const r of rules) {
    if (r.interval_h > 0 && r.last_spawned_at && Date.now() - new Date(r.last_spawned_at).getTime() < r.interval_h * 3600e3) continue;
    if (Math.random() * 100 >= Number(r.probability ?? 100)) continue;
    const { rows: [proto] } = await db.query('SELECT * FROM monsters WHERE id=$1', [r.monster_id]);
    if (!proto) continue;
    const instances = (await db.query('SELECT m.id, p.map_id FROM monsters m JOIN positions p ON p.monsters_id=m.id WHERE m.id=$1 OR m.data->>\'prototype\'=$1::text', [r.monster_id])).rows;
    const onMap = instances.filter((i: any) => i.map_id === r.map_id).length;
    if (instances.length >= r.max_instances) continue;
    for (const cap of (await db.query('SELECT scope, value FROM entity_caps WHERE kind=$1 AND ref_id=$2', ['monster', r.monster_id])).rows) {
      if ((cap.scope === 'global' && instances.length >= cap.value) || (cap.scope === 'per_zone' && onMap >= cap.value)) continue outer;
    }
    const cell = await freeCellRect(db, r);
    if (!cell) continue;
    let n = instances.length + 1, name = `${proto.name} #${n}`;
    while ((await db.query('SELECT 1 FROM monsters WHERE name=$1', [name])).rowCount) name = `${proto.name} #${++n}`;
    const { rows: [ins] } = await db.query(
      `INSERT INTO monsters(name,hp_max,hp_current,recovery,see,strength,agility,energy_max,energy_current,range,armor,magic_armor,gold_current,guards_item,data)
       VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [name, proto.hp_max, proto.recovery, proto.see, proto.strength, proto.agility, proto.energy_max,
       proto.range, proto.armor, proto.magic_armor ?? 0, proto.gold_current ?? 0, proto.guards_item,
       JSON.stringify({ spawned: true, prototype: proto.id, behavior: proto.data?.behavior ?? 'passif' })]);
    await db.query('INSERT INTO positions(map_id,coord_x,coord_y,monsters_id) VALUES ($1,$2,$3,$4)', [r.map_id, cell.x, cell.y, ins.id]);
    await db.query('UPDATE spawn_rules SET last_spawned_at=now() WHERE id=$1', [r.id]);
  }
}
/** Réincarnation différée : à l'échéance (tick horaire), PV complets — sauf si une condition du type (respawn_limits) la
 *  bloque encore : l'échéance reste en place et elle est revérifiée au tick suivant. */
export async function reincarnateDue(db: any) {
  const { rows: due } = await db.query('SELECT r.monster_id, m.* FROM monster_respawns r JOIN monsters m ON m.id=r.monster_id WHERE r.due_at <= now()');
  let n = 0;
  for (const r of due) {
    if ((await respawnBlockers(db, await protoOf(db, r))).length) continue;
    await db.query('UPDATE monsters SET hp_current=hp_max WHERE id=$1', [r.monster_id]);
    await db.query('DELETE FROM monster_respawns WHERE monster_id=$1', [r.monster_id]); n++;
  }
  return n;
}
/** Case libre dans le rectangle de la règle : évite eau/volcan et toute case occupée (uq_cell). */
async function freeCellRect(db: any, r: any) {
  const w = r.x_max - r.x_min + 1, h = r.y_max - r.y_min + 1;
  if (w <= 0 || h <= 0) return null;
  for (let i = 0; i < 60; i++) {
    const x = r.x_min + Math.floor(Math.random() * w), y = r.y_min + Math.floor(Math.random() * h);
    if (['shallow', 'deep', 'volcano'].includes(terrain(x, y, r.map_id).kind)) continue;
    if ((await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [r.map_id, x, y])).rowCount) continue;
    return { x, y };
  }
  return null;
}

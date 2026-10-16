import { walk } from './rules.js'; import { terrain } from './terrain.js'; import { fail } from '../lib/db.js';
export async function activeMount(db: any, charId: number) {
  return (await db.query('SELECT cm.*, m.flying, m.bonus_see, m.bonus_range, m.name FROM character_mounts cm JOIN mounts m ON m.id=cm.mount_id WHERE cm.character_id=$1 AND cm.active', [charId])).rows[0];
}
/** Avance vers `target` jusqu'à être à `stopAt` cases (0 = sur la case). Coût trajet payé par la monture si active, `actionCost` par le personnage. */
export async function travel(db: any, ch: any, mp: any, target: { x: number; y: number }, stopAt: number, actionCost = 0) {
  const { rows: [m] } = await db.query('SELECT width w,height h FROM maps WHERE id=$1', [mp.map_id]);
  if (target.x < 0 || target.y < 0 || target.x >= m.w || target.y >= m.h) fail(409, 'Hors de la carte');
  const mount = await activeMount(db, ch.id); const cells: { x: number; y: number }[] = []; let cost = 0;
  for (const c of walk({ x: mp.coord_x, y: mp.coord_y }, target)) {
    const t = terrain(c.x, c.y); if (t.cost >= 99 && !mount?.flying) fail(409, 'Terrain infranchissable');
    cells.push(c); cost += mount?.flying ? 1 : t.cost;
    if (Math.max(Math.abs(c.x - target.x), Math.abs(c.y - target.y)) <= stopAt) break;
  }
  if (cells.length) {
    const keys = cells.map(c => `${c.x},${c.y}`);
    if ((await db.query(`SELECT 1 FROM positions WHERE map_id=$1 AND item_id IS NULL AND (coord_x||','||coord_y)=ANY($2) AND character_id IS DISTINCT FROM $3`, [mp.map_id, keys, ch.id])).rowCount) fail(409, 'Chemin bloqué');
  }
  const own = mount ? mount.energy_current : ch.energy_current;
  if (mount ? own < cost || ch.energy_current < actionCost : own < cost + actionCost) fail(409, `Énergie insuffisante (${cost + actionCost} requis)`);
  if (mount) await db.query('UPDATE character_mounts SET energy_current=energy_current-$3 WHERE character_id=$1 AND mount_id=$2', [ch.id, mount.mount_id, cost]);
  await db.query('UPDATE characters SET energy_current=energy_current-$2 WHERE id=$1', [ch.id, (mount ? 0 : cost) + actionCost]);
  const last = cells[cells.length - 1];
  if (last) await db.query('UPDATE positions SET coord_x=$2, coord_y=$3 WHERE character_id=$1', [ch.id, last.x, last.y]);
  return { cost, pos: last ?? { x: mp.coord_x, y: mp.coord_y }, mapId: mp.map_id };
}

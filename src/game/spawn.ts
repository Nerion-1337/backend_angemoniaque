import { terrain } from './terrain.js'; import { fail } from '../lib/db.js';
export async function freeCell(db: any, mapId: number, cx: number, cy: number, r: number) {
  const { rows: [m] } = await db.query('SELECT width w,height h FROM maps WHERE id=$1', [mapId]);
  for (let i = 0; i < 100; i++) {
    const x = cx + Math.floor(Math.random() * (2 * r + 1)) - r, y = cy + Math.floor(Math.random() * (2 * r + 1)) - r;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h || ['shallow', 'deep'].includes(terrain(x, y).kind)) continue;
    if (!(await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [mapId, x, y])).rowCount) return { x, y };
  }
  return fail(503, 'Aucune case libre');
}
const CAPITAL: Record<string, string> = { human: 'Hôtel de ville', demon: 'Bastion Infernal', angel: 'Sanctuaire de la Providence' };
export async function spawn(db: any, charId: number, race: string) {
  const { rows: [b] } = await db.query('SELECT p.map_id m,p.coord_x x,p.coord_y y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.name=$1', [CAPITAL[race] ?? CAPITAL.human]);
  const c = await freeCell(db, b.m, b.x, b.y, 4);
  await db.query('INSERT INTO positions(map_id,coord_x,coord_y,character_id) VALUES ($1,$2,$3,$4)', [b.m, c.x, c.y, charId]);
}

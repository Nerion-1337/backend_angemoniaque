import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z, P } from '../lib/route.js'; import { pool, tx, fail } from '../lib/db.js'; import { freeCell } from '../game/spawn.js';
export const adminRoutes = new OpenAPIHono();
const TABLES = ['items', 'monsters', 'mounts', 'spells']; const STATS = ['hp_max', 'energy_max', 'divine_energy_max', 'recovery', 'see', 'strength', 'agility', 'armor', 'range', 'xp', 'gold'];
def(adminRoutes, 'get', '/admin/stats', null, async () => ({
  byRace: (await pool.query('SELECT race,count(*)::int n FROM characters GROUP BY race')).rows,
  counts: (await pool.query('SELECT (SELECT count(*)::int FROM characters) characters,(SELECT count(*)::int FROM buildings) buildings,(SELECT count(*)::int FROM items) items,(SELECT count(*)::int FROM messages) messages')).rows[0] }));
def(adminRoutes, 'get', '/admin/players', null, async () => (await pool.query('SELECT c.id,c.pseudo,c.race,c.xp,c.gold,c.blocked,a.email,p.map_id,p.coord_x x,p.coord_y y FROM characters c JOIN accounts a ON a.id=c.account_id LEFT JOIN positions p ON p.character_id=c.id ORDER BY c.id')).rows);
def(adminRoutes, 'post', '/admin/players/{id}/block', z.object({ blocked: z.boolean() }), async (c, b) => { await pool.query('UPDATE characters SET blocked=$2 WHERE id=$1', [P(c, 'id'), b.blocked]); return { ok: true }; });
def(adminRoutes, 'post', '/admin/players/{id}/teleport', z.object({ map: z.number(), x: z.number(), y: z.number() }), (c, b) => tx(async db => {
  const cell = await freeCell(db, b.map, b.x, b.y, 2); await db.query('UPDATE positions SET map_id=$2,coord_x=$3,coord_y=$4 WHERE character_id=$1', [P(c, 'id'), b.map, cell.x, cell.y]); return cell; }));
def(adminRoutes, 'post', '/admin/players/{id}/stat', z.object({ stat: z.string(), delta: z.number().int() }), async (c, b) => {
  if (!STATS.includes(b.stat)) fail(400, 'Statistique inconnue'); await pool.query(`UPDATE characters SET ${b.stat}=GREATEST(0,${b.stat}+$2) WHERE id=$1`, [P(c, 'id'), b.delta]); return { ok: true }; });
def(adminRoutes, 'post', '/admin/create/{table}', z.object({ data: z.record(z.any()) }), async (c, b) => {   // création dynamique d'objets / monstres / montures / sorts
  const t = c.req.param('table'); if (!TABLES.includes(t)) fail(400, 'Table non autorisée');
  const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='game_schema' AND table_name=$1", [t])).rows.map((r: any) => r.column_name);
  const keys = Object.keys(b.data).filter(k => cols.includes(k) && k !== 'id'); if (!keys.length) fail(400, 'Aucune colonne valide');
  const vals = keys.map(k => typeof b.data[k] === 'object' ? JSON.stringify(b.data[k]) : b.data[k]);
  return (await pool.query(`INSERT INTO ${t}(${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`, vals)).rows[0]; });

import { def, router, z } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { hourlyTick } from '../tick.js';
import { RESOURCES } from '../../game/resources.js'; import { RESOURCES2 } from '../../game/resources2.js';
/** Catalogue des ressources des deux mondes (menus déroulants admin) — dédoublonné par id. */
export const RESCATALOG = [...RESOURCES, ...RESOURCES2].reduce((acc, r) => {
  if (!acc.some(x => x.id === r.id)) acc.push({ id: r.id, name: r.name, group: r.group });
  return acc;
}, [] as { id: string; name: string; group: string }[]);
export const coreRoutes = router();
def(coreRoutes, 'get', '/admin/dashboard', null, async () => ({
  byRace: (await pool.query('SELECT race,count(*)::int n FROM characters GROUP BY race')).rows,
  clock: (await pool.query('SELECT last_tick_at FROM game_clock WHERE id=1').catch(() => ({ rows: [] }))).rows[0] ?? null,
  counts: (await pool.query('SELECT (SELECT count(*)::int FROM characters) characters,(SELECT count(*)::int FROM buildings) buildings,(SELECT count(*)::int FROM items) items,(SELECT count(*)::int FROM messages) messages')).rows[0] }));
def(coreRoutes, 'post', '/admin/tick', null, async () => { await hourlyTick(); return { ok: true }; });   // simule la mise à jour horaire
def(coreRoutes, 'get', '/admin/catalog', null, async () => ({
  items: (await pool.query('SELECT id,name FROM items ORDER BY id')).rows,
  spells: (await pool.query('SELECT id,name FROM spells ORDER BY id')).rows,
  // Montures proposées (kits, fiches joueurs) : types de monstres montables (ou montures historiques sans type).
  mounts: (await pool.query('SELECT mo.id, mo.name, mo.monster_id FROM mounts mo LEFT JOIN monsters m ON m.id=mo.monster_id WHERE m.id IS NULL OR m.mountable ORDER BY mo.id')).rows,
  maps: (await pool.query('SELECT id,name_file, width,height FROM maps ORDER BY id')).rows,
  // Rangs (toutes races) et familles divines : conditions d'activation des bâtiments (lot E).
  ranks: (await pool.query('SELECT id, name, race, current_rank FROM specializations ORDER BY race, current_rank')).rows,
  divineFamilies: (await pool.query('SELECT key, name FROM divine_families ORDER BY key')).rows,
  // Catalogue des ressources du jeu (deux mondes) — dédoublonné par id, pour les menus
  // déroulants « ressource » du butin de monstre (phase 3c).
  resources: RESCATALOG }));
def(coreRoutes, 'get', '/admin/audit', null, async c => {
  const q = c.req.query(), limit = Math.min(Number(q.limit ?? 50), 200);
  const w: string[] = [], v: any[] = [];
  if (q.target) { w.push(`target=$${v.length + 1}`); v.push(q.target); }
  if (q.action) { w.push(`action LIKE $${v.length + 1}`); v.push(`%${q.action}%`); }
  const { rows } = await pool.query(
    `SELECT a.id,a.created_at,a.action,a.target,a.target_id,a.before,a.after,COALESCE(ch.pseudo,ac.email) actor
     FROM admin_audit a LEFT JOIN accounts ac ON ac.id=a.actor_id
     LEFT JOIN characters ch ON ch.id=(SELECT min(id) FROM characters WHERE account_id=ac.id)
     ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY a.id DESC LIMIT ${limit}`, v);
  return rows;
});
// Création dynamique conservée pour compatibilité (l'éditeur dédié est /admin/content/*)
def(coreRoutes, 'post', '/admin/create/{table}', z.object({ data: z.record(z.any()) }), async (c, b) => {
  const TABLES = ['items', 'monsters', 'mounts', 'spells'];
  const t = c.req.param('table'); if (!TABLES.includes(t)) fail(400, 'Table non autorisée');
  const cols = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='game_schema' AND table_name=$1", [t])).rows.map((r: any) => r.column_name);
  const keys = Object.keys(b.data).filter(k => cols.includes(k) && k !== 'id'); if (!keys.length) fail(400, 'Aucune colonne valide');
  const vals = keys.map(k => typeof b.data[k] === 'object' ? JSON.stringify(b.data[k]) : b.data[k]);
  const row = (await pool.query(`INSERT INTO ${t}(${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`, vals)).rows[0];
  await audit(c, 'create.legacy', t, row?.id, null, b.data);
  return row;
});

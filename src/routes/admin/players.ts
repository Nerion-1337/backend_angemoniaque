import { def, router, z, P } from '../../lib/route.js'; import { pool, tx, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { freeCell } from '../../game/spawn.js';
/** Endpoints hérités de l'admin historique — complétés en phase 4 (modération, rôles mod). */
export const playerRoutes = router();
const STATS = ['hp_max', 'energy_max', 'divine_energy_max', 'recovery', 'see', 'strength', 'agility', 'armor', 'range', 'xp', 'gold'];
def(playerRoutes, 'get', '/admin/players', null, async () => (await pool.query(
  'SELECT c.id,c.pseudo,c.race,c.xp,c.gold,c.blocked,a.email,p.map_id,p.coord_x x,p.coord_y y FROM characters c JOIN accounts a ON a.id=c.account_id LEFT JOIN positions p ON p.character_id=c.id ORDER BY c.id')).rows);
def(playerRoutes, 'post', '/admin/players/{id}/block', z.object({ blocked: z.boolean() }), async (c, b) => {
  await pool.query('UPDATE characters SET blocked=$2 WHERE id=$1', [P(c, 'id'), b.blocked]);
  await audit(c, 'player.block', 'player', P(c, 'id'), null, b);
  return { ok: true };
});
def(playerRoutes, 'post', '/admin/players/{id}/teleport', z.object({ map: z.number(), x: z.number(), y: z.number() }), (c, b) => tx(async db => {
  const cell = await freeCell(db, b.map, b.x, b.y, 2);
  await db.query('UPDATE positions SET map_id=$2,coord_x=$3,coord_y=$4 WHERE character_id=$1', [P(c, 'id'), b.map, cell.x, cell.y]);
  await audit(c, 'player.teleport', 'player', P(c, 'id'), null, b);
  return cell;
}));
def(playerRoutes, 'post', '/admin/players/{id}/stat', z.object({ stat: z.string(), delta: z.number().int() }), async (c, b) => {
  if (!STATS.includes(b.stat)) fail(400, 'Statistique inconnue');
  await pool.query(`UPDATE characters SET ${b.stat}=GREATEST(0,${b.stat}+$2) WHERE id=$1`, [P(c, 'id'), b.delta]);
  await audit(c, 'player.stat', 'player', P(c, 'id'), null, b);
  return { ok: true };
});
const GRANT: Record<string, string> = {
  item: 'INSERT INTO character_items(character_id,item_id) VALUES ($1,$2)',
  spell: 'INSERT INTO character_spells(character_id,spell_id) VALUES ($1,$2)',
  mount: 'INSERT INTO character_mounts(character_id,mount_id,energy_current,hp_current) SELECT $1,id,energy_max,hp_max FROM mounts WHERE id=$2'
};
def(playerRoutes, 'post', '/admin/players/{id}/grant', z.object({ kind: z.enum(['item', 'spell', 'mount', 'divine']), refId: z.number() }), async (c, b) => {
  const charId = P(c, 'id');
  if (b.kind === 'divine') {
    // Objet divin : transfert du détenteur (UPDATE, jamais d'insertion => aucune duplication), dans la limite des caps.
    const r = await pool.query('UPDATE divine_items SET holder_character_id=$2 WHERE id=$1', [b.refId, charId]);
    if (!r.rowCount) fail(404, 'Objet divin inconnu');
  } else await pool.query(GRANT[b.kind], [charId, b.refId]);
  await audit(c, 'player.grant', 'player', charId, null, b);
  return { ok: true };
});

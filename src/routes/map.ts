import { def, router, P } from '../lib/route.js'; import { pool } from '../lib/db.js'; import { terrain } from '../game/terrain.js'; import { getPublicHealthState } from '../game/rules.js';
export const mapRoutes = router();
const SEL = `SELECT p.coord_x x,p.coord_y y, CASE WHEN p.character_id IS NOT NULL THEN 'character' WHEN p.monsters_id IS NOT NULL THEN 'monster' WHEN p.summon_id IS NOT NULL THEN 'summon' WHEN p.building_id IS NOT NULL THEN 'building' WHEN p.mount_id IS NOT NULL THEN 'mount' ELSE 'item' END kind,
  COALESCE(ch.pseudo,mo.name,sm.name,b.name) name, ch.race, ch.id char_id, mo.id monster_id, sm.id summon_id, b.id building_id, b.kind building_kind, b.invulnerable, s.name rank_name, g.name guild,
  ch.hp_current chp, ch.hp_max chpmax, mo.hp_current mhp, mo.hp_max mhpmax, mo.armor marmor, mo.magic_armor mmarmor, own.pseudo owner, mt.name mount_name, mt.flying mount_flying
  FROM positions p LEFT JOIN characters ch ON ch.id=p.character_id LEFT JOIN specializations s ON s.id=ch.specialization_id LEFT JOIN guilds g ON g.id=ch.guild_id LEFT JOIN monsters mo ON mo.id=p.monsters_id
  LEFT JOIN summons sm ON sm.id=p.summon_id LEFT JOIN characters own ON own.id=sm.owner_id LEFT JOIN buildings b ON b.id=p.building_id LEFT JOIN character_mounts cm ON cm.character_id=ch.id AND cm.active LEFT JOIN mounts mt ON mt.id=cm.mount_id`;
/** Confidentialité : jamais les PV exacts d'un autre joueur, seulement son état de forme. */
const pub = (r: any) => { const { chp, chpmax, ...o } = r; return r.kind === 'character' ? { ...o, health: getPublicHealthState(chp, chpmax) } : o; };
def(mapRoutes, 'get', '/map/{mapId}/area', null, async c => {
  const q = c.req.query(), x = +q.x, y = +q.y, r = Math.min(+q.r || 5, 25);
  return (await pool.query(`${SEL} WHERE p.map_id=$1 AND p.coord_x BETWEEN $2 AND $3 AND p.coord_y BETWEEN $4 AND $5`, [P(c, 'mapId'), x - r, x + r, y - r, y + r])).rows.map(pub);
});
def(mapRoutes, 'get', '/map/{mapId}/cell', null, async c => {
  const q = c.req.query(), x = +q.x, y = +q.y, e = (await pool.query(`${SEL} WHERE p.map_id=$1 AND p.coord_x=$2 AND p.coord_y=$3 AND p.item_id IS NULL`, [P(c, 'mapId'), x, y])).rows[0];
  const out: any = e ? pub(e) : null;
  if (out?.kind === 'character' && q.details) out.visibleGear = (await pool.query('SELECT i.name FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.equipped_slot IS NOT NULL', [out.char_id])).rows.map((r: any) => r.name);
  return { x, y, terrain: terrain(x, y), entity: out };
});
def(mapRoutes, 'get', '/map/{mapId}/landmarks', null, async c => (await pool.query(`SELECT b.name,b.kind,p.coord_x x,p.coord_y y FROM buildings b JOIN positions p ON p.building_id=b.id WHERE p.map_id=$1 AND b.invulnerable`, [P(c, 'mapId')])).rows);

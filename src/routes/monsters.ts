import { def, router, z, P } from '../lib/route.js';
import { tx, ownChar, posOf, fail, log } from '../lib/db.js';
import { checkEntityCost, assertCap } from '../game/entity.js';
import { freeCell } from '../game/spawn.js';
import { broadcast } from '../realtime/ws.js';

export const monsters = router();
/**
 * Invocation d'un monstre du bestiaire (sort/action) : l'invocation est soumise aux règles
 * transverses — checkEntityCost (entity_costs kind 'monster' : or/ressources) et assertCap
 * (entity_caps global / per_player / per_zone). L'invocation est une instance de combat
 * (summons + character_monster) posée sur une case libre adjacente ; elle suit ensuite les
 * règles des invocations existantes (énergie, contrôle, renvoi).
 */
def(monsters, 'post', '/monsters/{monsterId}/summon', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), mp = await posOf(db, me.id);
  const { rows: [m] } = await db.query('SELECT * FROM monsters WHERE id=$1', [P(c, 'monsterId')]);
  if (!m) fail(404, 'Monstre inconnu');
  await assertCap(db, 'monster', m.id, me.id, mp.map_id);
  await checkEntityCost(db, me.id, 'monster', m.id, true);
  const cell = await freeCell(db, mp.map_id, mp.coord_x, mp.coord_y, 2);
  const { rows: [s] } = await db.query(
    `INSERT INTO summons(owner_id,name,hp_current,hp_max,recovery,see,strength,agility,energy_current,energy_max,armor,magic_armor,damage,monster_id)
     VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$8,$9,$10,$6,$11) RETURNING id`,
    [me.id, m.name, m.hp_max, m.recovery, m.see, m.strength, m.agility, m.energy_max, m.armor, m.magic_armor ?? 0, m.id]);
  await db.query('INSERT INTO character_monster(character_id,monster_id,hp_current) VALUES ($1,$2,$3)', [me.id, m.id, m.hp_max]);
  await db.query('INSERT INTO positions(map_id,coord_x,coord_y,summon_id) VALUES ($1,$2,$3,$4)', [mp.map_id, cell.x, cell.y, s.id]);
  await log(db, me.id, `Invoque ${m.name}`);
  broadcast(mp.map_id, { type: 'spawn', summonId: s.id, x: cell.x, y: cell.y });
  return { summonId: s.id };
}));

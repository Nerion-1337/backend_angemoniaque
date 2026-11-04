import { def, router } from '../../lib/route.js'; import { pool } from '../../lib/db.js';
export const bestiaryRoutes = router();
/**
 * Statut bestiaire pour le dashboard (Étape 2 phase 2) :
 *  - instances : monstres actuellement placés sur les cartes (ancrés + sauvages du tick),
 *  - guardians : objets divins et leur monstre gardien / détenteur éventuel.
 */
def(bestiaryRoutes, 'get', '/admin/bestiary/status', null, async c => {
  const { rows: instances } = await pool.query(
    `SELECT m.id, m.name, m.hp_current, m.hp_max, p.map_id, p.coord_x x, p.coord_y y,
       (m.data->>'spawned')::boolean spawned, (m.data->>'prototype')::int prototype, m.guards_item
     FROM monsters m JOIN positions p ON p.monsters_id=m.id ORDER BY m.id`);
  const { rows: guardians } = await pool.query(
    `SELECT di.id, di.kind, di.guardian_monster_id, gm.name guardian, di.holder_character_id, hc.pseudo holder
     FROM divine_items di LEFT JOIN monsters gm ON gm.id=di.guardian_monster_id
       LEFT JOIN characters hc ON hc.id=di.holder_character_id ORDER BY di.id`);
  return { instances, guardians };
});

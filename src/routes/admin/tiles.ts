import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { invalidateTiles, TILE_KINDS } from '../../game/tileTypes.js';
/** Section admin « Cases » : types de case par monde (nom, description, coût d'énergie et d'énergie divine, sort passif bonus/malus). */
export const tileRoutes = router();
const Tile = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional(),
  energyCost: z.number().int().min(0).max(99),
  divineEnergyCost: z.number().int().min(0).max(99).default(0),
  spellId: z.number().int().positive().nullable().optional(),
  spellMode: z.enum(['bonus', 'malus']).nullable().optional()
});
def(tileRoutes, 'get', '/admin/content/tiles', null, async () => (await pool.query(
  `SELECT t.*, m.name_file map_name, s.name spell_name, s.kind spell_kind, s.damage spell_damage
   FROM tile_types t JOIN maps m ON m.id=t.map_id LEFT JOIN spells s ON s.id=t.spell_id ORDER BY t.map_id, t.kind`)).rows);
def(tileRoutes, 'put', '/admin/content/tiles/{mapId}/{kind}', Tile, async (c, b) => {
  const mapId = P(c, 'mapId'), kind = c.req.param('kind');
  if (!TILE_KINDS.includes(kind)) fail(400, `Type de case inconnu : ${kind}`);
  const spellId = b.spellId ?? null, mode = spellId ? b.spellMode ?? null : null;
  if (spellId && !mode) fail(400, 'Choisir si le sort est un bonus ou un malus');
  if (spellId && !(await pool.query('SELECT 1 FROM spells WHERE id=$1', [spellId])).rowCount) fail(404, `Sort n°${spellId} inconnu`);
  const { rows: [before] } = await pool.query('SELECT * FROM tile_types WHERE map_id=$1 AND kind=$2', [mapId, kind]);
  if (!before) fail(404, 'Type de case inconnu pour ce monde');
  const { rows: [row] } = await pool.query(
    'UPDATE tile_types SET name=$3, description=COALESCE($4, description), energy_cost=$5, spell_id=$6, spell_mode=$7, divine_energy_cost=$8 WHERE map_id=$1 AND kind=$2 RETURNING *',
    [mapId, kind, b.name, b.description ?? null, b.energyCost, spellId, mode, b.divineEnergyCost]);
  invalidateTiles(); await bumpContent(); await audit(c, 'tile.update', 'tile', mapId, before, row);
  return row;
});

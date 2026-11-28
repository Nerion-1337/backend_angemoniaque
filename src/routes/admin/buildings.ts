import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js'; import { Activation, checkActivation } from '../../game/activation.js'; import { RespawnLimit, respawnBlockers } from '../../game/respawn.js'; import { syncGates } from '../../game/gates.js'; import { Activations, checkActivations } from '../../game/structActivation.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { safeInsert, safeUpdate, requireRow, extras } from './common.js';
export const buildingRoutes = router();
const Building = z.object({
  name: z.string().max(80), kind: z.string().max(30).optional(), invulnerable: z.boolean().optional(), owner_id: z.number().int().optional(),
  structure: z.number().int().optional(), size: z.number().int().optional(),
  /** XP gagnée par le joueur à chaque coup porté (touché) contre cette structure (migration 47) ; une structure invulnérable n'est pas attaquable. */
  xp_hit: z.number().int().min(0).max(1e6).optional(),
  prerequisites: z.record(z.any()).optional(), data: z.record(z.any()).optional(),
  /** Lot 4 : armure de la structure ; case occupable ; bonus de l'occupant ; attaques possibles contre l'occupant. */
  armor: z.number().int().min(0).optional(), occupiable: z.boolean().optional(),
  bonus_armor: z.number().int().optional(), bonus_magic_armor: z.number().int().optional(), bonus_see: z.number().int().optional(), bonus_range: z.number().int().optional(),
  occupant_attack: z.object({ melee: z.boolean(), ranged: z.boolean(), spell: z.boolean() }).optional(),
  /** Conditions d'activation de la capacité (lot E, migration 28) : groupes alternatifs. */
  activation: Activation.optional(),
  /** Migration 48 : zone sans combat / sans construction (rayon en cases autour de la structure, 0 = aucune). */
  peace_radius: z.number().int().min(0).max(100).optional(), nobuild_radius: z.number().int().min(0).max(100).optional(),
  /** Réapparition de CETTE structure après sa destruction : recréée ou non, délai (heures), conditions (éléments limités). */
  respawn: z.boolean().optional(), respawn_delay_h: z.number().min(0).max(8760).optional(), respawn_limits: z.array(RespawnLimit).max(30).optional(),
  /** Porte : son monde, le monde vers lequel elle mène (activation : `activations`). */
  realm: z.enum(['human', 'demon', 'angel', 'dead']).nullable().optional(), leads_to: z.enum(['human', 'demon', 'angel']).nullable().optional(),
  /** Migration 49 : éléments d'activation (alternatives, chacune avec sa durée) ; structure visible ou non sur la carte des joueurs. */
  activations: Activations.optional(), visible: z.boolean().optional()
});
def(buildingRoutes, 'get', '/admin/content/buildings', null, async c => {
  const q = c.req.query('q');
  const { rows } = q ? await pool.query('SELECT b.*,ch.pseudo owner FROM buildings b LEFT JOIN characters ch ON ch.id=b.owner_id WHERE b.name ILIKE $1 ORDER BY b.name', [`%${q}%`])
    : await pool.query('SELECT b.*,ch.pseudo owner FROM buildings b LEFT JOIN characters ch ON ch.id=b.owner_id ORDER BY b.name');
  return rows;
});
def(buildingRoutes, 'post', '/admin/content/buildings', Building, async (c, b) => {
  if (b.activation) await checkActivation(pool, b.activation);
  if (b.activations) await checkActivations(pool, b.activations);
  const row = await safeInsert('buildings', b as any);
  await bumpContent(); await audit(c, 'building.create', 'building', row.id, null, b);
  return row;
});
def(buildingRoutes, 'get', '/admin/content/buildings/{id}', null, async c => {
  const id = P(c, 'id');
  return { ...(await requireRow('buildings', id)), ...(await extras('building', id)),
    position: (await pool.query('SELECT map_id,coord_x,coord_y FROM positions WHERE building_id=$1', [id])).rows[0] ?? null,
    respawn_blockers: await respawnBlockers(pool, await requireRow('buildings', id)) };
});
def(buildingRoutes, 'put', '/admin/content/buildings/{id}', Building.partial(), async (c, b) => {
  if (b.activation) await checkActivation(pool, b.activation);
  if (b.activations) await checkActivations(pool, b.activations);
  const row = await safeUpdate('buildings', P(c, 'id'), b as any);
  if (row?.kind === 'door') await syncGates(pool);   // monde / destination d'une porte changés
  await bumpContent(); await audit(c, 'building.update', 'building', P(c, 'id'), null, b);
  return row;
});
def(buildingRoutes, 'delete', '/admin/content/buildings/{id}', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM positions WHERE building_id=$1', [id])).rowCount) fail(409, 'Bâtiment placé sur une carte : supprimez d\'abord sa position');
  await pool.query('DELETE FROM buildings WHERE id=$1', [id]);
  await bumpContent(); await audit(c, 'building.delete', 'building', id, null, null);
  return { ok: true };
});
/** Sorts liés à un bâtiment (entity_spells, lot 4) : actifs = lançables par le propriétaire à côté, passifs = appliqués chaque heure. */
def(buildingRoutes, 'get', '/admin/content/buildings/{id}/spells', null, async c => (await pool.query(
  "SELECT es.id, es.spell_id, es.mode, s.name, s.effects FROM entity_spells es JOIN spells s ON s.id=es.spell_id WHERE es.kind='building' AND es.ref_id=$1 ORDER BY s.name", [P(c, 'id')])).rows);

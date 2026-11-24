import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { Effects } from '../../game/spellEffects.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
import { RARITIES, USABLE_KINDS } from './common.js';
/**
 * Étape 2 — Phase 3b : catalogue global de sorts (base de sorts du jeu), capacités des
 * monstres (actives : sorts qu'ils peuvent LANCER ; passives : sorts appliqués EN CONTINU
 * sans consommation d'énergie, cible + périmètre — les auras de la phase 3 initiale sont
 * fusionnées ici), et parties du corps équipables par type (7 slots, style personnage).
 */
export const spellRoutes = router();
const Spell = z.object({
  name: z.string().max(80), kind: z.string().max(20).optional(),
  rarity: z.enum(RARITIES).optional(),
  /** Qui peut apprendre ce sort (sous-ensemble des 6 kinds ; vide = tout le monde). */
  usableBy: z.array(z.enum(USABLE_KINDS)).max(6).optional(),
  energyCost: z.number().int().min(0).optional(),
  damage: z.number().int().optional(), description: z.string().max(400).optional(),
  price: z.number().int().min(0).optional(), durationH: z.number().int().min(0).optional(),
  /** Boutique de l'hôtel de ville : en vente ou non, et pour quelles races ([] = toutes). */
  shop: z.boolean().optional(), shopRaces: z.array(z.string().max(40)).max(20).optional(),
  /** Moteur de sorts (lot 2) : cible, portée, zone, camp, dégâts, soin, durée, caractéristiques. {} = sort historique. */
  effects: z.union([Effects, z.object({}).strict()]).optional()
});
const usable = (b: any) => b.usableBy !== undefined ? { ...b, usable_by: JSON.stringify(b.usableBy) } : b;
def(spellRoutes, 'get', '/admin/content/spells', null, async c => {
  const q = c.req.query('q'), rarity = c.req.query('rarity');
  const where: string[] = [], args: any[] = [];
  if (q) { where.push(`s.name ILIKE $${args.push(`%${q}%`)}`); }
  if (rarity) { where.push(`s.rarity=$${args.push(rarity)}`); }
  // Décompte « appris par N » (personnages qui le possèdent) par sort.
  const { rows } = await pool.query(
    `SELECT s.*,COALESCE(l.n,0) learners FROM spells s
     LEFT JOIN (SELECT spell_id,count(*)::int n FROM character_spells GROUP BY spell_id) l ON l.spell_id=s.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.name`, args);
  return rows;
});
def(spellRoutes, 'post', '/admin/content/spells', Spell, async (c, b) => {
  const { rows: [row] } = await pool.query(
    `INSERT INTO spells(name,kind,energy_cost,damage,description,price,duration_h,rarity,usable_by,shop,shop_races,effects)
     VALUES ($1,$2,COALESCE($3,10),$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [b.name, b.kind ?? null, b.energyCost ?? null, b.damage ?? null, b.description ?? null, b.price ?? null,
     b.durationH ?? null, b.rarity ?? 'commun', JSON.stringify(b.usableBy ?? []), b.shop ?? true, JSON.stringify(b.shopRaces ?? []), JSON.stringify(b.effects ?? {})]);
  await audit(c, 'spell.create', 'spell', row.id, null, b);
  return row;
});
def(spellRoutes, 'put', '/admin/content/spells/{id}', Spell.partial(), async (c, b) => {
  const u = usable(b);
  const { rows: [row] } = await pool.query(
    `UPDATE spells SET name=COALESCE($2,name), kind=COALESCE($3,kind), energy_cost=COALESCE($4,energy_cost),
      damage=COALESCE($5,damage), description=COALESCE($6,description), price=COALESCE($7,price),
      duration_h=COALESCE($8,duration_h), rarity=COALESCE($9,rarity),
      usable_by=CASE WHEN $10::jsonb IS NULL THEN usable_by ELSE $10::jsonb END,
      shop=COALESCE($11,shop), shop_races=CASE WHEN $12::jsonb IS NULL THEN shop_races ELSE $12::jsonb END,
      effects=CASE WHEN $13::jsonb IS NULL THEN effects ELSE $13::jsonb END
     WHERE id=$1 RETURNING *`,
    [P(c, 'id'), b.name, b.kind ?? null, b.energyCost ?? null, b.damage ?? null, b.description ?? null, b.price ?? null, b.durationH ?? null, b.rarity ?? null, u.usable_by ?? null,
     b.shop ?? null, b.shopRaces !== undefined ? JSON.stringify(b.shopRaces) : null, b.effects !== undefined ? JSON.stringify(b.effects) : null]);
  if (!row) fail(404, 'Sort inconnu');
  await audit(c, 'spell.update', 'spell', P(c, 'id'), null, b);
  return row;
});
def(spellRoutes, 'delete', '/admin/content/spells/{id}', null, async c => {
  const r = await pool.query('DELETE FROM spells WHERE id=$1 RETURNING id', [P(c, 'id')]);
  if (!r.rowCount) fail(404, 'Sort inconnu');
  await audit(c, 'spell.delete', 'spell', P(c, 'id'), null, null);
  return { ok: true };
});

/** Capacités, équipement et parties équipables du monstre (sous-collections). */
export const monsterDetailRoutes = router();
async function requireMonster(id: number) {
  if ((await pool.query('SELECT 1 FROM monsters WHERE id=$1', [id])).rowCount === 0) fail(404, 'Monstre inconnu');
}
const SLOTS = z.enum(['mains', 'tete', 'torse', 'pieds', 'collier', 'bracelet', 'bague']);

// ── Capacités : actives (sorts lancés) et passives (en continu, sans énergie) ─────────
def(monsterDetailRoutes, 'get', '/admin/content/monsters/{id}/spells', null, async c => {
  const id = P(c, 'id');
  await requireMonster(id);
  const { rows } = await pool.query(
    `SELECT ms.*, s.name, s.kind, s.energy_cost FROM monster_spells ms
     JOIN spells s ON s.id=ms.spell_id WHERE ms.monster_id=$1 ORDER BY ms.mode, ms.id`, [id]);
  return rows;
});
def(monsterDetailRoutes, 'post', '/admin/content/monsters/{id}/spells',
  z.object({ spellId: z.number().int(), mode: z.enum(['active', 'passive']), target: z.enum(['ally', 'enemy']).optional(), radius: z.number().int().min(1).max(50).optional() }), async (c, b) => {
  const id = P(c, 'id');
  await requireMonster(id);
  if ((await pool.query('SELECT 1 FROM spells WHERE id=$1', [b.spellId])).rowCount === 0) fail(404, 'Sort inconnu');
  // Cible/périmètre : réservés aux passives (en continu) ; actives lancées à la demande.
  const target = b.mode === 'passive' ? b.target ?? null : null;
  const radius = b.mode === 'passive' ? (b.radius ?? 3) : null;
  const { rows: [row] } = await pool.query(
    `INSERT INTO monster_spells(monster_id,spell_id,mode,target,radius) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (monster_id,spell_id,mode) DO NOTHING RETURNING *`, [id, b.spellId, b.mode, target, radius]);
  if (!row) fail(409, 'Capacité déjà attribuée dans ce mode');
  await audit(c, 'monster.spell', 'monster', id, null, b);
  return row;
});
def(monsterDetailRoutes, 'delete', '/admin/content/monsters/{id}/spells/{rowId}', null, async c => {
  const r = await pool.query('DELETE FROM monster_spells WHERE id=$1 AND monster_id=$2 RETURNING id', [P(c, 'rowId'), P(c, 'id')]);
  if (!r.rowCount) fail(404, 'Capacité inconnue');
  await audit(c, 'monster.spell.delete', 'monster', P(c, 'id'), null, { rowId: P(c, 'rowId') });
  return { ok: true };
});

// ── Équipement (objet + slot) ───────────────────────────────────────────────────────────
def(monsterDetailRoutes, 'get', '/admin/content/monsters/{id}/equips', null, async c => {
  const id = P(c, 'id');
  await requireMonster(id);
  const { rows } = await pool.query(
    `SELECT me.*, i.name item_name, i.slot item_slot FROM monster_equips me
     JOIN items i ON i.id=me.item_id WHERE me.monster_id=$1 ORDER BY me.id`, [id]);
  return rows;
});
def(monsterDetailRoutes, 'post', '/admin/content/monsters/{id}/equips', z.object({ itemId: z.number().int(), slot: SLOTS }), async (c, b) => {
  const id = P(c, 'id');
  await requireMonster(id);
  if ((await pool.query('SELECT 1 FROM items WHERE id=$1', [b.itemId])).rowCount === 0) fail(404, 'Objet inconnu');
  // La restriction aux parties équipables est définie par type (monster_slots) et bornée
  // côté serveur : une instance est soumise à la grille de son prototype (le type lui-même
  // à la sienne). Aucune partie sélectionnée pour le type → aucun équipement possible.
  const { rows: [m] } = await pool.query("SELECT COALESCE((data->>'prototype')::int, id) grid_ref FROM monsters WHERE id=$1", [id]);
  const { rows: grid } = await pool.query('SELECT slot FROM monster_slots WHERE monster_id=$1', [m.grid_ref]);
  if (grid.length === 0) fail(400, 'Aucune partie du corps sélectionnée pour ce type (onglet Spécificités) : aucun équipement possible');
  if (!grid.some(g => g.slot === b.slot)) fail(400, `La partie « ${b.slot} » n'est pas équipables pour ce type (cochées : ${grid.map(g => g.slot).join(', ')})`);
  // Même objet → on met à jour le slot (une pièce par objet par monstre).
  const { rows: [row] } = await pool.query(
    `INSERT INTO monster_equips(monster_id,item_id,slot) VALUES ($1,$2,$3)
     ON CONFLICT (monster_id,item_id) DO UPDATE SET slot=EXCLUDED.slot RETURNING *`, [id, b.itemId, b.slot]);
  await audit(c, 'monster.equip', 'monster', id, null, b);
  return row;
});
def(monsterDetailRoutes, 'delete', '/admin/content/monsters/{id}/equips/{itemId}', null, async c => {
  const r = await pool.query('DELETE FROM monster_equips WHERE monster_id=$1 AND item_id=$2 RETURNING id', [P(c, 'id'), P(c, 'itemId')]);
  if (!r.rowCount) fail(404, 'Équipement inconnu');
  await audit(c, 'monster.equip.delete', 'monster', P(c, 'id'), null, { itemId: P(c, 'itemId') });
  return { ok: true };
});

// ── Parties du corps équipables (grille style personnage, par type de monstre) ─────────
def(monsterDetailRoutes, 'get', '/admin/content/monsters/{id}/slots', null, async c => {
  const id = P(c, 'id');
  await requireMonster(id);
  const { rows } = await pool.query('SELECT slot FROM monster_slots WHERE monster_id=$1 ORDER BY slot', [id]);
  return rows;
});
def(monsterDetailRoutes, 'post', '/admin/content/monsters/{id}/slots', z.object({ slot: SLOTS }), async (c, b) => {
  const id = P(c, 'id');
  await requireMonster(id);
  await pool.query('INSERT INTO monster_slots(monster_id,slot) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, b.slot]);
  await audit(c, 'monster.slot', 'monster', id, null, b);
  return { ok: true };
});
def(monsterDetailRoutes, 'delete', '/admin/content/monsters/{id}/slots/{slot}', null, async c => {
  const r = await pool.query('DELETE FROM monster_slots WHERE monster_id=$1 AND slot=$2 RETURNING slot', [P(c, 'id'), P(c, 'slot')]);
  if (!r.rowCount) fail(404, 'Slot inconnu');
  await audit(c, 'monster.slot.delete', 'monster', P(c, 'id'), null, { slot: P(c, 'slot') });
  return { ok: true };
});

// ── Liens d'un sort : monstres (monster_spells), objets, montures, bâtiments (entity_spells) ─────────
const LINK_TBL: Record<string, string> = { monster: 'monsters', item: 'items', mount: 'mounts', building: 'buildings' };
def(spellRoutes, 'get', '/admin/content/spells/{id}/links', null, async c => {
  const id = P(c, 'id');
  const mon = (await pool.query("SELECT ms.id, 'monster' kind, ms.monster_id ref_id, ms.mode, m.name FROM monster_spells ms JOIN monsters m ON m.id=ms.monster_id WHERE ms.spell_id=$1 ORDER BY m.name", [id])).rows;
  const ent = (await pool.query(`SELECT es.id, es.kind, es.ref_id, es.mode, COALESCE(i.name, mo.name, b.name) name FROM entity_spells es
    LEFT JOIN items i ON es.kind='item' AND i.id=es.ref_id LEFT JOIN mounts mo ON es.kind='mount' AND mo.id=es.ref_id LEFT JOIN buildings b ON es.kind='building' AND b.id=es.ref_id
    WHERE es.spell_id=$1 ORDER BY es.kind, name`, [id])).rows;
  return [...mon, ...ent];
});
def(spellRoutes, 'post', '/admin/content/spells/{id}/links', z.object({ kind: z.enum(['monster', 'item', 'mount', 'building']), refId: z.number().int(), mode: z.enum(['active', 'passive']).default('active') }), async (c, b) => {
  const id = P(c, 'id');
  if (!(await pool.query('SELECT 1 FROM spells WHERE id=$1', [id])).rowCount) fail(404, 'Sort inconnu');
  if (!(await pool.query(`SELECT 1 FROM ${LINK_TBL[b.kind]} WHERE id=$1`, [b.refId])).rowCount) fail(404, 'Élément inconnu');
  const r = b.kind === 'monster'
    ? await pool.query("INSERT INTO monster_spells(monster_id,spell_id,mode,radius) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id", [b.refId, id, b.mode, b.mode === 'passive' ? 3 : null])
    : await pool.query('INSERT INTO entity_spells(kind,ref_id,spell_id,mode) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id', [b.kind, b.refId, id, b.mode]);
  if (!r.rowCount) fail(409, 'Lien déjà existant');
  await bumpContent(); await audit(c, 'spell.link', 'spell', id, null, b);
  return { ok: true, id: r.rows[0].id };
});
def(spellRoutes, 'delete', '/admin/content/spells/{id}/links/{kind}/{linkId}', null, async c => {
  const kind = c.req.param('kind'), linkId = P(c, 'linkId');
  const r = kind === 'monster' ? await pool.query('DELETE FROM monster_spells WHERE id=$1 AND spell_id=$2', [linkId, P(c, 'id')])
    : await pool.query('DELETE FROM entity_spells WHERE id=$1 AND spell_id=$2', [linkId, P(c, 'id')]);
  if (!r.rowCount) fail(404, 'Lien inconnu');
  await bumpContent(); await audit(c, 'spell.unlink', 'spell', P(c, 'id'), { kind, linkId }, null);
  return { ok: true };
});

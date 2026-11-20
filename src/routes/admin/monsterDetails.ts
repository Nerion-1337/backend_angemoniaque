import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
/**
 * Étape 2 — Phase 3b : catalogue global de sorts (base de sorts du jeu), capacités des
 * monstres (actives : sorts qu'ils peuvent LANCER ; passives : sorts appliqués EN CONTINU
 * sans consommation d'énergie, cible + périmètre — les auras de la phase 3 initiale sont
 * fusionnées ici), et parties du corps équipables par type (7 slots, style personnage).
 */
export const spellRoutes = router();
const Spell = z.object({
  name: z.string().max(80), kind: z.string().max(20).optional(), energyCost: z.number().int().min(0).optional(),
  damage: z.number().int().optional(), description: z.string().max(400).optional(),
  price: z.number().int().min(0).optional(), durationH: z.number().int().min(0).optional()
});
def(spellRoutes, 'get', '/admin/content/spells', null, async c => {
  const q = c.req.query('q');
  const { rows } = q ? await pool.query('SELECT * FROM spells WHERE name ILIKE $1 ORDER BY name', [`%${q}%`])
    : await pool.query('SELECT * FROM spells ORDER BY name');
  return rows;
});
def(spellRoutes, 'post', '/admin/content/spells', Spell, async (c, b) => {
  const { rows: [row] } = await pool.query(
    `INSERT INTO spells(name,kind,energy_cost,damage,description,price,duration_h)
     VALUES ($1,$2,COALESCE($3,10),$4,$5,$6,$7) RETURNING *`,
    [b.name, b.kind ?? null, b.energyCost ?? null, b.damage ?? null, b.description ?? null, b.price ?? null, b.durationH ?? null]);
  await audit(c, 'spell.create', 'spell', row.id, null, b);
  return row;
});
def(spellRoutes, 'put', '/admin/content/spells/{id}', Spell.partial(), async (c, b) => {
  const { rows: [row] } = await pool.query(
    `UPDATE spells SET name=COALESCE($2,name), kind=COALESCE($3,kind), energy_cost=COALESCE($4,energy_cost),
      damage=COALESCE($5,damage), description=COALESCE($6,description), price=COALESCE($7,price),
      duration_h=COALESCE($8,duration_h)
     WHERE id=$1 RETURNING *`,
    [P(c, 'id'), b.name, b.kind ?? null, b.energyCost ?? null, b.damage ?? null, b.description ?? null, b.price ?? null, b.durationH ?? null]);
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
  // Même objet → on met à jour le slot (une pièce par objet par monstre).
  // La restriction aux parties équipables du type est appliquée par l'UI (liste monster_slots),
  // pas ici : un admin peut équiper hors restriction en connaissance de cause.
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

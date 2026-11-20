import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent } from '../../game/content.js';
/**
 * Étape 2 — Phase 3 : catalogue global de sorts (base de sorts du jeu) + sous-collections
 * du monstre (compétences/sorts, équipement par slot, auras : bonus/malus en continu).
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

/** Sous-collections du monstre : compétences/sorts (catalogue global), équipement (7 slots), auras. */
export const monsterDetailRoutes = router();
async function requireMonster(id: number) {
  if ((await pool.query('SELECT 1 FROM monsters WHERE id=$1', [id])).rowCount === 0) fail(404, 'Monstre inconnu');
}
const SLOTS = z.enum(['mains', 'tete', 'torse', 'pieds', 'collier', 'bracelet', 'bague']);

def(monsterDetailRoutes, 'get', '/admin/content/monsters/{id}/spells', null, async c => {
  const id = P(c, 'id');
  await requireMonster(id);
  const { rows } = await pool.query(
    `SELECT ms.*, s.name, s.kind, s.energy_cost, s.duration_h FROM monster_spells ms
     JOIN spells s ON s.id=ms.spell_id WHERE ms.monster_id=$1 ORDER BY ms.id`, [id]);
  return rows;
});
def(monsterDetailRoutes, 'post', '/admin/content/monsters/{id}/spells', z.object({ spellId: z.number().int() }), async (c, b) => {
  const id = P(c, 'id');
  await requireMonster(id);
  if ((await pool.query('SELECT 1 FROM spells WHERE id=$1', [b.spellId])).rowCount === 0) fail(404, 'Sort inconnu');
  const { rows: [row] } = await pool.query(
    'INSERT INTO monster_spells(monster_id,spell_id) VALUES ($1,$2) ON CONFLICT (monster_id,spell_id) DO NOTHING RETURNING *', [id, b.spellId]);
  if (!row) fail(409, 'Sort déjà attribué à ce monstre');
  await audit(c, 'monster.spell', 'monster', id, null, b);
  return row;
});
def(monsterDetailRoutes, 'delete', '/admin/content/monsters/{id}/spells/{spellId}', null, async c => {
  const r = await pool.query('DELETE FROM monster_spells WHERE monster_id=$1 AND spell_id=$2 RETURNING id', [P(c, 'id'), P(c, 'spellId')]);
  if (!r.rowCount) fail(404, 'Attribution inconnue');
  await audit(c, 'monster.spell.delete', 'monster', P(c, 'id'), null, { spellId: P(c, 'spellId') });
  return { ok: true };
});

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

def(monsterDetailRoutes, 'get', '/admin/content/monsters/{id}/auras', null, async c => {
  const id = P(c, 'id');
  await requireMonster(id);
  const { rows } = await pool.query(
    `SELECT a.*, s.name spell_name FROM monster_auras a JOIN spells s ON s.id=a.spell_id
     WHERE a.monster_id=$1 ORDER BY a.id`, [id]);
  return rows;
});
def(monsterDetailRoutes, 'post', '/admin/content/monsters/{id}/auras',
  z.object({ spellId: z.number().int(), target: z.enum(['ally', 'enemy']), radius: z.number().int().min(1).max(50).default(3) }), async (c, b) => {
  const id = P(c, 'id');
  await requireMonster(id);
  if ((await pool.query('SELECT 1 FROM spells WHERE id=$1', [b.spellId])).rowCount === 0) fail(404, 'Sort inconnu');
  const { rows: [row] } = await pool.query(
    'INSERT INTO monster_auras(monster_id,spell_id,target,radius) VALUES ($1,$2,$3,$4) ON CONFLICT (monster_id,spell_id,target) DO NOTHING RETURNING *',
    [id, b.spellId, b.target, b.radius]);
  if (!row) fail(409, 'Aura déjà définie pour ce sort et cette cible');
  await audit(c, 'monster.aura', 'monster', id, null, b);
  return row;
});
def(monsterDetailRoutes, 'delete', '/admin/content/monsters/{id}/auras/{auraId}', null, async c => {
  const r = await pool.query('DELETE FROM monster_auras WHERE id=$1 AND monster_id=$2 RETURNING id', [P(c, 'auraId'), P(c, 'id')]);
  if (!r.rowCount) fail(404, 'Aura inconnue');
  await audit(c, 'monster.aura.delete', 'monster', P(c, 'id'), null, { auraId: P(c, 'auraId') });
  return { ok: true };
});

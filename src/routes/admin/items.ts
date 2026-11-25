import { def, router, z, P } from '../../lib/route.js'; import { pool, fail } from '../../lib/db.js';
import { audit } from '../../lib/audit.js'; import { bumpContent, divineCap } from '../../game/content.js';
import { safeInsert, safeUpdate, requireRow, extras, RARITIES, USABLE_KINDS } from './common.js';
export const itemRoutes = router();
const Item = z.object({
  name: z.string().max(80), slot: z.string().max(30).optional(),
  /** Libre : les anciennes données conservent leurs valeurs (l'UI admin propose les 5
   *  RARITIES) ; les nouveaux sorts (colonne fraîche) sont bornés par l'enum. */
  rarity: z.string().max(20).optional(),
  /** Qui peut s'en équiper (sous-ensemble des 6 kinds ; vide = tout le monde). */
  usable_by: z.array(z.enum(USABLE_KINDS)).max(6).optional(),
  quantity_max: z.number().int().optional(), price: z.number().int().optional(), shop: z.boolean().optional(),
  shop_stock: z.number().int().optional(), durability: z.number().int().optional(),
  armor: z.number().int().optional(), strength_bonus: z.number().int().optional(), agility_bonus: z.number().int().optional(),
  req_strength: z.number().int().optional(), weapon_damage: z.number().int().optional(), magic_armor: z.number().int().optional(),
  /** Arme à deux mains (un arc l'est toujours) : occupe les deux mains (migration 32). */
  two_handed: z.boolean().optional(),
  data: z.record(z.any()).optional(),
  /** Caractéristiques reportées sur la fiche à l'équipement (migration 26) ; valeur négative = malus. */
  bonuses: z.record(z.enum(['hp_max', 'recovery', 'energy_max', 'divine_energy_max', 'see', 'range']), z.number().int().min(-1000).max(1000)).optional(),
  /** Races qui trouvent l'objet dans la boutique de leur hôtel de ville ([] = toutes) — avec `shop`. */
  shop_races: z.array(z.string().max(40)).max(20).optional(),
  /** Famille d'objet divin (rareté « divin » uniquement) : clé de divine_families. */
  divine_family: z.string().max(30).nullable().optional()
});
const usable = (b: any) => ({ ...b, ...(b.usable_by !== undefined ? { usable_by: JSON.stringify(b.usable_by) } : {}), ...(b.shop_races !== undefined ? { shop_races: JSON.stringify(b.shop_races) } : {}) });
def(itemRoutes, 'get', '/admin/content/items', null, async c => {
  const q = c.req.query('q'), kind = c.req.query('kind'), rarity = c.req.query('rarity'), slot = c.req.query('slot');
  if (kind === 'divine') {
    const { rows } = await pool.query(`SELECT di.*,COALESCE(ch.pseudo,'libre') holder,mo.name guardian FROM divine_items di LEFT JOIN characters ch ON ch.id=di.holder_character_id LEFT JOIN monsters mo ON mo.id=di.guardian_monster_id ORDER BY di.kind,di.id`);
    return rows;
  }
  // Rareté normalisée : les données historiques sont en texte libre (ex. « Épique »,
  // « Commun », « unique ») — le filtre et l'affichage passent par cette normalisation
  // vers les 5 valeurs canoniques (les écrits récents du UI le sont déjà).
  const rarNorm = `CASE lower(i.rarity)
     WHEN 'commun' THEN 'commun' WHEN 'rare' THEN 'rare'
     WHEN 'epique' THEN 'epique' WHEN 'épique' THEN 'epique'
     WHEN 'legendaire' THEN 'legendaire' WHEN 'légendaire' THEN 'legendaire' WHEN 'legendary' THEN 'legendaire'
     WHEN 'divin' THEN 'divin' WHEN 'unique' THEN 'divin'
     ELSE COALESCE(lower(i.rarity), 'commun') END`;
  const where: string[] = [], args: any[] = [];
  if (q) { where.push(`i.name ILIKE $${args.push(`%${q}%`)}`); }
  if (rarity) { where.push(`(${rarNorm})=$${args.push(rarity)}`); }
  if (slot === 'none') { where.push("(i.slot IS NULL OR i.slot='')"); }
  else if (slot) { where.push(`i.slot=$${args.push(slot)}`); }
  // Décompte « détenu par N » (instances du jeu qui le portent) par objet.
  // rarity_n : rareté normalisée (affichage) ; i.* conserve les colonnes brutes
  // (le formulaire d'édition reste alimenté par les vraies valeurs).
  // Objets divins : holders inclut les exemplaires détenus (divine_items), copies = exemplaires créés, family_cap = plafond.
  const { rows } = await pool.query(
    `SELECT i.*, ${rarNorm} rarity_n, COALESCE(h.n,0) + COALESCE(dv.held,0) holders, COALESCE(dv.copies,0) copies, df.name family_name, df.cap family_cap FROM items i
     LEFT JOIN (SELECT item_id,count(*)::int n FROM character_items GROUP BY item_id) h ON h.item_id=i.id
     LEFT JOIN (SELECT item_id,count(*)::int copies,count(holder_character_id)::int held FROM divine_items GROUP BY item_id) dv ON dv.item_id=i.id
     LEFT JOIN divine_families df ON df.key=i.divine_family
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.id`, args);
  return rows;
});
/** Une famille divine n'a de sens que pour la rareté « divin » ; elle doit exister. */
const checkFamily = async (b: any) => {
  if (!b.divine_family) return;
  if (b.rarity !== undefined && b.rarity !== 'divin') fail(400, 'Une famille divine exige la rareté « divin »');
  if (!(await pool.query('SELECT 1 FROM divine_families WHERE key=$1', [b.divine_family])).rowCount) fail(404, `Famille divine inconnue : ${b.divine_family}`);
};
def(itemRoutes, 'post', '/admin/content/items', Item, async (c, b) => {
  await checkFamily(b);
  const row = await safeInsert('items', usable(b) as any);
  await bumpContent(); await audit(c, 'item.create', 'item', row.id, null, b);
  return row;
});
def(itemRoutes, 'get', '/admin/content/items/{id}', null, async c => {
  const id = P(c, 'id');
  return { ...(await requireRow('items', id)), ...(await extras('item', id)) };
});
def(itemRoutes, 'put', '/admin/content/items/{id}', Item.partial(), async (c, b) => {
  await checkFamily(b);
  const row = await safeUpdate('items', P(c, 'id'), usable(b) as any);
  await bumpContent(); await audit(c, 'item.update', 'item', P(c, 'id'), null, b);
  return row;
});
def(itemRoutes, 'delete', '/admin/content/items/{id}', null, async c => {
  const id = P(c, 'id');
  if ((await pool.query('SELECT 1 FROM character_items WHERE item_id=$1', [id])).rowCount) fail(409, 'Objet détenu par des joueurs');
  if ((await pool.query('SELECT 1 FROM divine_items WHERE item_id=$1', [id])).rowCount) fail(409, 'Supprimez d’abord les exemplaires divins de cet objet');
  await pool.query('DELETE FROM items WHERE id=$1', [id]);
  await bumpContent(); await audit(c, 'item.delete', 'item', id, null, null);
  return { ok: true };
});
// ---- Objets divins : familles (relique / arcane / artefact + libres) et exemplaires uniques ----
const Family = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{1,29}$/, 'clé : minuscules, chiffres, _ (2 à 30)'), name: z.string().trim().min(1).max(60), cap: z.number().int().min(0).nullable().optional() });
const CORE_FAMILIES = ['relique', 'arcane', 'artefact'];   // utilisées par les règles du jeu (rangs par race, portes)
def(itemRoutes, 'get', '/admin/content/divine-families', null, async () => (await pool.query(
  `SELECT f.*, COALESCE(n.copies,0) copies, COALESCE(n.held,0) held FROM divine_families f
   LEFT JOIN (SELECT kind,count(*)::int copies,count(holder_character_id)::int held FROM divine_items GROUP BY kind) n ON n.kind=f.key ORDER BY f.key`)).rows);
def(itemRoutes, 'post', '/admin/content/divine-families', Family, async (c, b) => {
  const { rows: [row] } = await pool.query('INSERT INTO divine_families(key,name,cap) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING RETURNING *', [b.key, b.name, b.cap ?? null]);
  if (!row) fail(409, 'Famille déjà existante');
  await bumpContent(); await audit(c, 'divine_family.create', 'divine_family', undefined, null, b);
  return row;
});
def(itemRoutes, 'put', '/admin/content/divine-families/{key}', Family.omit({ key: true }), async (c, b) => {
  const key = c.req.param('key');
  const { rows: [n] } = await pool.query('SELECT count(*)::int n FROM divine_items WHERE kind=$1', [key]);
  if (b.cap != null && n.n > b.cap) fail(409, `Il existe déjà ${n.n} exemplaire(s) : plafond ${b.cap} impossible`);
  const { rows: [row] } = await pool.query('UPDATE divine_families SET name=$2, cap=$3 WHERE key=$1 RETURNING *', [key, b.name, b.cap ?? null]);
  if (!row) fail(404, 'Famille inconnue');
  await bumpContent(); await audit(c, 'divine_family.update', 'divine_family', undefined, null, { key, ...b });
  return row;
});
def(itemRoutes, 'delete', '/admin/content/divine-families/{key}', null, async c => {
  const key = c.req.param('key');
  if (CORE_FAMILIES.includes(key)) fail(409, 'Famille utilisée par les règles du jeu (rangs par race, portes)');
  if ((await pool.query('SELECT 1 FROM divine_items WHERE kind=$1 UNION ALL SELECT 1 FROM items WHERE divine_family=$1', [key])).rowCount) fail(409, 'Famille encore utilisée par des objets');
  await pool.query('DELETE FROM divine_families WHERE key=$1', [key]);
  await bumpContent(); await audit(c, 'divine_family.delete', 'divine_family', undefined, null, { key });
  return { ok: true };
});
def(itemRoutes, 'get', '/admin/content/divine', null, async c => {
  const kind = c.req.query('kind'), itemId = c.req.query('itemId');
  const w: string[] = [], v: any[] = [];
  if (kind) w.push(`di.kind=$${v.push(kind)}`);
  if (itemId) w.push(`di.item_id=$${v.push(Number(itemId))}`);
  const { rows } = await pool.query(
    `SELECT di.*,COALESCE(ch.pseudo,'libre') holder,mo.name guardian,i.name item_name FROM divine_items di
     LEFT JOIN characters ch ON ch.id=di.holder_character_id LEFT JOIN monsters mo ON mo.id=di.guardian_monster_id LEFT JOIN items i ON i.id=di.item_id
     ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY di.kind,di.id`, v);
  return rows;
});
/** Crée n exemplaires : d'un objet divin (itemId, famille = celle de l'objet) ou, mode historique, d'une famille (kind). */
def(itemRoutes, 'post', '/admin/content/divine', z.object({
  kind: z.string().max(30).optional(), itemId: z.number().int().optional(), guardian_monster_id: z.number().int().optional(), n: z.number().int().min(1).max(20).default(1)
}), async (c, b) => {
  let kind = b.kind, itemId: number | null = b.itemId ?? null;
  if (itemId) {
    const { rows: [it] } = await pool.query('SELECT divine_family FROM items WHERE id=$1', [itemId]);
    if (!it) fail(404, 'Objet inconnu');
    if (!it.divine_family) fail(400, 'Cet objet n’a pas de famille divine');
    kind = it.divine_family;
  } else {
    if (!kind) fail(400, 'Objet (itemId) ou famille (kind) requis');
    itemId = (await pool.query('SELECT min(id) id FROM items WHERE divine_family=$1', [kind])).rows[0]?.id ?? null;
  }
  if (!(await pool.query('SELECT 1 FROM divine_families WHERE key=$1', [kind])).rowCount) fail(404, `Famille divine inconnue : ${kind}`);
  const cap = await divineCap(kind!);
  const { rows: [ex] } = await pool.query('SELECT count(*)::int n FROM divine_items WHERE kind=$1', [kind]);
  if (cap !== null && ex.n + b.n > cap) fail(409, `Plafond de ${cap} ${kind}(s) (il en existe ${ex.n})`);
  for (let i = 0; i < b.n; i++)
    await pool.query('INSERT INTO divine_items(kind,item_id,guardian_monster_id) VALUES ($1,$2,$3)', [kind, itemId, b.guardian_monster_id ?? null]);
  await bumpContent(); await audit(c, 'divine.create', 'divine', itemId ?? undefined, null, b);
  return { ok: true, created: b.n, cap };
});
/** Supprime un exemplaire non détenu (un exemplaire détenu se libère d'abord depuis la fiche du joueur). */
def(itemRoutes, 'delete', '/admin/content/divine/{id}', null, async c => {
  const id = P(c, 'id');
  const { rows: [d] } = await pool.query('SELECT * FROM divine_items WHERE id=$1', [id]);
  if (!d) fail(404, 'Exemplaire inconnu');
  if (d.holder_character_id) fail(409, 'Exemplaire détenu par un joueur : le libérer d’abord');
  await pool.query('DELETE FROM monster_loot WHERE divine_id=$1 AND item_id IS NULL AND resource IS NULL', [id]);
  await pool.query('UPDATE monster_loot SET divine_id=NULL WHERE divine_id=$1', [id]);
  await pool.query('DELETE FROM divine_items WHERE id=$1', [id]);
  await bumpContent(); await audit(c, 'divine.delete', 'divine', id, d, null);
  return { ok: true };
});

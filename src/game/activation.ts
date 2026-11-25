import { z } from '../lib/route.js'; import { fail, log } from '../lib/db.js'; import { resourceExists } from './startKit.js'; import { resName } from './deposits.js';
/**
 * Conditions d'activation d'un bâtiment (buildings.activation, migration 28) : des GROUPES alternatifs ; un groupe est rempli
 * quand toutes ses conditions renseignées le sont : objets dans le sac, objets divins détenus (d'une famille ou de toutes),
 * sort connu, ressources, or, rang minimum (palier) ou l'un des rangs listés. `consume` : objets, ressources et or retirés,
 * objets divins rendus (sans détenteur), comme au franchissement historique d'une porte.
 */
export const Group = z.object({
  items: z.array(z.object({ itemId: z.number().int(), qty: z.number().int().min(1).max(999).default(1) })).max(10).default([]),
  divine: z.object({ family: z.string().max(30).nullable().default(null), count: z.number().int().min(1).max(50) }).nullable().default(null),
  spellId: z.number().int().nullable().default(null),
  resources: z.record(z.number().int().min(1).max(1e6)).default({}),
  gold: z.number().int().min(0).max(1e9).default(0),
  minRank: z.number().int().min(0).max(50).default(0),
  ranks: z.array(z.number().int()).max(30).default([]),
  consume: z.boolean().default(false)
});
export const Activation = z.object({ groups: z.array(Group).max(10).default([]) }).strict();
export type GroupT = z.infer<typeof Group>;
export const hasActivation = (b: any) => (b?.activation?.groups ?? []).length > 0;
/** Références d'une configuration (admin) : objets, sorts, rangs, familles, ressources existants (404 sinon). */
export async function checkActivation(db: any, a: z.infer<typeof Activation>) {
  for (const g of a.groups) {
    for (const it of g.items) if (!(await db.query('SELECT 1 FROM items WHERE id=$1', [it.itemId])).rowCount) fail(404, `Objet inconnu : ${it.itemId}`);
    if (g.spellId != null && !(await db.query('SELECT 1 FROM spells WHERE id=$1', [g.spellId])).rowCount) fail(404, `Sort inconnu : ${g.spellId}`);
    for (const r of g.ranks) if (!(await db.query('SELECT 1 FROM specializations WHERE id=$1', [r])).rowCount) fail(404, `Rang inconnu : ${r}`);
    if (g.divine?.family && !(await db.query('SELECT 1 FROM divine_families WHERE key=$1', [g.divine.family])).rowCount) fail(404, `Famille divine inconnue : ${g.divine.family}`);
    for (const k of Object.keys(g.resources)) if (!resourceExists(k)) fail(404, `Ressource inconnue : ${k}`);
  }
}
/** Ce qui manque au personnage pour un groupe (vide = rempli). */
export async function groupMissing(db: any, ch: any, g: GroupT, equipped = false) {
  const out: string[] = [];
  for (const it of g.items) {
    const { rows: [r] } = await db.query('SELECT (SELECT COALESCE(sum(qty),0)::int FROM character_items WHERE character_id=$1 AND item_id=$2 AND NOT in_chest AND ($3 OR equipped_slot IS NULL)) n, (SELECT name FROM items WHERE id=$2) name', [ch.id, it.itemId, equipped]);
    if (r.n < it.qty) out.push(`${r.name ?? `objet n°${it.itemId}`} ×${it.qty - r.n}`);
  }
  if (g.divine) {
    const { rows: [r] } = await db.query('SELECT count(*)::int n FROM divine_items WHERE holder_character_id=$1 AND ($2::text IS NULL OR kind=$2)', [ch.id, g.divine.family]);
    if (r.n < g.divine.count) out.push(`${g.divine.count} objet(s) divin(s)${g.divine.family ? ` (${g.divine.family})` : ''}`);
  }
  if (g.spellId != null && !(await db.query('SELECT 1 FROM character_spells WHERE character_id=$1 AND spell_id=$2', [ch.id, g.spellId])).rowCount) {
    const { rows: [s] } = await db.query('SELECT name FROM spells WHERE id=$1', [g.spellId]); out.push(`sort « ${s?.name ?? g.spellId} »`);
  }
  for (const [k, q] of Object.entries(g.resources)) if ((ch.resources?.[k] ?? 0) < q) out.push(`${resName(k)} ×${q - (ch.resources?.[k] ?? 0)}`);
  if (g.gold && (ch.gold ?? 0) < g.gold) out.push(`${g.gold} or`);
  if (g.minRank || g.ranks.length) {
    const { rows: [s] } = await db.query('SELECT current_rank FROM specializations WHERE id=$1', [ch.specialization_id]);
    if (g.minRank && (s?.current_rank ?? 0) < g.minRank) out.push(`rang ${g.minRank} minimum`);
    if (g.ranks.length && !g.ranks.includes(ch.specialization_id)) {
      const { rows } = await db.query('SELECT name FROM specializations WHERE id=ANY($1)', [g.ranks]); out.push(`rang ${rows.map((r: any) => r.name).join(' ou ')}`);
    }
  }
  return out;
}
/** Conditions en clair (« Hache ×1, sort « Sève » ou 10 or ») : ce qui manquerait à un personnage démuni. */
export async function describeActivation(db: any, a: any) {
  const none = { id: -1, resources: {}, gold: 0, specialization_id: null }, out: string[] = [];
  for (const g of a?.groups ?? []) out.push((await groupMissing(db, none, Group.parse(g))).join(', ') || 'sans condition');
  return out.join(' — ou — ');
}
/**
 * Active : premier groupe rempli (consommé s'il le prévoit) ; sinon 403 avec ce qui manque pour chaque groupe.
 * `o.equipped` : les objets équipés comptent (et peuvent être consommés) — récolte avec un outil en main.
 */
export async function activate(db: any, ch: any, bd: any, o: { equipped?: boolean; verb?: string; err?: string } = {}) {
  const eq = !!o.equipped;
  const groups = (bd.activation?.groups ?? []).map((g: any) => Group.parse(g)) as GroupT[];
  const why: string[] = [];
  for (const [i, g] of groups.entries()) {
    const miss = await groupMissing(db, ch, g, eq);
    if (miss.length) { why.push(`${groups.length > 1 ? `option ${i + 1} : ` : ''}${miss.join(', ')}`); continue; }
    if (g.consume) {
      for (const it of g.items) {
        let left = it.qty;
        const { rows } = await db.query('SELECT ctid::text, qty FROM character_items WHERE character_id=$1 AND item_id=$2 AND NOT in_chest AND ($3 OR equipped_slot IS NULL) ORDER BY equipped_slot NULLS FIRST', [ch.id, it.itemId, eq]);
        for (const r of rows) { if (!left) break; const take = Math.min(left, r.qty); left -= take;
          if (take === r.qty) await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [r.ctid]); else await db.query('UPDATE character_items SET qty=qty-$2 WHERE ctid=$1::tid', [r.ctid, take]); }
      }
      if (g.divine) await db.query('UPDATE divine_items SET holder_character_id=NULL WHERE id IN (SELECT id FROM divine_items WHERE holder_character_id=$1 AND ($2::text IS NULL OR kind=$2) LIMIT $3)', [ch.id, g.divine.family, g.divine.count]);
      for (const [k, q] of Object.entries(g.resources))
        await db.query('UPDATE characters SET resources=jsonb_set(resources, ARRAY[$2::text], to_jsonb(COALESCE((resources->>$2)::int,0) - $3)) WHERE id=$1', [ch.id, k, q]);
      if (g.gold) await db.query('UPDATE characters SET gold=gold-$2 WHERE id=$1', [ch.id, g.gold]);
    }
    await log(db, ch.id, `${o.verb ?? 'Active'} ${bd.name}${groups.length > 1 ? ` (option ${i + 1})` : ''}`);
    return i;
  }
  return fail(403, `${o.err ?? "Conditions d'activation non remplies"} — ${why.join(' ; ')}`);
}

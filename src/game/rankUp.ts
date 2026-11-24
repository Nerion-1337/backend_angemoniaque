import { z } from '../lib/route.js'; import { fail, log } from '../lib/db.js';
import { applySpec } from './divine.js'; import { resourceExists } from './startKit.js';
/**
 * Passage de rang par conditions (specializations.requirements, migration 21) : objets (dans le SAC) et ressources,
 * coût en énergie, XP prérequis (`prereq_xp`), quota de population ; passage définitif ou temporaire (durée), avec
 * consommation des objets/ressources ou simple vérification. Rang temporaire : caractéristiques d'avant mémorisées
 * dans characters.temp_rank et rétablies par le tick à l'échéance.
 */
export const Requirements = z.object({
  items: z.array(z.object({ itemId: z.number().int(), qty: z.number().int().min(1).max(9999).default(1) })).max(20).default([]),
  resources: z.record(z.number().int().min(1).max(1e6)).default({}),
  energyCost: z.number().int().min(0).max(1000).default(0),
  mode: z.enum(['permanent', 'temporary']).default('permanent'),
  durationH: z.number().int().min(1).max(8760).default(24),
  consume: z.boolean().default(true)
});
export type ReqT = z.infer<typeof Requirements>;
export const SNAP = ['specialization_id', 'hp_max', 'recovery', 'see', 'strength', 'agility', 'energy_max', 'divine_energy_max'] as const;
export const hasReq = (r: any) => !!r && Object.keys(r).length > 0;
/** Ce qui manque (pure) : objets (sac), ressources, énergie, XP. */
export function missingFor(req: ReqT, ch: any, bag: Record<number, number>, prereqXp: number | null) {
  const out: string[] = [];
  for (const it of req.items) if ((bag[it.itemId] ?? 0) < it.qty) out.push(`objet n°${it.itemId} ×${it.qty - (bag[it.itemId] ?? 0)}`);
  for (const [k, q] of Object.entries(req.resources)) if ((ch.resources?.[k] ?? 0) < q) out.push(`${k} ×${q - (ch.resources?.[k] ?? 0)}`);
  if (req.energyCost > (ch.energy_current ?? 0)) out.push(`énergie ${req.energyCost}`);
  if (prereqXp != null && (ch.xp ?? 0) < prereqXp) out.push(`${prereqXp} XP`);
  return out;
}
export async function checkReq(db: any, r: ReqT) {
  const ids = [...new Set(r.items.map(i => i.itemId))];
  if (ids.length) { const { rows } = await db.query('SELECT id FROM items WHERE id=ANY($1)', [ids]); const bad = ids.filter(i => !rows.some((x: any) => x.id === i)); if (bad.length) fail(404, `Objet(s) inconnu(s) : ${bad.join(', ')}`); }
  const badRes = Object.keys(r.resources).filter(k => !resourceExists(k)); if (badRes.length) fail(404, `Ressource(s) inconnue(s) : ${badRes.join(', ')}`);
}
const bagOf = async (db: any, cid: number) => Object.fromEntries((await db.query('SELECT item_id, sum(qty)::int n FROM character_items WHERE character_id=$1 AND NOT in_chest AND equipped_slot IS NULL GROUP BY item_id', [cid])).rows.map((r: any) => [r.item_id, r.n]));
/** Rang suivant de la race et ses conditions, avec ce qui manque. */
export async function nextRank(db: any, ch: any) {
  const { rows: [next] } = await db.query('SELECT s.* FROM specializations s WHERE s.race=$1 AND s.current_rank=(SELECT current_rank+1 FROM specializations WHERE id=$2)', [ch.race, ch.specialization_id]);
  if (!next) return null;
  const req = hasReq(next.requirements) ? Requirements.parse(next.requirements) : null;
  return { next, req, missing: req ? missingFor(req, ch, await bagOf(db, ch.id), next.prereq_xp) : null };
}
/** Retire `qty` exemplaires d'un objet du sac (lignes empilées). */
async function takeItems(db: any, cid: number, itemId: number, qty: number) {
  let left = qty;
  const { rows } = await db.query('SELECT ctid::text, qty FROM character_items WHERE character_id=$1 AND item_id=$2 AND NOT in_chest AND equipped_slot IS NULL', [cid, itemId]);
  for (const r of rows) { if (!left) break; const take = Math.min(left, r.qty); left -= take;
    if (take === r.qty) await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [r.ctid]); else await db.query('UPDATE character_items SET qty=qty-$2 WHERE ctid=$1::tid', [r.ctid, take]); }
}
export async function rankUp(db: any, ch: any) {
  if (ch.temp_rank) fail(409, 'Un rang temporaire est déjà en cours');
  const n = await nextRank(db, ch);
  if (!n) fail(409, 'Rang maximal');
  if (!n!.req) fail(409, 'Aucune condition de passage définie pour ce rang');
  const { next, req, missing } = n!;
  if (missing!.length) fail(409, `Conditions manquantes : ${missing!.join(', ')}`);
  const { rows: [q] } = await db.query('SELECT (SELECT count(*)::int FROM characters) total, (SELECT count(*)::int FROM characters WHERE specialization_id=$1) cur', [next.id]);
  if (q.cur + 1 > Math.ceil(next.max_population_percent / 100 * q.total)) fail(409, 'Quota de population atteint');
  if (req!.energyCost) await db.query('UPDATE characters SET energy_current=energy_current-$2 WHERE id=$1', [ch.id, req!.energyCost]);
  if (req!.consume) {
    for (const it of req!.items) await takeItems(db, ch.id, it.itemId, it.qty);
    for (const [k, v] of Object.entries(req!.resources))
      await db.query('UPDATE characters SET resources=jsonb_set(resources, ARRAY[$2::text], to_jsonb(COALESCE((resources->>$2)::int,0) - $3)) WHERE id=$1', [ch.id, k, v]);
  }
  if (req!.mode === 'temporary') {
    const { rows: [snap] } = await db.query(`SELECT ${SNAP.join(',')} FROM characters WHERE id=$1`, [ch.id]);
    await db.query("UPDATE characters SET temp_rank=jsonb_build_object('until', now()+make_interval(hours=>$2), 'stats', $3::jsonb) WHERE id=$1", [ch.id, req!.durationH, JSON.stringify(snap)]);
  }
  await applySpec(db, ch.id, next.id);
  await log(db, ch.id, `Devient ${next.name}${req!.mode === 'temporary' ? ` pour ${req!.durationH} h` : ''}`);
  return { ok: true, rank: next.name, temporary: req!.mode === 'temporary', hours: req!.mode === 'temporary' ? req!.durationH : null };
}
/** Tick : rétablit le rang et les caractéristiques d'avant pour les rangs temporaires échus (réserves ramenées au max). */
/** Valeur numérique sûre à injecter dans le SQL (sinon la colonne elle-même). */
const num = (v: any, col: string) => (Number.isFinite(Number(v)) && v !== null ? String(Math.trunc(Number(v))) : col);
export async function revertTempRanks(db: any) {
  const { rows } = await db.query("SELECT id, temp_rank FROM characters WHERE temp_rank IS NOT NULL AND (temp_rank->>'until')::timestamptz <= now()");
  for (const r of rows) {
    const s = r.temp_rank.stats ?? {};
    const cols = SNAP.filter(k => s[k] !== undefined && s[k] !== null);
    await db.query(`UPDATE characters SET ${cols.map((k, i) => `${k}=$${i + 2}`).join(',')}${cols.length ? ',' : ''} temp_rank=NULL,
      hp_current=LEAST(hp_current, ${num(s.hp_max, 'hp_max')}), energy_current=LEAST(energy_current, ${num(s.energy_max, 'energy_max')}),
      divine_energy_current=LEAST(divine_energy_current, ${num(s.divine_energy_max, 'divine_energy_max')}) WHERE id=$1`, [r.id, ...cols.map(k => s[k])]);
    await log(db, r.id, 'Fin du rang temporaire');
  }
  return rows.length;
}

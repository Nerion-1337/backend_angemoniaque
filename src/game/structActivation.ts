import { z } from '../lib/route.js'; import { fail } from '../lib/db.js';
/**
 * Éléments d'activation d'une structure (migration 49, `buildings.activations`) : des ALTERNATIVES, chacune active la structure
 * pour sa propre durée (`hours`, NULL = définitivement) :
 * - item : `qty` exemplaires de l'objet `ref` ; consommés (dans le sac) ou seulement possédés (sac + équipés) ;
 * - divine : `qty` objets divins de la famille `ref` ; rendus (consommés) ou seulement détenus ;
 * - spell : sort `ref` connu (jamais consommé) ;
 * - gold : `qty` or, toujours payé ;
 * - xp : consommée → `qty` XP LIBRE retirée ; possédée → XP TOTALE accumulée (dépensée comprise) ≥ `qty`.
 * Un élément consommé peut être payé `times` fois : durée × times (un élément possédé, un sort ou une durée définitive : 1 fois).
 */
export const ActElem = z.object({
  kind: z.enum(['item', 'divine', 'spell', 'gold', 'xp']),
  ref: z.union([z.number().int(), z.string().min(1).max(40)]).nullable().default(null),
  qty: z.number().int().min(1).max(1e9).default(1),
  hours: z.number().min(0.1).max(87600).nullable().default(null),
  consume: z.boolean().default(true),
}).superRefine((e, ctx) => { if (['item', 'divine', 'spell'].includes(e.kind) && e.ref == null) ctx.addIssue({ code: 'custom', message: `Élément ${e.kind} : référence manquante` }); });
export const Activations = z.array(ActElem).max(20);
export type ActElemT = z.infer<typeof ActElem>;
export const consumed = (e: ActElemT) => e.kind === 'gold' || ((e.kind === 'item' || e.kind === 'divine' || e.kind === 'xp') && e.consume);
/** Nombre de fois autorisé (pur) : 1 sauf élément consommé à durée limitée. */
export const maxTimes = (e: ActElemT) => (consumed(e) && e.hours != null ? 100 : 1);
/** Fin d'activation (pur) : définitif → null ; sinon max(maintenant, fin actuelle) + hours × times. */
export const openUntil = (e: ActElemT, times: number, current: Date | null, now = Date.now()) =>
  e.hours == null ? null : new Date(Math.max(now, current?.getTime() ?? 0) + e.hours * times * 3600e3);

export async function checkActivations(db: any, list: ActElemT[]) {
  for (const e of list) {
    if (e.kind === 'item' && !(await db.query('SELECT 1 FROM items WHERE id=$1', [Number(e.ref)])).rowCount) fail(404, `Objet inconnu : ${e.ref}`);
    if (e.kind === 'spell' && !(await db.query('SELECT 1 FROM spells WHERE id=$1', [Number(e.ref)])).rowCount) fail(404, `Sort inconnu : ${e.ref}`);
    if (e.kind === 'divine' && !(await db.query('SELECT 1 FROM divine_families WHERE key=$1', [String(e.ref)])).rowCount) fail(404, `Famille divine inconnue : ${e.ref}`);
  }
}
/** Libellé lisible (« 2 × Hache (consommés) · 24 h »). */
export async function describe(db: any, e: ActElemT) {
  const name = e.kind === 'item' ? (await db.query('SELECT name FROM items WHERE id=$1', [Number(e.ref)])).rows[0]?.name ?? `objet n°${e.ref}`
    : e.kind === 'spell' ? (await db.query('SELECT name FROM spells WHERE id=$1', [Number(e.ref)])).rows[0]?.name ?? `sort n°${e.ref}` : null;
  const what = e.kind === 'item' ? `${e.qty} × ${name} (${e.consume ? 'consommés' : 'possédés'})`
    : e.kind === 'divine' ? `${e.qty} × ${e.ref} (${e.consume ? 'rendus' : 'détenus'})`
      : e.kind === 'spell' ? `sort « ${name} » connu`
        : e.kind === 'gold' ? `${e.qty} or` : `${e.qty} XP ${e.consume ? 'libre (dépensée)' : 'totale accumulée'}`;
  return `${what} · ${e.hours == null ? 'définitivement' : `${e.hours} h`}`;
}
/** Ce qui manque au personnage pour payer l'élément `times` fois (null = rien). */
export async function missing(db: any, ch: any, e: ActElemT, times = 1) {
  const n = e.qty * times;
  if (e.kind === 'item') {
    const { rows: [r] } = await db.query(`SELECT COALESCE(sum(qty),0)::int n FROM character_items WHERE character_id=$1 AND item_id=$2 AND NOT in_chest AND ($3 OR equipped_slot IS NULL)`, [ch.id, Number(e.ref), !e.consume]);
    return r.n < n ? `${n - r.n} objet(s) manquant(s)` : null;
  }
  if (e.kind === 'divine') { const { rows: [r] } = await db.query('SELECT count(*)::int n FROM divine_items WHERE holder_character_id=$1 AND kind=$2', [ch.id, String(e.ref)]); return r.n < n ? `${n - r.n} ${e.ref}(s) manquant(s)` : null; }
  if (e.kind === 'spell') return (await db.query('SELECT 1 FROM character_spells WHERE character_id=$1 AND spell_id=$2', [ch.id, Number(e.ref)])).rowCount ? null : 'sort non appris';
  const { rows: [c] } = await db.query('SELECT gold, xp, xp_total FROM characters WHERE id=$1', [ch.id]);
  if (e.kind === 'gold') return Number(c.gold) < n ? `${n - Number(c.gold)} or manquant(s)` : null;
  const have = e.consume ? Number(c.xp) : Number(c.xp_total ?? c.xp);
  return have < n ? `${n - have} XP ${e.consume ? 'libre' : 'totale'} manquante(s)` : null;
}
/** Paie l'élément (vérifié par `missing` avant). */
export async function pay(db: any, ch: any, e: ActElemT, times = 1) {
  if (!consumed(e)) return;
  const n = e.qty * times;
  if (e.kind === 'gold') await db.query('UPDATE characters SET gold=gold-$2 WHERE id=$1', [ch.id, n]);
  else if (e.kind === 'xp') await db.query('UPDATE characters SET xp=xp-$2 WHERE id=$1', [ch.id, n]);
  else if (e.kind === 'divine') await db.query('UPDATE divine_items SET holder_character_id=NULL WHERE id IN (SELECT id FROM divine_items WHERE holder_character_id=$1 AND kind=$2 LIMIT $3)', [ch.id, String(e.ref), n]);
  else {
    let left = n; const { rows } = await db.query('SELECT ctid::text, qty FROM character_items WHERE character_id=$1 AND item_id=$2 AND NOT in_chest AND equipped_slot IS NULL', [ch.id, Number(e.ref)]);
    for (const r of rows) { if (!left) break; const take = Math.min(left, r.qty); left -= take;
      if (take === r.qty) await db.query('DELETE FROM character_items WHERE ctid=$1::tid', [r.ctid]); else await db.query('UPDATE character_items SET qty=qty-$2 WHERE ctid=$1::tid', [r.ctid, take]); }
  }
}
/** Active la structure avec l'élément n° `index` payé `times` fois ; renvoie la nouvelle fin (null = définitivement). */
export async function activateWith(db: any, ch: any, bd: any, index: number, times = 1) {
  const list = Activations.parse(bd.activations ?? []), e = list[index]; if (!e) fail(404, 'Élément d\'activation inconnu');
  if (!Number.isInteger(times) || times < 1 || times > maxTimes(e!)) fail(400, maxTimes(e!) === 1 ? 'Cet élément ne se paie qu\'une fois' : `Entre 1 et ${maxTimes(e!)} fois`);
  const m = await missing(db, ch, e!, times); if (m) fail(403, `Activation impossible : ${m}`);
  await pay(db, ch, e!, times);
  const { rows: [b] } = await db.query("SELECT open_until='infinity' forever, CASE WHEN open_until='infinity' THEN NULL ELSE open_until END open_until FROM buildings WHERE id=$1 FOR UPDATE", [bd.id]);
  if (b.forever) return { until: null, forever: true };
  const until = openUntil(e!, times, b.open_until && new Date(b.open_until) > new Date() ? new Date(b.open_until) : null);
  await db.query('UPDATE buildings SET open_until=$2 WHERE id=$1', [bd.id, until ?? 'infinity']);
  return { until, forever: until == null };
}

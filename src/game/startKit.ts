import { z } from '../lib/route.js'; import { fail } from '../lib/db.js'; import { RES_BY_ID } from './resources.js'; import { RES2_BY_ID } from './resources2.js'; import { RES3_BY_ID } from './resources3.js';
/**
 * Équipement de départ d'une race (races.start_kit, migration 18) : rang, or, XP, ressources, objets (sac / coffre),
 * et sorts reçus par un NOUVEAU personnage. Un kit vide = premier palier, 0 or, rien d'autre.
 */
export const Kit = z.object({
  rank: z.number().int().positive().nullable().optional(),
  gold: z.number().int().min(0).max(1e9).optional(),
  xp: z.number().int().min(0).max(1e9).optional(),
  resources: z.record(z.number().int().min(1).max(1e6)).optional(),
  items: z.array(z.object({ itemId: z.number().int(), qty: z.number().int().min(1).max(9999).default(1), place: z.enum(['bag', 'chest']).default('bag') })).max(60).optional(),
  spells: z.array(z.number().int()).max(60).optional()
});
export type KitT = z.infer<typeof Kit>;
export const resourceExists = (id: string) => !!((RES_BY_ID as any)[id] ?? (RES2_BY_ID as any)[id] ?? (RES3_BY_ID as any)[id]);
/** Vérifie que chaque référence du kit existe (rang de CETTE race, objets, sorts, ressources du catalogue). */
export async function checkKit(db: any, race: string, k: KitT) {
  if (k.rank != null && !(await db.query('SELECT 1 FROM specializations WHERE race=$1 AND current_rank=$2', [race, k.rank])).rowCount) fail(400, `Palier ${k.rank} inconnu pour cette race`);
  const missing = async (table: string, ids: number[], label: string) => {
    const uniq = [...new Set(ids)]; if (!uniq.length) return;
    const { rows } = await db.query(`SELECT id FROM ${table} WHERE id=ANY($1)`, [uniq]);
    const bad = uniq.filter(i => !rows.some((r: any) => r.id === i)); if (bad.length) fail(404, `${label} inconnu(s) : ${bad.join(', ')}`);
  };
  await missing('items', (k.items ?? []).map(i => i.itemId), 'Objet');
  await missing('spells', k.spells ?? [], 'Sort');
  const badRes = Object.keys(k.resources ?? {}).filter(id => !resourceExists(id)); if (badRes.length) fail(404, `Ressource(s) inconnue(s) : ${badRes.join(', ')}`);
}
/** Rang de départ : palier du kit, sinon le premier palier de la race. */
export async function startRank(db: any, race: string, k: KitT) {
  const { rows: [s] } = k.rank != null
    ? await db.query('SELECT * FROM specializations WHERE race=$1 AND current_rank=$2', [race, k.rank])
    : await db.query('SELECT * FROM specializations WHERE race=$1 ORDER BY current_rank LIMIT 1', [race]);
  if (!s) fail(409, 'Cette race n’a pas encore de rang');
  return s;
}
/** Donne au personnage tout le contenu du kit (après l'INSERT du personnage). Les références disparues depuis sont ignorées. */
export async function grantKit(db: any, charId: number, k: KitT) {
  if (k.resources && Object.keys(k.resources).length) await db.query('UPDATE characters SET resources=$2 WHERE id=$1', [charId, JSON.stringify(k.resources)]);
  for (const it of k.items ?? [])
    await db.query('INSERT INTO character_items(character_id,item_id,qty,in_chest) SELECT $1,id,$3,$4 FROM items WHERE id=$2', [charId, it.itemId, it.qty ?? 1, it.place === 'chest']);
  for (const sp of k.spells ?? []) await db.query('INSERT INTO character_spells(character_id,spell_id) SELECT $1,id FROM spells WHERE id=$2', [charId, sp]);
}

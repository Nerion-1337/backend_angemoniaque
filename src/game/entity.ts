import { fail } from '../lib/db.js';
/**
 * Règles transverses (tables entity_costs / entity_caps, Étape 2) :
 *  - checkEntityCost : coût d'une entité (ressources / or) ; « or » crédite characters.gold,
 *    les autres clés characters.resources (JSONB). Vérifie la solvabilité, débite si apply=true.
 *  - assertCap : plafonds global / per_player / per_zone ; échoue 409 si le cap est atteint.
 * Le comptage d'instances est spécialisé par kind (monstre : positions+prototypes ; les autres
 * kinds attendent leur phase) — un cap sans compteur est simplement ignoré.
 */
export async function checkEntityCost(db: any, actorId: number, kind: string, refId: number, apply = false): Promise<Record<string, number>> {
  const { rows } = await db.query('SELECT resource, qty FROM entity_costs WHERE kind=$1 AND ref_id=$2', [kind, refId]);
  const cost: Record<string, number> = {};
  for (const r of rows) cost[r.resource] = (cost[r.resource] ?? 0) + Number(r.qty);
  if (!Object.keys(cost).length) return cost;
  const { rows: [ch] } = await db.query('SELECT gold, resources FROM characters WHERE id=$1', [actorId]);
  const res: Record<string, number> = ch.resources ?? {};
  const lack: string[] = [];
  if ((cost.or ?? 0) > ch.gold) lack.push(`or (${cost.or})`);
  for (const [k, v] of Object.entries(cost)) if (k !== 'or' && (res[k] ?? 0) < v) lack.push(`${k} (${v})`);
  if (lack.length) fail(409, `Coût insuffisant : ${lack.join(', ')}`);
  if (apply) {
    const next = { ...res };
    for (const [k, v] of Object.entries(cost)) if (k !== 'or') next[k] = (next[k] ?? 0) - v;
    await db.query('UPDATE characters SET gold=gold-$2, resources=$3 WHERE id=$1', [actorId, cost.or ?? 0, JSON.stringify(next)]);
  }
  return cost;
}

const monsterOnMap = (db: any, refId: number, mapId?: number) =>
  mapId == null
    ? db.query('SELECT count(*)::int n FROM monsters m JOIN positions p ON p.monsters_id=m.id WHERE m.id=$1 OR m.data->>\'prototype\'=$1::text', [refId])
    : db.query('SELECT count(*)::int n FROM monsters m JOIN positions p ON p.monsters_id=m.id WHERE p.map_id=$2 AND (m.id=$1 OR m.data->>\'prototype\'=$1::text)', [refId, mapId]);

export async function assertCap(db: any, kind: string, refId: number, actorId?: number, mapId?: number) {
  const { rows } = await db.query('SELECT scope, value FROM entity_caps WHERE kind=$1 AND ref_id=$2', [kind, refId]);
  for (const c of rows) {
    let n = 0;
    if (kind === 'monster') {
      if (c.scope === 'global') n = (await monsterOnMap(db, refId)).rows[0].n;
      else if (c.scope === 'per_zone') n = mapId == null ? 0 : (await monsterOnMap(db, refId, mapId)).rows[0].n;
      else if (c.scope === 'per_player') n = actorId == null ? 0 : (await db.query('SELECT count(*)::int n FROM character_monster WHERE monster_id=$1 AND character_id=$2', [refId, actorId])).rows[0].n;
      else continue;
    } else continue; // les autres kinds seront connectés dans leur phase
    if (n >= c.value) fail(409, `Plafond ${c.scope} atteint (${n}/${c.value})`);
  }
}

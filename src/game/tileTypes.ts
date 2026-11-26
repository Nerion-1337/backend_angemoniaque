import { pool } from '../lib/db.js'; import { KIND_COST, KIND_LABEL, terrain } from './terrain.js';
/**
 * Types de case éditables (table tile_types, section admin « Cases ») : nom, description,
 * coût d'énergie par monde et sort passif appliqué en continu (tick horaire).
 * Cache mémoire rafraîchi toutes les 30 s (et immédiatement après une écriture admin sur
 * cette instance) ; sans ligne en base, on retombe sur les constantes du code (KIND_COST).
 */
export const TILE_KINDS = Object.keys(KIND_COST);
export type TileType = { map_id: number; kind: string; name: string; description: string; energy_cost: number; divine_energy_cost?: number; spell_id: number | null; spell_mode: 'bonus' | 'malus' | null; spell_name?: string | null; spell_damage?: number | null };
const TTL = 30_000;
let cache: Map<string, TileType> | null = null, at = 0, warned = false;
const key = (mapId: number, kind: string) => `${mapId}:${kind}`;
/** Charge (ou relit) les types de case. Une base sans la table (migration 15 absente) donne un cache vide. */
export async function loadTiles(force = false): Promise<Map<string, TileType>> {
  if (!force && cache && Date.now() - at < TTL) return cache;
  try {
    const { rows } = await pool.query(`SELECT t.*, s.name spell_name, s.damage spell_damage FROM tile_types t LEFT JOIN spells s ON s.id=t.spell_id`);
    cache = new Map(rows.map((r: TileType) => [key(r.map_id, r.kind), r]));
  } catch (e: any) {
    if (!warned) { console.warn('tile_types indisponible, coûts par défaut :', e.message); warned = true; }
    cache = cache ?? new Map();
  }
  at = Date.now(); return cache;
}
export const invalidateTiles = () => { cache = null; };
/** Remplace le cache (tests unitaires). */
export const setTilesForTest = (rows: TileType[]) => { cache = new Map(rows.map(r => [key(r.map_id, r.kind), r])); at = Date.now(); };
export const tileOf = (mapId: number | undefined, kind: string) => (mapId == null ? undefined : cache?.get(key(mapId, kind)));
/** Coût d'un pas sur la case : valeur admin du monde, sinon la constante du code. */
export const tileCost = (mapId: number | undefined, kind: string, def: number) => tileOf(mapId, kind)?.energy_cost ?? def;
/** Variation de PV par heure d'un sort passif de case : bonus = +|dégâts|, malus = -|dégâts|. */
export const tileHpDelta = (mode: string | null | undefined, damage: number | null | undefined) =>
  !damage ? 0 : mode === 'bonus' ? Math.abs(damage) : mode === 'malus' ? -Math.abs(damage) : 0;
/** Vue publique d'un type de case (carte de case du jeu). */
export const tilePublic = (mapId: number, kind: string) => {
  const t = tileOf(mapId, kind);
  return { kind, name: t?.name ?? KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind, description: t?.description ?? '', cost: t?.energy_cost ?? KIND_COST[kind as keyof typeof KIND_COST], divineCost: t?.divine_energy_cost ?? 0,
    spell: t?.spell_id && t.spell_mode ? { name: t.spell_name ?? null, mode: t.spell_mode, hpPerHour: tileHpDelta(t.spell_mode, t.spell_damage) } : null };
};
/** Tick horaire : applique le sort passif de chaque type de case aux personnages qui s'y tiennent (PV bornés à [1, hp_max]). */
export async function applyTileSpells() {
  const active = [...(await loadTiles(true)).values()].filter(t => t.spell_id && t.spell_mode && tileHpDelta(t.spell_mode, t.spell_damage));
  if (!active.length) return 0;
  const maps = [...new Set(active.map(t => t.map_id))];
  const { rows } = await pool.query('SELECT c.id, p.map_id, p.coord_x x, p.coord_y y FROM characters c JOIN positions p ON p.character_id=c.id WHERE NOT c.blocked AND p.map_id=ANY($1)', [maps]);
  const byDelta = new Map<number, number[]>();
  for (const r of rows) {
    const t = tileOf(r.map_id, terrain(r.x, r.y, r.map_id).kind), dlt = t ? tileHpDelta(t.spell_mode, t.spell_damage) : 0;
    if (dlt) byDelta.set(dlt, [...(byDelta.get(dlt) ?? []), r.id]);
  }
  for (const [dlt, ids] of byDelta) await pool.query('UPDATE characters SET hp_current=LEAST(hp_max, GREATEST(1, hp_current+$2)) WHERE id=ANY($1)', [ids, dlt]);
  return rows.length;
}

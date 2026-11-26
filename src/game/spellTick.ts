import { pool } from '../lib/db.js'; import { Effects, POOLS, applyEffects, pickTargets, isHarmful } from './spellEffects.js'; import { inSafeZone } from './terrain.js'; import { attackAllowed, occupiableAt } from './buildingCell.js'; import { loadTarget } from './combatlib.js';
/**
 * Tick horaire des sorts : (1) dégâts sur la durée (spell_dots) — jamais mortels (PV min 1), lignes expirées supprimées ;
 * (2) sorts PASSIFS liés à un objet équipé ou à la monture active : leurs effets instantanés sur soi (soin, réserves ±)
 * s'appliquent une fois par heure au porteur (les capacités et dégâts d'un sort passif sont ignorés).
 */
export async function hourlySpellEffects() {
  await hourlyBuildingSpells();
  const TBL: Record<string, string> = { character: 'characters', monster: 'monsters', summon: 'summons' };
  const { rows: dots } = await pool.query('SELECT * FROM spell_dots WHERE until > now()');
  for (const d of dots) await pool.query(`UPDATE ${TBL[d.target_kind]} SET hp_current=GREATEST(1, hp_current-$2) WHERE id=$1 AND hp_current > 0`, [d.target_id, d.damage_per_h]);
  await pool.query('DELETE FROM spell_dots WHERE until <= now()');
  const { rows: passives } = await pool.query(`
    SELECT ci.character_id, s.id spell_id, s.effects FROM entity_spells es JOIN character_items ci ON ci.item_id=es.ref_id JOIN spells s ON s.id=es.spell_id
      WHERE es.kind='item' AND es.mode='passive' AND ci.equipped_slot IS NOT NULL`);
  for (const p of passives) {
    const e = Effects.safeParse(p.effects ?? {}); if (!e.success) continue;
    const self = { ...e.data, damage: 0, dot: null, durationH: 0, stats: e.data.stats.filter(s => POOLS[s.stat]) };
    if (!self.heal && !self.stats.length) continue;
    const { rows: [pos] } = await pool.query('SELECT * FROM positions WHERE character_id=$1', [p.character_id]);
    const t = pos && await loadTarget(pool, pos); if (!t) continue;
    await applyEffects(pool, { id: p.character_id }, p.spell_id, self, t);
  }
}

/** Sorts PASSIFS des bâtiments : appliqués chaque heure depuis la case de la structure — zone = entités à `radius` (camp relatif à
 *  la race du propriétaire), sinon l'occupant de la case. Effets hostiles : jamais en zone sacrée sur un personnage, ni sur un
 *  occupant protégé contre les sorts. */
export async function hourlyBuildingSpells() {
  const { rows } = await pool.query(`SELECT b.id, b.owner_id, ch.race, p.map_id, p.coord_x x, p.coord_y y, s.id spell_id, s.effects
    FROM entity_spells es JOIN buildings b ON b.id=es.ref_id JOIN positions p ON p.building_id=b.id JOIN spells s ON s.id=es.spell_id
    LEFT JOIN characters ch ON ch.id=b.owner_id WHERE es.kind='building' AND es.mode='passive'`);
  let n = 0;
  for (const r of rows) {
    const parsed = Effects.safeParse(r.effects ?? {}); if (!parsed.success || !Object.keys(r.effects ?? {}).length) continue;
    const e = { ...parsed.data, target: parsed.data.target === 'area' ? 'area' as const : 'single' as const };
    const rad = e.target === 'area' ? e.radius : 0;
    const { rows: ps } = await pool.query('SELECT * FROM positions WHERE map_id=$1 AND coord_x BETWEEN $2 AND $3 AND coord_y BETWEEN $4 AND $5 AND item_id IS NULL AND (character_id IS NOT NULL OR monsters_id IS NOT NULL OR summon_id IS NOT NULL)',
      [r.map_id, r.x - rad, r.x + rad, r.y - rad, r.y + rad]);
    const all = (await Promise.all(ps.map((p: any) => loadTarget(pool, p)))).filter(Boolean) as any[];
    const caster = { id: r.owner_id ?? 0, race: r.race ?? '' };
    for (const t of pickTargets(e, caster, { x: r.x, y: r.y }, all)) {
      if (isHarmful(e) && t.kind === 'character') {
        if (inSafeZone(r.map_id, t.pos.coord_x, t.pos.coord_y)) continue;
        if (!attackAllowed(await occupiableAt(pool, t.pos.map_id, t.pos.coord_x, t.pos.coord_y), 'spell')) continue;
      }
      try { await applyEffects(pool, caster, r.spell_id, e, t); n++; } catch (err: any) { console.error('sort de bâtiment :', err.message); }
    }
  }
  return n;
}

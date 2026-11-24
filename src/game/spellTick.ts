import { pool } from '../lib/db.js'; import { Effects, POOLS, applyEffects } from './spellEffects.js'; import { loadTarget } from './combatlib.js';
/**
 * Tick horaire des sorts : (1) dégâts sur la durée (spell_dots) — jamais mortels (PV min 1), lignes expirées supprimées ;
 * (2) sorts PASSIFS liés à un objet équipé ou à la monture active : leurs effets instantanés sur soi (soin, réserves ±)
 * s'appliquent une fois par heure au porteur (les capacités et dégâts d'un sort passif sont ignorés).
 */
export async function hourlySpellEffects() {
  const TBL: Record<string, string> = { character: 'characters', monster: 'monsters', summon: 'summons' };
  const { rows: dots } = await pool.query('SELECT * FROM spell_dots WHERE until > now()');
  for (const d of dots) await pool.query(`UPDATE ${TBL[d.target_kind]} SET hp_current=GREATEST(1, hp_current-$2) WHERE id=$1 AND hp_current > 0`, [d.target_id, d.damage_per_h]);
  await pool.query('DELETE FROM spell_dots WHERE until <= now()');
  const { rows: passives } = await pool.query(`
    SELECT ci.character_id, s.id spell_id, s.effects FROM entity_spells es JOIN character_items ci ON ci.item_id=es.ref_id JOIN spells s ON s.id=es.spell_id
      WHERE es.kind='item' AND es.mode='passive' AND ci.equipped_slot IS NOT NULL
    UNION ALL SELECT cm.character_id, s.id, s.effects FROM entity_spells es JOIN character_mounts cm ON cm.mount_id=es.ref_id JOIN spells s ON s.id=es.spell_id
      WHERE es.kind='mount' AND es.mode='passive' AND cm.active`);
  for (const p of passives) {
    const e = Effects.safeParse(p.effects ?? {}); if (!e.success) continue;
    const self = { ...e.data, damage: 0, dot: null, durationH: 0, stats: e.data.stats.filter(s => POOLS[s.stat]) };
    if (!self.heal && !self.stats.length) continue;
    const { rows: [pos] } = await pool.query('SELECT * FROM positions WHERE character_id=$1', [p.character_id]);
    const t = pos && await loadTarget(pool, pos); if (!t) continue;
    await applyEffects(pool, { id: p.character_id }, p.spell_id, self, t);
  }
}

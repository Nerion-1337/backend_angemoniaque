import { pool } from '../db/pool.js'; import { BURN_DAMAGE } from '../game/terrain.js';
const REVERT = ['strength', 'agility', 'hp_max', 'recovery'];
/** Tick horaire : XP/or (+ bonus pactes & fidèles), régénération PV/énergie, expiration des buffs. */
export async function hourlyTick() {
  // Une seule statistique de régénération (recovery) restaure Vie, Énergie ET Énergie divine : héros, montures, invocations, monstres.
  await pool.query(`UPDATE characters c SET xp=c.xp+s.gain_xp_hour+b.bonus, gold=c.gold+s.gain_xp_hour+b.bonus,
    hp_current=LEAST(c.hp_max,c.hp_current+c.recovery), energy_current=LEAST(c.energy_max,c.energy_current+c.recovery), divine_energy_current=LEAST(c.divine_energy_max,c.divine_energy_current+c.recovery)
    FROM specializations s, LATERAL (SELECT (SELECT count(*) FROM pacts p WHERE p.active AND p.ethereal_id=c.id)*5 + (SELECT count(*) FROM faiths f WHERE f.god_id=c.id AND f.status='accepted')*2 AS bonus) b
    WHERE s.id=c.specialization_id AND NOT c.blocked`);
  await pool.query("UPDATE character_mounts cm SET hp_current=LEAST(m.hp_max,cm.hp_current+m.recovery), energy_current=LEAST(m.energy_max,cm.energy_current+m.recovery) FROM mounts m WHERE m.id=cm.mount_id");
  await pool.query('UPDATE summons SET hp_current=LEAST(hp_max,hp_current+recovery), energy_current=LEAST(energy_max,energy_current+recovery)');
  await pool.query('UPDATE monsters SET hp_current=LEAST(hp_max,hp_current+recovery), energy_current=LEAST(energy_max,energy_current+recovery), divine_energy_current=LEAST(divine_energy_max,divine_energy_current+recovery)');
  // Brûlure du volcan : BURN_DAMAGE par heure tant que burn_until est dans le futur (jamais mortelle : PV min. 1)
  await pool.query('UPDATE characters SET hp_current=GREATEST(1,hp_current-$1) WHERE burn_until>now() AND NOT blocked', [BURN_DAMAGE]);
  const { rows } = await pool.query('DELETE FROM temp_buffs WHERE expires_at<=now() RETURNING character_id,stat,delta');
  for (const r of rows) if (REVERT.includes(r.stat)) await pool.query(`UPDATE characters SET ${r.stat}=${r.stat}-$2 WHERE id=$1`, [r.character_id, r.delta]);
}

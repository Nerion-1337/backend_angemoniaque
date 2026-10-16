import { pool } from '../db/pool.js';
const REVERT = ['strength', 'agility', 'hp_max', 'recovery'];
/** Tick horaire : XP/or (+ bonus pactes & fidèles), régénération PV/énergie, expiration des buffs. */
export async function hourlyTick() {
  await pool.query(`UPDATE characters c SET xp=c.xp+s.gain_xp_hour+b.bonus, gold=c.gold+s.gain_xp_hour+b.bonus,
    hp_current=LEAST(c.hp_max,c.hp_current+c.recovery), energy_current=LEAST(c.energy_max,c.energy_current+c.recovery)
    FROM specializations s, LATERAL (SELECT (SELECT count(*) FROM pacts p WHERE p.active AND p.ethereal_id=c.id)*5 + (SELECT count(*) FROM faiths f WHERE f.god_id=c.id AND f.status='accepted')*2 AS bonus) b
    WHERE s.id=c.specialization_id AND NOT c.blocked`);
  await pool.query("UPDATE character_mounts cm SET energy_current=LEAST(m.energy_max,cm.energy_current+5) FROM mounts m WHERE m.id=cm.mount_id");
  const { rows } = await pool.query('DELETE FROM temp_buffs WHERE expires_at<=now() RETURNING character_id,stat,delta');
  for (const r of rows) if (REVERT.includes(r.stat)) await pool.query(`UPDATE characters SET ${r.stat}=${r.stat}-$2 WHERE id=$1`, [r.character_id, r.delta]);
}

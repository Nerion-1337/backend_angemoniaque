import { pool } from '../db/pool.js'; import { BURN_DAMAGE } from '../game/terrain.js'; import { cfgNum } from '../game/content.js'; import { hourlySpawns, reincarnateDue } from '../game/spawn.js';
const REVERT = ['strength', 'agility', 'hp_max', 'recovery'];
/** Tick horaire : XP/or (× multiplicateur global), régénération PV/énergie, production des bâtiments, expiration des buffs. */
export async function hourlyTick() {
  const xpRate = await cfgNum('xp_rate', 1);
  // Une seule statistique de régénération (recovery) restaure Vie, Énergie ET Énergie divine : héros, montures, invocations, monstres.
  // Le bonus pactes/fidèles est une sous-requête corrélée dans le SET (un LATERAL ne peut pas référencer la table cible :
  // la version précédente échouait silencieusement — le tick horaire était en échec permanent).
  const bonus = `(SELECT (SELECT count(*) FROM pacts p WHERE p.active AND p.ethereal_id=c.id)*5 + (SELECT count(*) FROM faiths f WHERE f.god_id=c.id AND f.status='accepted')*2)`;
  await pool.query(`UPDATE characters c SET
    xp=c.xp+ROUND((s.gain_xp_hour+${bonus})*$1),
    gold=c.gold+s.gain_xp_hour+${bonus},
    hp_current=LEAST(c.hp_max,c.hp_current+c.recovery),
    energy_current=LEAST(c.energy_max,c.energy_current+c.recovery),
    divine_energy_current=LEAST(c.divine_energy_max,c.divine_energy_current+c.recovery)
    FROM specializations s WHERE s.id=c.specialization_id AND NOT c.blocked`, [xpRate]);
  await pool.query("UPDATE character_mounts cm SET hp_current=LEAST(m.hp_max,cm.hp_current+m.recovery), energy_current=LEAST(m.energy_max,cm.energy_current+m.recovery) FROM mounts m WHERE m.id=cm.mount_id");
  await pool.query('UPDATE summons SET hp_current=LEAST(hp_max,hp_current+recovery), energy_current=LEAST(energy_max,energy_current+recovery)');
  // Les monstres en attente de réincarnation (mort + délai) ne régénèrent pas avant l'échéance.
  await pool.query('UPDATE monsters m SET hp_current=LEAST(m.hp_max,m.hp_current+m.recovery), energy_current=LEAST(m.energy_max,m.energy_current+m.recovery), divine_energy_current=LEAST(m.divine_energy_max,m.divine_energy_current+m.recovery) WHERE m.id NOT IN (SELECT monster_id FROM monster_respawns)');
  await applyBuildingProduction();
  await hourlySpawns(pool);   // bestiaire (Étape 2) : spawn_rules → instances sur case libre, caps + probabilité + fréquence
  await reincarnateDue(pool); // bestiaire (Étape 2 phase 3) : réincarnation différée des monstres tués avec délai
  // Brûlure du volcan : BURN_DAMAGE par heure tant que burn_until est dans le futur (jamais mortelle : PV min. 1)
  await pool.query('UPDATE characters SET hp_current=GREATEST(1,hp_current-$1) WHERE burn_until>now() AND NOT blocked', [BURN_DAMAGE]);
  const { rows } = await pool.query('DELETE FROM temp_buffs WHERE expires_at<=now() RETURNING character_id,stat,delta');
  for (const r of rows) if (REVERT.includes(r.stat)) await pool.query(`UPDATE characters SET ${r.stat}=${r.stat}-$2 WHERE id=$1`, [r.character_id, r.delta]);
}
/** Gain horaire d'un bâtiment : data JSONB { production: {ressource: rendement/h}, collection: {ressource: rendement/h} }. */
export const buildingGains = (data: any): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const src of [data?.collection, data?.production]) for (const [res, rate] of Object.entries(src ?? {})) out[res] = (out[res] ?? 0) + Number(rate);
  return out;
};
/** Production/collecte horaire des bâtiments vers le stock du propriétaire, plafonnée par data.storage (plafond par ressource). */
export const applyBuildingProduction = async () => {
  const { rows } = await pool.query(
    "SELECT b.owner_id o, b.data FROM buildings b WHERE b.owner_id IS NOT NULL AND (b.data->'production' IS NOT NULL OR b.data->'collection' IS NOT NULL)");
  for (const b of rows) {
    const gains = buildingGains(b.data); if (!Object.keys(gains).length) continue;
    const { rows: [own] } = await pool.query('SELECT resources FROM characters WHERE id=$1', [b.o]);
    const res: Record<string, number> = { ...(own?.resources ?? {}) };
    for (const [k, add] of Object.entries(gains)) {
      const cap = b.data?.storage ? Number(b.data.storage[k]) : null;   // plafond de stock global de la ressource
      res[k] = Math.min(Number(res[k] ?? 0) + add, cap ?? Infinity);
    }
    await pool.query('UPDATE characters SET resources=$2 WHERE id=$1', [b.o, JSON.stringify(res)]);
  }
};

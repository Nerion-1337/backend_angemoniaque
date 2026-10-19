import { OpenAPIHono } from '@hono/zod-openapi'; import { def, router, z, P } from '../lib/route.js'; import { pool, tx, ownChar, posOf, fail } from '../lib/db.js';
import { statUpgradeCost } from '../game/rules.js'; import { applySpec } from '../game/divine.js'; import { spawn } from '../game/spawn.js'; import { activeMount, actor } from '../game/movement.js'; import { gearStats, maxSummons } from '../game/stats.js'; import { canUseDivineEnergy } from '../game/rules.js';
export const characters = router();
def(characters, 'get', '/characters', null, async c => (await pool.query('SELECT c.id,c.pseudo,c.race,p.map_id,p.coord_x x,p.coord_y y FROM characters c LEFT JOIN positions p ON p.character_id=c.id WHERE c.account_id=$1 ORDER BY c.id', [c.get('acc').sub])).rows);
def(characters, 'post', '/characters', z.object({ pseudo: z.string().min(3, '3 caractères minimum').max(20, '20 caractères maximum').regex(/^[\p{L}0-9_-]+$/u, 'lettres, chiffres, _ et - uniquement'), race: z.enum(['human', 'demon', 'angel']) }), (c, b) => tx(async db => {
  const { rows: [s] } = await db.query('SELECT * FROM specializations WHERE race=$1 ORDER BY current_rank LIMIT 1', [b.race]);
  const { rows: [ch] } = await db.query(`INSERT INTO characters(account_id,pseudo,race,specialization_id,hp_current,hp_max,recovery,energy_current,energy_max,divine_energy_current,divine_energy_max,strength,agility,see,gold)
    VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$7,$8,$8,$9,$10,$11,150) RETURNING id`, [c.get('acc').sub, b.pseudo, b.race, s.id, s.hp_max, s.recovery, s.energy_max, s.divine_energy_max, s.strength, s.agility, s.see]);
  await spawn(db, ch.id, b.race);
  // Kit de départ (équipement, sorts, monture) comme dans le dépôt d'origine
  await db.query("INSERT INTO character_items(character_id,item_id) SELECT $1,id FROM items WHERE name=ANY($2)", [ch.id, ['Épée Sanctifiée', 'Écu de la Garde', 'Casque de Fer Forgé', 'Plastron du Lion', 'Bottes de Célérité', 'Anneau de Rubis']]);
    await db.query("INSERT INTO character_mounts(character_id,mount_id,energy_current,hp_current) SELECT $1,id,energy_max,hp_max FROM mounts WHERE name='Destrier Céleste Cuirassé'", [ch.id]); return ch;
}));
def(characters, 'get', '/characters/{id}', null, (c) => tx(async db => {
  const ch = await ownChar(db, c, P(c, 'id')), a = await actor(db, ch), st = await gearStats(db, ch), mount = await activeMount(db, ch.id);
  const { rows: [s] } = await db.query('SELECT name rank_name,current_rank FROM specializations WHERE id=$1', [ch.specialization_id]);
  const { rows: [m] } = await db.query('SELECT width,height FROM maps WHERE id=$1', [a.mp.map_id]); const { rows: [hp] } = await db.query('SELECT * FROM positions WHERE character_id=$1', [ch.id]);
  const summons = (await db.query('SELECT s.*,p.coord_x x,p.coord_y y FROM summons s LEFT JOIN positions p ON p.summon_id=s.id WHERE s.owner_id=$1 ORDER BY s.id', [ch.id])).rows, sm = a.sm;
  const act = sm ? { kind: 'summon', id: sm.id, name: sm.name, hp_current: sm.hp_current, hp_max: sm.hp_max, energy_current: sm.energy_current, energy_max: sm.energy_max, recovery: sm.recovery, see: sm.see, agility: sm.agility, strength: sm.strength, damage: sm.damage, armor: sm.armor, magic_armor: sm.magic_armor ?? 0 }
    : { kind: 'hero', name: ch.pseudo, hp_current: ch.hp_current, hp_max: ch.hp_max, energy_current: ch.energy_current, energy_max: ch.energy_max, recovery: ch.recovery, see: a.see, agility: st.agility, strength: st.strength, damage: st.damage, armor: st.armor, magic_armor: st.magicArmor };
  const scrolls = Object.fromEntries((await db.query("SELECT i.data->>'kind' k, count(*)::int n FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND i.slot='scroll' AND NOT ci.in_chest GROUP BY 1", [ch.id])).rows.map((r: any) => [r.k, r.n]));
  return { ...ch, scrolls, rank: s, pos: { map_id: hp.map_id, x: hp.coord_x, y: hp.coord_y, ...m }, mount: mount ?? null, stats: st, hasDivine: canUseDivineEnergy(ch.race, s.rank_name), summons, maxSummons: await maxSummons(db, ch),
    actor: { ...act, pos: { map_id: a.mp.map_id, x: a.mp.coord_x, y: a.mp.coord_y, ...m } }, see_eff: a.see, range_eff: a.range };
}));
def(characters, 'get', '/characters/{id}/upgrades', null, (c) => tx(async db => {      // coûts par paliers (stat_cost_rules) pour l'onglet « Amélioration »
  const ch = await ownChar(db, c, P(c, 'id')); const { rows } = await db.query('SELECT * FROM stat_cost_rules ORDER BY base_xp_cost,stat');
  return rows.map((r: any) => { const n = ch.upgrades[r.stat] ?? 0, tier = Math.floor(n / r.numb_up); return { stat: r.stat, value: ch[r.stat], count: n, tier: Math.min(tier, 2) + 1, untilNextTier: r.numb_up - (n % r.numb_up), nextCost: statUpgradeCost(r, n), needsDivine: r.stat === 'divine_energy_max' }; });
}));
def(characters, 'post', '/characters/{id}/upgrade/{stat}', null, (c) => tx(async db => {
  const ch = await ownChar(db, c, P(c, 'id')); const stat = c.req.param('stat');
  const { rows: [r] } = await db.query('SELECT * FROM stat_cost_rules WHERE stat=$1', [stat]); if (!r) fail(400, 'Statistique inconnue');
  const bought = ch.upgrades[stat] ?? 0; const cost = statUpgradeCost(r, bought); if (ch.xp < cost) fail(409, `XP insuffisante (${cost})`);
  await db.query(`UPDATE characters SET xp=xp-$2, ${stat}=${stat}+1, upgrades=jsonb_set(upgrades,$3,$4::jsonb) WHERE id=$1`, [ch.id, cost, `{${stat}}`, String(bought + 1)]);
  return { ok: true, cost };
}));
def(characters, 'post', '/characters/{id}/portrait', z.object({ data: z.string().max(200_000) }), (c, b) => tx(async db => {
  const ch = await ownChar(db, c, P(c, 'id')); await db.query('UPDATE characters SET portrait=$2 WHERE id=$1', [ch.id, b.data]); return { ok: true };
}));
def(characters, 'get', '/characters/{id}/history', null, (c) => tx(async db => {
  const ch = await ownChar(db, c, P(c, 'id')); return (await db.query('SELECT action,created_at FROM history_action WHERE character_id=$1 ORDER BY id DESC LIMIT 100', [ch.id])).rows;
}));

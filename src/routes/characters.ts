import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z, P } from '../lib/route.js'; import { pool, tx, ownChar, posOf, fail } from '../lib/db.js';
import { statUpgradeCost } from '../game/rules.js'; import { applySpec } from '../game/divine.js'; import { spawn } from '../game/spawn.js'; import { activeMount } from '../game/movement.js';
export const characters = new OpenAPIHono();
def(characters, 'get', '/characters', null, async c => (await pool.query('SELECT id,pseudo,race FROM characters WHERE account_id=$1 ORDER BY id', [c.get('acc').sub])).rows);
def(characters, 'post', '/characters', z.object({ pseudo: z.string().min(3).max(20), race: z.enum(['human', 'demon', 'angel']) }), (c, b) => tx(async db => {
  const { rows: [s] } = await db.query('SELECT * FROM specializations WHERE race=$1 ORDER BY current_rank LIMIT 1', [b.race]);
  const { rows: [ch] } = await db.query(`INSERT INTO characters(account_id,pseudo,race,specialization_id,hp_current,hp_max,recovery,energy_current,energy_max,divine_energy_current,divine_energy_max,strength,agility,see)
    VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$7,$8,$8,$9,$10,$11) RETURNING id`, [c.get('acc').sub, b.pseudo, b.race, s.id, s.hp_max, s.recovery, s.energy_max, s.divine_energy_max, s.strength, s.agility, s.see]);
  await spawn(db, ch.id, b.race); return ch;
}));
def(characters, 'get', '/characters/{id}', null, (c) => tx(async db => {
  const ch = await ownChar(db, c, P(c, 'id')); const p = await posOf(db, ch.id); const mount = await activeMount(db, ch.id);
  const { rows: [s] } = await db.query('SELECT name rank_name,current_rank FROM specializations WHERE id=$1', [ch.specialization_id]);
  const { rows: [m] } = await db.query('SELECT width,height FROM maps WHERE id=$1', [p.map_id]);
  const { portrait, ...rest } = ch; return { ...rest, portrait, rank: s, pos: { map_id: p.map_id, x: p.coord_x, y: p.coord_y, ...m }, mount,
    see_eff: ch.see + (mount?.bonus_see ?? 0), range_eff: ch.range + (mount?.bonus_range ?? 0) };
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

import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z } from '../lib/route.js'; import { tx, ownChar, posOf, fail, log, dist, trimLog } from '../lib/db.js';
import { travel, activeMount } from '../game/movement.js'; import { die, refreshSurcharge } from '../game/divine.js'; import { broadcast } from '../realtime/ws.js';
export const combat = new OpenAPIHono();
def(combat, 'post', '/combat/attack', z.object({ characterId: z.number(), targetCharacterId: z.number().optional(), targetMonsterId: z.number().optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const mp = await posOf(db, me.id); const mount = await activeMount(db, me.id); const range = me.range + (mount?.bonus_range ?? 0);
  const isChar = !!b.targetCharacterId; const tid = b.targetCharacterId ?? b.targetMonsterId ?? fail(400, 'Cible manquante');
  const { rows: [t] } = await db.query(isChar ? 'SELECT * FROM characters WHERE id=$1' : 'SELECT * FROM monsters WHERE id=$1', [tid]); if (!t) fail(404, 'Cible inconnue');
  const { rows: [tp] } = await db.query(`SELECT * FROM positions WHERE ${isChar ? 'character_id' : 'monsters_id'}=$1`, [tid]);
  if (!tp || tp.map_id !== mp.map_id) fail(409, 'Cible introuvable sur cette carte');
  const cur = dist(mp, tp) <= range ? mp : null;
  if (!cur) await travel(db, me, mp, { x: tp.coord_x, y: tp.coord_y }, range, 2); else { if (me.energy_current < 2) fail(409, 'Énergie insuffisante (2)'); await db.query('UPDATE characters SET energy_current=energy_current-2 WHERE id=$1', [me.id]); }
  const dmg = Math.max(1, me.strength - (t.armor ?? 0)); const hp = t.hp_current - dmg;
  await db.query(`UPDATE ${isChar ? 'characters' : 'monsters'} SET hp_current=$2 WHERE id=$1`, [tid, Math.max(hp, 0)]);
  await log(db, me.id, `Attaque ${isChar ? t.pseudo : t.name} (-${dmg} PV)`); if (isChar) await log(db, t.id, `Attaqué par ${me.pseudo} (-${dmg} PV)`); await trimLog(db, me.id);
  let killed = false;
  if (hp <= 0) { killed = true;
    if (isChar) await die(db, t, me.id);
    else { await db.query('UPDATE divine_items SET holder_character_id=$1 WHERE holder_character_id IS NULL AND guardian_monster_id=$2', [me.id, tid]);
      await db.query('UPDATE monsters SET hp_current=hp_max WHERE id=$1', [tid]); await refreshSurcharge(db, me.id); } }
  broadcast(mp.map_id, { type: 'combat', attacker: me.id, target: tid, isChar, dmg, killed }); return { dmg, killed };
}));

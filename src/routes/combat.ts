import { def, router, z, P } from '../lib/route.js';
import { tx, ownChar, fail, log, dist, trimLog } from '../lib/db.js';
import { actor, travel, spend } from '../game/movement.js';
import { gearStats } from '../game/stats.js';
import { loadTarget, targetAt, applyDamage } from '../game/combatlib.js';
import { computeHitChance } from '../game/rules.js'; import { inSafeZone } from '../game/terrain.js';
import { applyArmor } from '../game/rules.js';
import { broadcast } from '../realtime/ws.js';
import { combatEvent } from '../lib/events.js';

export const combat = router();
const ATTACK_COST = 5;
/** Attaquant : l'invocation contrôlée (ses stats) ou le héros (équipement). La monture peut cracher son souffle spécial. */
async function attacker(db: any, ch: any, a: any) {
  if (a.sm) return { name: a.sm.name, agility: a.sm.agility, damage: a.sm.damage };
  const g = await gearStats(db, ch); return { name: ch.pseudo, agility: g.agility, damage: g.damage };
}
def(combat, 'get', '/combat/preview/{characterId}/{x}/{y}', null, c => tx(async db => {
  const ch = await ownChar(db, c, P(c, 'characterId')), a = await actor(db, ch), t = await targetAt(db, a.mp.map_id, P(c, 'x'), P(c, 'y')); if (!t) return { hitChance: null };
  const at = await attacker(db, ch, a); return { hitChance: computeHitChance(at.agility, t.agility), dodge: 100 - computeHitChance(at.agility, t.agility) };
}));
def(combat, 'post', '/combat/attack', z.object({ characterId: z.number(), targetCharacterId: z.number().optional(), targetMonsterId: z.number().optional(), targetSummonId: z.number().optional(), useMountBreath: z.boolean().optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), a = await actor(db, me);
  const col = b.targetCharacterId ? ['character_id', b.targetCharacterId] : b.targetMonsterId ? ['monsters_id', b.targetMonsterId] : b.targetSummonId ? ['summon_id', b.targetSummonId] : fail(400, 'Cible manquante');
  const { rows: [tp] } = await db.query(`SELECT * FROM positions WHERE ${col[0]}=$1`, [col[1]]); if (!tp || tp.map_id !== a.mp.map_id) fail(409, 'Cible introuvable sur cette carte');
  const t = (await loadTarget(db, tp))!; if (t.kind === 'character' && t.id === me.id) fail(400, 'Vous ne pouvez pas vous attaquer');
  if (t.kind !== 'monster' && (inSafeZone(a.mp.map_id, a.mp.coord_x, a.mp.coord_y) || inSafeZone(tp.map_id, tp.coord_x, tp.coord_y))) fail(403, 'Zone sacrée : aucun combat entre joueurs');
  const breath = !!b.useMountBreath && a.mount?.special_attack_name; if (b.useMountBreath && !breath) fail(409, 'Aucune attaque spéciale de monture');
  const cost = breath ? a.mount.special_attack_energy : ATTACK_COST, at = await attacker(db, me, a);
  if (dist(a.mp, tp) > a.range) await travel(db, me, a, { x: tp.coord_x, y: tp.coord_y }, a.range, breath ? 0 : cost);       // trajet (monture) + action (personnage)
  else if (!breath) await spend(db, me, a, cost);
  if (breath) await spend(db, me, a, cost, 'mount');                                                                      // le souffle spécial coûte l'énergie de la monture
  const hit = computeHitChance(at.agility, t.agility), ok = Math.random() * 100 < hit;
  if (!ok) { await log(db, me.id, `Attaque ratée sur ${t.name}`); broadcast(a.mp.map_id, combatEvent(t.id, false, true)); return { dmg: 0, missed: true, hitChance: hit, killed: false }; }
  const raw = breath ? a.mount.special_attack_damage : at.damage, dmg = applyArmor(raw, t.armor);                  // armure physique : réduction directe
  const r = await applyDamage(db, t, dmg, me.id);
  await log(db, me.id, `${breath ? a.mount.special_attack_name : 'Attaque'} sur ${t.name} : -${dmg} PV`); if (t.kind === 'character') await log(db, t.id, `Attaqué par ${at.name} : -${dmg} PV`); await trimLog(db, me.id);
  broadcast(a.mp.map_id, combatEvent(t.id, r.killed)); return { dmg, killed: r.killed, hitChance: hit, missed: false };
}));

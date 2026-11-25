import { def, router, z, P } from '../lib/route.js';
import { checkOccupantAttack } from '../game/buildingCell.js';
import { tx, ownChar, fail, log, dist, trimLog } from '../lib/db.js';
import { actor, travel, spend } from '../game/movement.js';
import { gearStats } from '../game/stats.js';
import { loadTarget, targetAt, applyDamage } from '../game/combatlib.js';
import { computeHitChance } from '../game/rules.js'; import { inSafeZone } from '../game/terrain.js';
import { applyArmor } from '../game/rules.js';
import { broadcast } from '../realtime/ws.js';
import { combatEvent } from '../lib/events.js'; import { triggerItemSpells } from '../game/spellSummon.js'; import { gainXp, weaponXp } from '../game/xp.js'; import { dist3, groundReach, powerAt, actorElevation, targetElevation, weaponReach } from '../game/reach.js';

export const combat = router();
const ATTACK_COST = 5;
/** Attaquant : l'invocation contrôlée (ses stats) ou le héros (équipement). La monture peut cracher son souffle spécial. */
async function attacker(db: any, ch: any, a: any) {
  if (a.sm) return { name: a.sm.name, agility: a.sm.agility, damage: a.sm.damage };
  const g = await gearStats(db, ch); return { name: ch.pseudo, agility: g.agility, damage: g.damage };
}
/** Portée de l'attaque (migration 36) : portée de l'acteur + (portée de l'arme − 1) ; distance 3D (sol + écart de hauteur). */
async function reachOf(db: any, ch: any, a: any, t: any, tp: any, breath = false) {
  const w = a.sm || breath ? { reach: 1, fullAt: null, name: null } : await weaponReach(db, ch.id);
  const range = a.range + w.reach - 1, dh = Math.abs(actorElevation(a) - await targetElevation(db, t)), ground = dist(a.mp, tp);
  return { w, range, dh, ground, d: dist3(ground, dh), maxGround: groundReach(range, dh) };
}
def(combat, 'get', '/combat/preview/{characterId}/{x}/{y}', null, c => tx(async db => {
  const ch = await ownChar(db, c, P(c, 'characterId')), a = await actor(db, ch), t = await targetAt(db, a.mp.map_id, P(c, 'x'), P(c, 'y')); if (!t) return { hitChance: null };
  const at = await attacker(db, ch, a), r = await reachOf(db, ch, a, t, t.pos);
  // Portée : distance réelle (Pythagore), portée d'attaque, cible atteignable (sinon trop haute), puissance à cette distance.
  return { hitChance: computeHitChance(at.agility, t.agility), dodge: 100 - computeHitChance(at.agility, t.agility),
    range: r.range, distance: Math.round(r.d * 100) / 100, height: r.dh, reachable: r.maxGround >= 1, inRange: r.d <= r.range, power: r.d <= r.range ? powerAt(r.d, r.range, r.w.fullAt) : powerAt(Math.min(r.range, Math.max(r.d, 1)), r.range, r.w.fullAt) };
}));
def(combat, 'post', '/combat/attack', z.object({ characterId: z.number(), targetCharacterId: z.number().optional(), targetMonsterId: z.number().optional(), targetSummonId: z.number().optional(), useMountBreath: z.boolean().optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), a = await actor(db, me);
  const col = b.targetCharacterId ? ['character_id', b.targetCharacterId] : b.targetMonsterId ? ['monsters_id', b.targetMonsterId] : b.targetSummonId ? ['summon_id', b.targetSummonId] : fail(400, 'Cible manquante');
  const { rows: [tp] } = await db.query(`SELECT * FROM positions WHERE ${col[0]}=$1`, [col[1]]); if (!tp || tp.map_id !== a.mp.map_id) fail(409, 'Cible introuvable sur cette carte');
  const t = (await loadTarget(db, tp))!; if (t.kind === 'character' && t.id === me.id) fail(400, 'Vous ne pouvez pas vous attaquer');
  if (t.kind !== 'monster' && (inSafeZone(a.mp.map_id, a.mp.coord_x, a.mp.coord_y) || inSafeZone(tp.map_id, tp.coord_x, tp.coord_y))) fail(403, 'Zone sacrée : aucun combat entre joueurs');
  await checkOccupantAttack(db, t, Math.min(dist(a.mp, tp), a.range) <= 1 ? 'melee' : 'ranged');   // personnage protégé par le bâtiment qu'il occupe
  const breath = !!b.useMountBreath && a.mount?.special_attack_name; if (b.useMountBreath && !breath) fail(409, 'Aucune attaque spéciale de monture');
  const cost = breath ? a.mount.special_attack_energy : ATTACK_COST, at = await attacker(db, me, a);
  let rg = await reachOf(db, me, a, t, tp, !!breath);
  if (rg.maxGround < 1) fail(409, `${t.name} est hors d'atteinte : ${rg.dh} niveau(x) d'écart de hauteur, il faut une portée d'au moins ${Math.ceil(Math.hypot(1, rg.dh) * 100) / 100} (la vôtre : ${rg.range})`);
  if (rg.d > rg.range) { await travel(db, me, a, { x: tp.coord_x, y: tp.coord_y }, rg.maxGround, breath ? 0 : cost); rg = await reachOf(db, me, a, t, tp, !!breath); }   // trajet (monture) + action (personnage)
  else if (!breath) await spend(db, me, a, cost);
  if (breath) await spend(db, me, a, cost, 'mount');                                                                      // le souffle spécial coûte l'énergie de la monture
  const hit = computeHitChance(at.agility, t.agility), ok = Math.random() * 100 < hit;
  if (!ok) { await log(db, me.id, `Attaque ratée sur ${t.name}`); broadcast(a.mp.map_id, combatEvent(t.id, false, true)); return { dmg: 0, missed: true, hitChance: hit, killed: false }; }
  const power = breath ? 100 : powerAt(rg.d, rg.range, rg.w.fullAt);   // arme à distance : pleine puissance jusqu'à N cases, puis baisse jusqu'à 50 %
  const raw = Math.round((breath ? a.mount.special_attack_damage : at.damage) * power / 100), dmg = applyArmor(raw, t.armor);   // armure physique : réduction directe
  const r = await applyDamage(db, t, dmg, me.id);
  // XP des armes portées (items.xp_use) à chaque coup porté par le héros (pas l'invocation contrôlée ni le souffle de monture), selon l'écart de rang.
  const xp = !a.sm && !breath ? await gainXp(db, me.id, await weaponXp(db, me.id), t) : 0;
  // Sorts des objets portés (lot D) : arme → au coup porté (le héros, pas une invocation contrôlée) ; armure / bouclier → à l'attaque reçue.
  const procs: string[] = [];
  if (!a.sm && !r.killed) procs.push(...await triggerItemSpells(db, me, { ...t, row: { ...t.row, hp_current: r.hp } }, 'on_hit'));
  if (t.kind === 'character' && !r.killed) { const { rows: [mp] } = await db.query('SELECT * FROM positions WHERE character_id=$1', [me.id]); const self = a.sm ? null : await loadTarget(db, mp); if (self) procs.push(...await triggerItemSpells(db, t.row, self, 'on_struck')); }
  if (procs.length) await log(db, me.id, procs.join(' ; ').slice(0, 300));
  await log(db, me.id, `${breath ? a.mount.special_attack_name : 'Attaque'} sur ${t.name} : -${dmg} PV${power < 100 ? ` (puissance ${power} % à ${Math.round(rg.d * 10) / 10} cases)` : ''}`); if (t.kind === 'character') await log(db, t.id, `Attaqué par ${at.name} : -${dmg} PV`); await trimLog(db, me.id);
  broadcast(a.mp.map_id, combatEvent(t.id, r.killed)); return { dmg, killed: r.killed, hitChance: hit, missed: false, xp, power };
}));

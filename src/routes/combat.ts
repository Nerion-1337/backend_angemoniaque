import { def, router, z, P } from '../lib/route.js';
import { checkOccupantAttack } from '../game/buildingCell.js';
import { tx, ownChar, fail, log, dist, trimLog } from '../lib/db.js';
import { actor, travel, spend } from '../game/movement.js';
import { gearStats } from '../game/stats.js';
import { loadTarget, targetAt, applyDamage } from '../game/combatlib.js';
import { computeHitChance } from '../game/rules.js'; import { checkPeace } from '../game/gates.js';
import { applyArmor } from '../game/rules.js';
import { broadcast } from '../realtime/ws.js';
import { combatEvent } from '../lib/events.js'; import { triggerItemSpells } from '../game/spellSummon.js'; import { gainXp, weaponXp, hitXp, rankCombat } from '../game/xp.js'; import { attackRange, dist3, groundReach, powerAt, powered, actorElevation, targetElevation, weaponReach } from '../game/reach.js';

export const combat = router();
const ATTACK_COST = 5;
/** Attaquant : l'invocation contrôlée (ses stats) ou le héros (équipement). La monture peut cracher son souffle spécial. */
async function attacker(db: any, ch: any, a: any) {
  if (a.sm) return { name: a.sm.name, agility: a.sm.agility, damage: a.sm.damage };
  const g = await gearStats(db, ch); return { name: ch.pseudo, agility: g.agility, damage: g.damage };
}
/** Portée de l'attaque (migration 36) : portée de l'acteur + (portée de l'arme − 1) ; distance 3D (sol + écart de hauteur). */
async function reachOf(db: any, ch: any, a: any, t: any, tp: any) {
  const w = a.sm ? { reach: 1, ranged: false, fullAt: null, start: 100, end: 100, name: null } : await weaponReach(db, ch.id);
  const range = a.sm ? a.range : attackRange(a.range, w), dh = Math.abs(actorElevation(a) - await targetElevation(db, t)), ground = dist(a.mp, tp);
  return { w, range, dh, ground, d: dist3(ground, dh), maxGround: groundReach(range, dh) };
}
def(combat, 'get', '/combat/preview/{characterId}/{x}/{y}', null, c => tx(async db => {
  const ch = await ownChar(db, c, P(c, 'characterId')), a = await actor(db, ch), t = await targetAt(db, a.mp.map_id, P(c, 'x'), P(c, 'y'), c.req.query('air') == null ? undefined : c.req.query('air') === '1'); if (!t) return { hitChance: null };
  const at = await attacker(db, ch, a), r = await reachOf(db, ch, a, t, t.pos);
  // Portée : distance réelle (Pythagore), portée d'attaque, cible atteignable (sinon trop haute), puissance à cette distance.
  return { hitChance: computeHitChance(at.agility, t.agility), dodge: 100 - computeHitChance(at.agility, t.agility),
    range: r.range, distance: Math.round(r.d * 100) / 100, height: r.dh, reachable: r.maxGround >= 1, inRange: r.d <= r.range, power: Math.round(powerAt(Math.min(r.d, r.range), r.range, r.w.fullAt, r.w.start, r.w.end)) };
}));
def(combat, 'post', '/combat/attack', z.object({ characterId: z.number(), targetCharacterId: z.number().optional(), targetMonsterId: z.number().optional(), targetSummonId: z.number().optional(), targetBuildingId: z.number().optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), a = await actor(db, me);
  const col = b.targetCharacterId ? ['character_id', b.targetCharacterId] : b.targetMonsterId ? ['monsters_id', b.targetMonsterId] : b.targetSummonId ? ['summon_id', b.targetSummonId] : b.targetBuildingId ? ['building_id', b.targetBuildingId] : fail(400, 'Cible manquante');
  const { rows: [tp] } = await db.query(`SELECT * FROM positions WHERE ${col[0]}=$1`, [col[1]]); if (!tp || tp.map_id !== a.mp.map_id) fail(409, 'Cible introuvable sur cette carte');
  const t = (await loadTarget(db, tp))!; if (t.kind === 'character' && t.id === me.id) fail(400, 'Vous ne pouvez pas vous attaquer');
  if (t.kind === 'building') {   // structures (migration 47) : attaquables sauf invulnérables, jamais les siennes
    if (t.row.invulnerable) fail(403, `${t.name} est invulnérable`);
    if (t.row.owner_id === me.id) fail(400, 'Vous ne pouvez pas attaquer votre propre structure');
  }
  await checkPeace(db, a.mp.map_id, { x: a.mp.coord_x, y: a.mp.coord_y }, { x: tp.coord_x, y: tp.coord_y }, t.kind === 'building' ? t.id : 0);   // zones de paix des structures : toute attaque, monstres compris
  const cost = ATTACK_COST, at = await attacker(db, me, a);
  let rg = await reachOf(db, me, a, t, tp);
  await checkOccupantAttack(db, t, rg.w.ranged ? 'ranged' : 'melee');   // personnage protégé par le bâtiment qu'il occupe (attaque à distance ou de mêlée selon l'arme)
  if (rg.maxGround < 1) fail(409, `${t.name} est hors d'atteinte : ${rg.dh} niveau(x) d'écart de hauteur, il faut une portée d'au moins ${Math.ceil(Math.hypot(1, rg.dh) * 100) / 100} (la vôtre : ${rg.range})`);
  if (rg.d > rg.range) { await travel(db, me, a, { x: tp.coord_x, y: tp.coord_y }, rg.maxGround, cost); rg = await reachOf(db, me, a, t, tp); }   // trajet (invocation montée) + action (personnage)
  else await spend(db, me, a, cost);
  const hit = computeHitChance(at.agility, t.agility), ok = Math.random() * 100 < hit;
  if (!ok) {   // esquive : le joueur défenseur gagne l'XP d'esquive de son rang (migration 46)
    const dodgeXp = t.kind === 'character' ? await gainXp(db, t.id, (await rankCombat(db, t.id)).xp_dodge) : 0;
    if (dodgeXp) await log(db, t.id, `Esquive l'attaque de ${at.name} : +${dodgeXp} XP`);
    await log(db, me.id, `Attaque ratée sur ${t.name}`); broadcast(a.mp.map_id, combatEvent(t.id, false, true)); return { dmg: 0, missed: true, hitChance: hit, killed: false }; }
  const pw = powerAt(rg.d, rg.range, rg.w.fullAt, rg.w.start, rg.w.end), power = Math.round(pw);   // grande portée : départ → 100 % à la case X → reste au bout
  const raw = powered(at.damage, pw), dmg = applyArmor(raw, t.armor);   // dégâts arrondis au supérieur ; armure physique : réduction directe
  const r = await applyDamage(db, t, dmg, me.id);
  // XP des armes portées (items.xp_use) à chaque coup porté par le héros (pas l'invocation contrôlée), selon l'écart de rang.
  // + XP du coup porté (migration 46) : contre un joueur (rang de l'attaquant), contre un type de monstre / d'invocation (`xp_hit`)
  const xp = !a.sm ? await gainXp(db, me.id, await weaponXp(db, me.id), t) + await gainXp(db, me.id, await hitXp(db, me.id, t), t) : 0;
  // Sorts des objets portés (lot D) : arme → au coup porté (le héros, pas une invocation contrôlée) ; armure / bouclier → à l'attaque reçue.
  const procs: string[] = [];
  if (!a.sm && !r.killed && t.kind !== 'building') procs.push(...await triggerItemSpells(db, me, { ...t, row: { ...t.row, hp_current: r.hp } }, 'on_hit'));
  if (t.kind === 'character' && !r.killed) { const { rows: [mp] } = await db.query('SELECT * FROM positions WHERE character_id=$1', [me.id]); const self = a.sm ? null : await loadTarget(db, mp); if (self) procs.push(...await triggerItemSpells(db, t.row, self, 'on_struck')); }
  if (procs.length) await log(db, me.id, procs.join(' ; ').slice(0, 300));
  await log(db, me.id, `Attaque sur ${t.name} : -${dmg} PV${power < 100 ? ` (puissance ${power} % à ${Math.round(rg.d * 10) / 10} cases)` : ''}`); if (t.kind === 'character') await log(db, t.id, `Attaqué par ${at.name} : -${dmg} PV`); await trimLog(db, me.id);
  broadcast(a.mp.map_id, combatEvent(t.id, r.killed)); return { dmg, killed: r.killed, hitChance: hit, missed: false, xp, power };
}));

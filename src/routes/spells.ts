import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log, dist, posOf } from '../lib/db.js'; import { freeCell } from '../game/spawn.js'; import { castSummon, ride } from '../game/spellSummon.js';
import { actor, spend, spendDivine } from '../game/movement.js'; import { maxSummons } from '../game/stats.js'; import { terrain, inSafeZone } from '../game/terrain.js'; import { targetAt, applyDamage } from '../game/combatlib.js'; import { applyArmor } from '../game/rules.js'; import { broadcast } from '../realtime/ws.js'; import { combatEvent } from '../lib/events.js'; import { Effects, hasEffects, pickTargets, checkSafe, applyEffects } from '../game/spellEffects.js'; import { loadTarget } from '../game/combatlib.js'; import { checkOccupantAttack, occupiableAt, attackAllowed } from '../game/buildingCell.js'; import { isHarmful } from '../game/spellEffects.js'; import { gainXp } from '../game/xp.js';
/** Sorts lançables : appris, liés (mode actif) à un objet ÉQUIPÉ ou à un bâtiment à soi (entity_spells), et capacités actives du
 *  type de monstre de l'invocation MONTÉE ou contrôlée (monster_spells, payées par elle). */
const CASTABLE = `SELECT s.*, src.source FROM spells s JOIN (
    SELECT spell_id, 'appris' source FROM character_spells WHERE character_id=$1
    UNION SELECT es.spell_id, 'objet : ' || i.name FROM entity_spells es JOIN character_items ci ON ci.item_id=es.ref_id JOIN items i ON i.id=es.ref_id
      WHERE es.kind='item' AND es.mode='active' AND ci.character_id=$1 AND ci.equipped_slot IS NOT NULL
    UNION SELECT es.spell_id, 'bâtiment : ' || b.name FROM entity_spells es JOIN buildings b ON b.id=es.ref_id JOIN positions bp ON bp.building_id=b.id
      JOIN positions me ON me.character_id=$1 AND me.map_id=bp.map_id AND GREATEST(abs(me.coord_x-bp.coord_x), abs(me.coord_y-bp.coord_y)) <= 1
      WHERE es.kind='building' AND es.mode='active' AND b.owner_id=$1
    UNION SELECT ms.spell_id, 'capacité : ' || sm.name FROM monster_spells ms JOIN summons sm ON sm.monster_id=ms.monster_id
      JOIN characters ch ON sm.id IN (ch.controlled_summon_id, ch.riding_summon_id) WHERE ms.mode='active' AND ch.id=$1
  ) src ON src.spell_id=s.id`;
export const spells = router();
def(spells, 'get', '/spells/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId'));
  return { spells: (await db.query(`SELECT DISTINCT ON (s.id) s.*, GREATEST(0, EXTRACT(EPOCH FROM cd.ready_at - now()))::int cooldown_left_s,
      EXISTS (SELECT 1 FROM monsters t WHERE s.effects->'summon'->>'kind'='monster' AND t.id=(s.effects->'summon'->>'refId')::int AND t.mountable) summon_mountable
      FROM (${CASTABLE}) s LEFT JOIN spell_cooldowns cd ON cd.character_id=$1 AND cd.spell_id=s.id ORDER BY s.id`, [me.id])).rows, maxSummons: await maxSummons(db, me), active: (await db.query('SELECT count(*)::int n FROM summons WHERE owner_id=$1', [me.id])).rows[0].n }; }));
/** Délai avant de relancer : refus tant que spell_cooldowns n'est pas échu, puis échéance = maintenant + spells.cooldown_h. Le délai
 *  après la mort d'une invocation (monsters.resummon_delay_h) est posé par le trigger de la migration 43. */
export const fmtWait = (s: number) => { const h = Math.floor(s / 3600), m = Math.ceil((s % 3600) / 60); return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${Math.max(1, m)} min`; };
async function useCooldown(db: any, me: any, sp: any) {
  const { rows: [cd] } = await db.query('SELECT GREATEST(0, EXTRACT(EPOCH FROM ready_at - now()))::int s FROM spell_cooldowns WHERE character_id=$1 AND spell_id=$2', [me.id, sp.id]);
  if (cd?.s > 0) fail(409, `${sp.name} n'est pas encore disponible : encore ${fmtWait(cd.s)}`);
  if (Number(sp.cooldown_h) > 0) await db.query(`INSERT INTO spell_cooldowns(character_id,spell_id,ready_at) VALUES ($1,$2,now()+make_interval(secs => $3::numeric * 3600))
    ON CONFLICT (character_id,spell_id) DO UPDATE SET ready_at=EXCLUDED.ready_at`, [me.id, sp.id, sp.cooldown_h]);
}
def(spells, 'post', '/spells/cast', z.object({ characterId: z.number(), spellId: z.number(), x: z.number().int().optional(), y: z.number().int().optional(), ride: z.boolean().optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), a = await actor(db, me);
  const { rows: [sp] } = await db.query(`${CASTABLE} WHERE s.id=$2 ORDER BY (src.source LIKE 'capacité%') DESC LIMIT 1`, [me.id, b.spellId]); if (!sp) fail(404, 'Sort inconnu');
  await useCooldown(db, me, sp);   // annulé avec la transaction si le sort échoue
  // Capacité de l'invocation montée : payée par elle ; créature contrôlée : elle paie déjà tout (spend).
  const payer = String(sp.source).startsWith('capacité') && a.mount && !a.sm ? 'mount' : 'action';
  await spendDivine(db, me, sp.divine_energy_cost ?? 0);   // énergie divine (admin, 0 par défaut) : toujours le personnage ; annulée avec la transaction si le sort échoue
  if (hasEffects(sp.effects)) {   // moteur paramétrable (spells.effects) : cible, portée, zone, camp, dégâts, soin, durée, caractéristiques
    const e = Effects.parse(sp.effects), from = { x: a.mp.coord_x, y: a.mp.coord_y };
    if (e.summon && !e.damage && !e.heal && !e.dot && !e.stats.length) {   // invocation seule : aucune cible à choisir
      await spend(db, me, a, sp.energy_cost, payer);
      const what = await castSummon(db, me, a.mp, e.summon, sp.id, !!b.ride && !a.sm), xp = await gainXp(db, me.id, sp.xp_use ?? 0);
      await log(db, me.id, `${sp.name} : ${what}`); broadcast(a.mp.map_id, { type: 'spell' });
      return { ok: true, results: [{ target: me.pseudo, effect: what }], xp };
    }
    const center = e.target === 'self' ? from : { x: b.x ?? from.x, y: b.y ?? from.y };
    if (e.target !== 'self' && Math.max(Math.abs(center.x - from.x), Math.abs(center.y - from.y)) > e.range) fail(409, `Cible hors de portée (${e.range} case(s) max)`);
    const r = e.target === 'area' ? e.radius : 0;
    const { rows: ps } = await db.query('SELECT * FROM positions WHERE map_id=$1 AND coord_x BETWEEN $2 AND $3 AND coord_y BETWEEN $4 AND $5 AND item_id IS NULL AND (character_id IS NOT NULL OR monsters_id IS NOT NULL OR summon_id IS NOT NULL)',
      [a.mp.map_id, center.x - r, center.x + r, center.y - r, center.y + r]);
    const all = (await Promise.all(ps.map((p: any) => loadTarget(db, p)))).filter(Boolean) as any[];
    let targets = pickTargets(e, me, center, all, a.sm?.id);
    if (isHarmful(e)) {   // personnages protégés par le bâtiment qu'ils occupent (occupant_attack.spell = faux)
      const ok = []; for (const t of targets) { const bc = t.kind === 'character' && t.id !== me.id ? await occupiableAt(db, t.pos.map_id, t.pos.coord_x, t.pos.coord_y) : null; if (attackAllowed(bc, 'spell')) ok.push(t); }
      if (targets.length && !ok.length) fail(403, 'Cible protégée par un bâtiment contre les sorts');
      targets = ok;
    }
    if (!targets.length) fail(409, 'Aucune cible valable');
    checkSafe(e, a.mp.map_id, me, from, targets);
    await spend(db, me, a, sp.energy_cost, payer);
    const results = [];
    for (const t of targets) results.push({ target: t.name, effect: await applyEffects(db, me, sp.id, e, t) });
    if (e.summon) results.push({ target: me.pseudo, effect: await castSummon(db, me, a.mp, e.summon, sp.id, !!b.ride && !a.sm) });
    // XP du sort (spells.xp_use) : une fois par lancer, pondérée par l'écart de rang avec la première cible autre que soi.
    const xp = await gainXp(db, me.id, sp.xp_use ?? 0, targets.find(t => !(t.kind === 'character' && t.id === me.id)));
    await log(db, me.id, `${sp.name} : ${results.map(x => `${x.target} ${x.effect}`).join(' ; ')}`.slice(0, 300));
    for (const t of targets) broadcast(a.mp.map_id, combatEvent(t.id, false));
    return { ok: true, results, xp };
  }
  const tx_ = b.x ?? a.mp.coord_x, ty = b.y ?? a.mp.coord_y, d = Math.max(Math.abs(tx_ - a.mp.coord_x), Math.abs(ty - a.mp.coord_y));
  if (sp.kind === 'summon') {
    if (d !== 1) fail(409, 'Choisissez une case adjacente'); const cap = await maxSummons(db, me), n = (await db.query('SELECT count(*)::int n FROM summons WHERE owner_id=$1', [me.id])).rows[0].n;
    if (n >= cap) fail(409, `Limite d'invocations atteinte (${cap} max)`);
    if (terrain(tx_, ty, a.mp.map_id).kind === 'deep' || (await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [a.mp.map_id, tx_, ty])).rowCount) fail(409, 'Case occupée');
    await spend(db, me, a, sp.energy_cost, payer);
    const { rows: [s] } = await db.query(`INSERT INTO summons(owner_id,name,hp_current,hp_max,energy_current,energy_max,recovery,see,strength,agility,armor,damage) VALUES ($1,'Golem d’Éther',280,280,75,75,5,4,14,8,10,14) RETURNING id`, [me.id]);
    await db.query('INSERT INTO positions(map_id,coord_x,coord_y,summon_id) VALUES ($1,$2,$3,$4)', [a.mp.map_id, tx_, ty, s.id]);
  } else if (sp.kind === 'summon_cap') { await spend(db, me, a, sp.energy_cost, payer); await db.query('UPDATE characters SET summon_cap=summon_cap+1 WHERE id=$1', [me.id]); }
  else if (sp.kind === 'buff') { await spend(db, me, a, sp.energy_cost, payer);
    for (const stat of ['strength', 'agility']) { await db.query(`UPDATE characters SET ${stat}=${stat}+4 WHERE id=$1`, [me.id]); await db.query("INSERT INTO temp_buffs(character_id,stat,delta,source,expires_at) VALUES ($1,$2,4,$3,now()+interval '1 hour')", [me.id, stat, `spell:${sp.id}`]); } }
  else if (sp.kind === 'attack') {
    if (d > 4) fail(409, 'Cible hors de portée (4 cases max)'); const t = await targetAt(db, a.mp.map_id, tx_, ty); if (!t) fail(409, 'Aucune cible sur cette case'); if (t.kind === 'character' && t.id === me.id) fail(400, 'Cible invalide'); await checkOccupantAttack(db, t, 'spell');
    if (t.kind !== 'monster' && (inSafeZone(a.mp.map_id, a.mp.coord_x, a.mp.coord_y) || inSafeZone(a.mp.map_id, tx_, ty))) fail(403, 'Zone sacrée : aucun combat entre joueurs');
    await spend(db, me, a, sp.energy_cost, payer); const dmg = applyArmor(sp.damage, t.magicArmor), r = await applyDamage(db, t, dmg, me.id); const xp = await gainXp(db, me.id, sp.xp_use ?? 0, t); await log(db, me.id, `${sp.name} sur ${t.name} : -${dmg} PV`); broadcast(a.mp.map_id, combatEvent(t.id, r.killed)); return { ok: true, dmg, killed: r.killed, xp };
  }
  const xp = await gainXp(db, me.id, sp.xp_use ?? 0);
  await log(db, me.id, `Sort lancé : ${sp.name}`); broadcast(a.mp.map_id, { type: 'spell' }); return { ok: true, xp };
}));
def(spells, 'get', '/summons/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId'));
  return (await db.query(`SELECT s.*, p.coord_x x, p.coord_y y, (s.id=$2) controlled, (s.id=$3) ridden, COALESCE(t.mountable, false) mountable
    FROM summons s LEFT JOIN positions p ON p.summon_id=s.id LEFT JOIN monsters t ON t.id=s.monster_id WHERE s.owner_id=$1 ORDER BY s.id`, [me.id, me.controlled_summon_id ?? -1, me.riding_summon_id ?? -1])).rows; }));
def(spells, 'post', '/summons/control', z.object({ characterId: z.number(), summonId: z.number().nullable() }), (c, b) => tx(async db => {      // prendre le contrôle / revenir au héros
  const me = await ownChar(db, c, b.characterId); if (b.summonId !== null && !(await db.query('SELECT 1 FROM summons WHERE id=$1 AND owner_id=$2', [b.summonId, me.id])).rowCount) fail(404, 'Invocation introuvable');
  if (b.summonId !== null && b.summonId === me.riding_summon_id) fail(409, 'Vous êtes monté sur cette invocation : descendez pour la contrôler');
  await db.query('UPDATE characters SET controlled_summon_id=$2 WHERE id=$1', [me.id, b.summonId]); return { ok: true };
}));
def(spells, 'post', '/summons/ride', z.object({ characterId: z.number(), summonId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); if (me.controlled_summon_id) fail(409, 'Revenez d\'abord à votre héros');
  await ride(db, me, b.summonId); return { ok: true };
}));
/** Descendre : l'invocation reprend une case libre voisine du cavalier. Pas en eau profonde (le cavalier s'y noierait). */
def(spells, 'post', '/summons/dismount', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), mp = await posOf(db, me.id);
  if (!me.riding_summon_id) fail(409, 'Vous n\'êtes pas monté');
  if (terrain(mp.coord_x, mp.coord_y, mp.map_id).kind === 'deep') fail(409, 'Impossible de descendre en eau profonde');
  const cell = await freeCell(db, mp.map_id, mp.coord_x, mp.coord_y, 1);
  await db.query('UPDATE characters SET riding_summon_id=NULL WHERE id=$1', [me.id]);
  await db.query('INSERT INTO positions(map_id,coord_x,coord_y,summon_id) VALUES ($1,$2,$3,$4)', [mp.map_id, cell.x, cell.y, me.riding_summon_id]);
  broadcast(mp.map_id, { type: 'moved' }); return { ok: true };
}));
def(spells, 'post', '/summons/{id}/dismiss', z.object({ characterId: z.number() }), (c, b) => tx(async db => { const me = await ownChar(db, c, b.characterId);
  const r = await db.query('DELETE FROM summons WHERE id=$1 AND owner_id=$2', [P(c, 'id'), me.id]); if (!r.rowCount) fail(404, 'Invocation introuvable'); return { ok: true }; }));

import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log, dist } from '../lib/db.js';
import { actor, spend } from '../game/movement.js'; import { maxSummons } from '../game/stats.js'; import { terrain } from '../game/terrain.js'; import { targetAt, applyDamage } from '../game/combatlib.js'; import { applyArmor } from '../game/rules.js'; import { broadcast } from '../realtime/ws.js'; import { combatEvent } from '../lib/events.js';
export const spells = router();
def(spells, 'get', '/spells/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId'));
  return { spells: (await db.query('SELECT s.* FROM character_spells cs JOIN spells s ON s.id=cs.spell_id WHERE cs.character_id=$1 ORDER BY s.id', [me.id])).rows, maxSummons: await maxSummons(db, me), active: (await db.query('SELECT count(*)::int n FROM summons WHERE owner_id=$1', [me.id])).rows[0].n }; }));
def(spells, 'post', '/spells/cast', z.object({ characterId: z.number(), spellId: z.number(), x: z.number().int().optional(), y: z.number().int().optional() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), a = await actor(db, me);
  const { rows: [sp] } = await db.query('SELECT s.* FROM character_spells cs JOIN spells s ON s.id=cs.spell_id WHERE cs.character_id=$1 AND s.id=$2', [me.id, b.spellId]); if (!sp) fail(404, 'Sort inconnu');
  const tx_ = b.x ?? a.mp.coord_x, ty = b.y ?? a.mp.coord_y, d = Math.max(Math.abs(tx_ - a.mp.coord_x), Math.abs(ty - a.mp.coord_y));
  if (sp.kind === 'summon') {
    if (d !== 1) fail(409, 'Choisissez une case adjacente'); const cap = await maxSummons(db, me), n = (await db.query('SELECT count(*)::int n FROM summons WHERE owner_id=$1', [me.id])).rows[0].n;
    if (n >= cap) fail(409, `Limite d'invocations atteinte (${cap} max)`);
    if (terrain(tx_, ty).kind === 'deep' || (await db.query('SELECT 1 FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL', [a.mp.map_id, tx_, ty])).rowCount) fail(409, 'Case occupée');
    await spend(db, me, a, sp.energy_cost);
    const { rows: [s] } = await db.query(`INSERT INTO summons(owner_id,name,hp_current,hp_max,energy_current,energy_max,recovery,see,strength,agility,armor,damage) VALUES ($1,'Golem d’Éther',280,280,75,75,5,4,14,8,10,14) RETURNING id`, [me.id]);
    await db.query('INSERT INTO positions(map_id,coord_x,coord_y,summon_id) VALUES ($1,$2,$3,$4)', [a.mp.map_id, tx_, ty, s.id]);
  } else if (sp.kind === 'summon_cap') { await spend(db, me, a, sp.energy_cost); await db.query('UPDATE characters SET summon_cap=summon_cap+1 WHERE id=$1', [me.id]); }
  else if (sp.kind === 'buff') { await spend(db, me, a, sp.energy_cost);
    for (const stat of ['strength', 'agility']) { await db.query(`UPDATE characters SET ${stat}=${stat}+4 WHERE id=$1`, [me.id]); await db.query("INSERT INTO temp_buffs(character_id,stat,delta,source,expires_at) VALUES ($1,$2,4,$3,now()+interval '1 hour')", [me.id, stat, `spell:${sp.id}`]); } }
  else if (sp.kind === 'attack') {
    if (d > 4) fail(409, 'Cible hors de portée (4 cases max)'); const t = await targetAt(db, a.mp.map_id, tx_, ty); if (!t) fail(409, 'Aucune cible sur cette case'); if (t.kind === 'character' && t.id === me.id) fail(400, 'Cible invalide');
    await spend(db, me, a, sp.energy_cost); const dmg = applyArmor(sp.damage, t.magicArmor), r = await applyDamage(db, t, dmg, me.id); await log(db, me.id, `${sp.name} sur ${t.name} : -${dmg} PV`); broadcast(a.mp.map_id, combatEvent(t.id, r.killed)); return { ok: true, dmg, killed: r.killed };
  }
  await log(db, me.id, `Sort lancé : ${sp.name}`); broadcast(a.mp.map_id, { type: 'spell' }); return { ok: true };
}));
def(spells, 'get', '/summons/{characterId}', null, c => tx(async db => { const me = await ownChar(db, c, P(c, 'characterId'));
  return (await db.query('SELECT s.*, p.coord_x x, p.coord_y y, (s.id=$2) controlled FROM summons s LEFT JOIN positions p ON p.summon_id=s.id WHERE s.owner_id=$1 ORDER BY s.id', [me.id, me.controlled_summon_id ?? -1])).rows; }));
def(spells, 'post', '/summons/control', z.object({ characterId: z.number(), summonId: z.number().nullable() }), (c, b) => tx(async db => {      // prendre le contrôle / revenir au héros
  const me = await ownChar(db, c, b.characterId); if (b.summonId !== null && !(await db.query('SELECT 1 FROM summons WHERE id=$1 AND owner_id=$2', [b.summonId, me.id])).rowCount) fail(404, 'Invocation introuvable');
  await db.query('UPDATE characters SET controlled_summon_id=$2 WHERE id=$1', [me.id, b.summonId]); return { ok: true };
}));
def(spells, 'post', '/summons/{id}/dismiss', z.object({ characterId: z.number() }), (c, b) => tx(async db => { const me = await ownChar(db, c, b.characterId);
  const r = await db.query('DELETE FROM summons WHERE id=$1 AND owner_id=$2', [P(c, 'id'), me.id]); if (!r.rowCount) fail(404, 'Invocation introuvable'); return { ok: true }; }));

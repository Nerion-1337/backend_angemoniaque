import { die, refreshSurcharge, grantDivine } from './divine.js'; import { gearStats } from './stats.js';
import { rollLoot } from './loot.js'; import { gainXp } from './xp.js'; import { occupiableAt } from './buildingCell.js'; import { log } from '../lib/db.js';
export type Target = { kind: 'character' | 'monster' | 'summon' | 'building'; id: number; row: any; pos: any; armor: number; magicArmor: number; agility: number; name: string };
export async function loadTarget(db: any, p: any): Promise<Target | null> {
  if (p.character_id) { const { rows: [c] } = await db.query('SELECT * FROM characters WHERE id=$1', [p.character_id]); const g = await gearStats(db, c), bc = await occupiableAt(db, p.map_id, p.coord_x, p.coord_y); return { kind: 'character', id: c.id, row: c, pos: p, armor: g.armor + (bc?.bonus_armor ?? 0), magicArmor: g.magicArmor + (bc?.bonus_magic_armor ?? 0), agility: g.agility, name: c.pseudo }; }
  if (p.monsters_id) {   // armures du monstre + celles des objets qu'il porte (monster_equips)
    const { rows: [m] } = await db.query('SELECT * FROM monsters WHERE id=$1', [p.monsters_id]);
    const { rows: [e] } = await db.query('SELECT COALESCE(sum(i.armor),0)::int a, COALESCE(sum(i.magic_armor),0)::int ma FROM monster_equips me JOIN items i ON i.id=me.item_id WHERE me.monster_id=$1', [m.id]);
    return { kind: 'monster', id: m.id, row: m, pos: p, armor: (m.armor ?? 0) + (e?.a ?? 0), magicArmor: (m.magic_armor ?? 0) + (e?.ma ?? 0), agility: m.agility, name: m.name };
  }
  if (p.building_id) {   // structure (migration 47) : points de structure courants, armure, aucune agilité
    const { rows: [b] } = await db.query('SELECT *, COALESCE(structure_current, structure) hp_current FROM buildings WHERE id=$1', [p.building_id]);
    return { kind: 'building', id: b.id, row: b, pos: p, armor: b.armor ?? 0, magicArmor: 0, agility: 0, name: b.name };
  }
  if (p.summon_id) { const { rows: [s] } = await db.query('SELECT * FROM summons WHERE id=$1', [p.summon_id]); return { kind: 'summon', id: s.id, row: s, pos: p, armor: s.armor, magicArmor: s.magic_armor ?? 0, agility: s.agility, name: s.name }; }
  return null;
}
/** Cible sur une case ; `air` (migration 46) choisit la couche quand deux entités s'y tiennent (sinon : celle au sol d'abord). */
export async function targetAt(db: any, mapId: number, x: number, y: number, air?: boolean) {
  const { rows: [p] } = await db.query('SELECT * FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL AND (character_id IS NOT NULL OR monsters_id IS NOT NULL OR summon_id IS NOT NULL) AND ($4::boolean IS NULL OR air=$4) ORDER BY air LIMIT 1', [mapId, x, y, air ?? null]);
  return p ? loadTarget(db, p) : null;
}
/** Applique des dégâts ; gère la mort (joueur → Monde des Morts + objets divins, boss → butin au vainqueur, invocation → disparaît). */
export async function applyDamage(db: any, t: Target, dmg: number, killerCharId: number) {
  const hp = Math.max(0, t.row.hp_current - dmg);
  if (t.kind === 'building') {   // structure détruite : retirée de la carte, points de structure remis à neuf (la ligne sert de modèle)
    if (hp > 0) { await db.query('UPDATE buildings SET structure_current=$2 WHERE id=$1', [t.id, hp]); return { hp, killed: false }; }
    // dernière case et date gardées pour la reconstruction (réapparition de la structure, migration 48)
    await db.query(`UPDATE buildings SET structure_current=NULL, destroyed_at=now(), home=jsonb_build_object('map', $2::int, 'x', $3::int, 'y', $4::int) WHERE id=$1`, [t.id, t.pos.map_id, t.pos.coord_x, t.pos.coord_y]);
    await db.query('DELETE FROM positions WHERE building_id=$1', [t.id]);
    if (t.row.kind === 'door') await (await import('./gates.js')).syncGates(db);   // pactes / alliances qui dépendent de cette porte
    await log(db, killerCharId, `Structure détruite : ${t.name}`); return { hp: 0, killed: true };
  }
  const tbl = { character: 'characters', monster: 'monsters', summon: 'summons' }[t.kind];
  await db.query(`UPDATE ${tbl} SET hp_current=$2 WHERE id=$1`, [t.id, hp]); const killed = hp <= 0;
  if (killed) {
    if (t.kind === 'character') await die(db, t.row, killerCharId);
    else if (t.kind === 'monster') await monsterDeath(db, t, killerCharId);
    else await db.query('DELETE FROM summons WHERE id=$1', [t.id]);
  } return { hp, killed };
}
/** Programme la réincarnation différée d'un monstre (échéance due_at, rafraîchie si déjà morte). */
export async function scheduleRespawn(db: any, monsterId: number, delayH: number) {
  await db.query(
    `INSERT INTO monster_respawns(monster_id,due_at) VALUES ($1, now() + make_interval(hours => $2))
     ON CONFLICT (monster_id) DO UPDATE SET due_at = now() + make_interval(hours => $2)`, [monsterId, delayH]);
}
/** Mort d'un monstre : le sauvage disparaît (désespawn), l'ancré régénère ; le butin est tiré
 *  (rollLoot : or + entrées pondérées × drop_rate global) et les objets divins gardés sont
 *  transférés au vainqueur via grantDivine (transfert propre — plafonds respectés, jamais de
 *  duplication ; en cas de plafond la pièce reste sans détenteur).
 *  Phase 3 : si le monstre a un délai de réincarnation (>0 h), il reste mort (PV 0) et
 *  régénère à l'échéance (tick horaire) ; sans délai, régénération instantanée (historique).
 *  Un monstre déjà mort (en attente de réincarnation) ne retoue jamais son butin. */
async function monsterDeath(db: any, t: Target, killerCharId: number) {
  const drops: string[] = [], m = t.row;
  const delayH = Number(m.reincarnate_delay_h ?? 0);   // réglage de CE monstre (migration 35), plus celui de son type
  if ((m.hp_current ?? 0) <= 0) { if (delayH > 0) await scheduleRespawn(db, t.id, delayH); return; }
  // Butin, objet divin porté et XP d'abord : le monstre peut ensuite disparaître.
  drops.push(...await rollLoot(db, m, killerCharId));
  const { rows: guarded } = await db.query('SELECT id FROM divine_items WHERE guardian_monster_id=$1 AND holder_character_id IS NULL', [t.id]);
  for (const g of guarded) {
    try { const d = await grantDivine(db, killerCharId, null, g.id); drops.push(`objet divin ${d.kind} (transfert)`); }
    catch (e: any) { drops.push(`objet divin gardien indisponible (${e?.message ?? 'plafond atteint'})`); }
  }
  const xp = await gainXp(db, killerCharId, Number(m.xp_reward ?? 0), t); if (xp) drops.push(`${xp} XP`);
  await db.query('UPDATE divine_items SET guardian_monster_id=NULL WHERE guardian_monster_id=$1 AND holder_character_id IS NULL', [t.id]);   // non transmis : redevient libre
  if (m.data?.spawned || (m.respawn === false && m.data?.placed)) {   // sauvage, ou monstre posé non recréé : disparaît
    await db.query('DELETE FROM character_monster WHERE monster_id=$1', [t.id]);
    await db.query('DELETE FROM positions WHERE monsters_id=$1', [t.id]);
    await db.query('DELETE FROM monster_loot WHERE monster_id=$1', [t.id]);
    await db.query('DELETE FROM monsters WHERE id=$1', [t.id]);
  } else if (m.respawn === false) {   // type ancré non recréé : retiré de la carte, le type reste au catalogue
    await db.query('DELETE FROM positions WHERE monsters_id=$1', [t.id]);
  } else if (delayH > 0 || (m.respawn_limits ?? []).length || m.divine_family) {   // délai, conditions ou objet divin : vérifiés par le tick
    await scheduleRespawn(db, t.id, delayH);
  } else {
    await db.query('UPDATE monsters SET hp_current=hp_max WHERE id=$1', [t.id]);
  }
  if (drops.length) await log(db, killerCharId, `Butin de ${t.name} : ${drops.join(' ; ')}`);
  await refreshSurcharge(db, killerCharId);
}

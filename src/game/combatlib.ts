import { die, refreshSurcharge, grantDivine } from './divine.js'; import { gearStats } from './stats.js';
import { rollLoot } from './loot.js'; import { log } from '../lib/db.js';
export type Target = { kind: 'character' | 'monster' | 'summon'; id: number; row: any; pos: any; armor: number; magicArmor: number; agility: number; name: string };
export async function loadTarget(db: any, p: any): Promise<Target | null> {
  if (p.character_id) { const { rows: [c] } = await db.query('SELECT * FROM characters WHERE id=$1', [p.character_id]); const g = await gearStats(db, c); return { kind: 'character', id: c.id, row: c, pos: p, armor: g.armor, magicArmor: g.magicArmor, agility: g.agility, name: c.pseudo }; }
  if (p.monsters_id) { const { rows: [m] } = await db.query('SELECT * FROM monsters WHERE id=$1', [p.monsters_id]); return { kind: 'monster', id: m.id, row: m, pos: p, armor: m.armor, magicArmor: m.magic_armor ?? 0, agility: m.agility, name: m.name }; }
  if (p.summon_id) { const { rows: [s] } = await db.query('SELECT * FROM summons WHERE id=$1', [p.summon_id]); return { kind: 'summon', id: s.id, row: s, pos: p, armor: s.armor, magicArmor: s.magic_armor ?? 0, agility: s.agility, name: s.name }; }
  return null;
}
export async function targetAt(db: any, mapId: number, x: number, y: number) {
  const { rows: [p] } = await db.query('SELECT * FROM positions WHERE map_id=$1 AND coord_x=$2 AND coord_y=$3 AND item_id IS NULL AND (character_id IS NOT NULL OR monsters_id IS NOT NULL OR summon_id IS NOT NULL)', [mapId, x, y]);
  return p ? loadTarget(db, p) : null;
}
/** Applique des dégâts ; gère la mort (joueur → Monde des Morts + objets divins, boss → butin au vainqueur, invocation → disparaît). */
export async function applyDamage(db: any, t: Target, dmg: number, killerCharId: number) {
  const hp = Math.max(0, t.row.hp_current - dmg), tbl = { character: 'characters', monster: 'monsters', summon: 'summons' }[t.kind];
  await db.query(`UPDATE ${tbl} SET hp_current=$2 WHERE id=$1`, [t.id, hp]); const killed = hp <= 0;
  if (killed) {
    if (t.kind === 'character') await die(db, t.row, killerCharId);
    else if (t.kind === 'monster') await monsterDeath(db, t, killerCharId);
    else await db.query('DELETE FROM summons WHERE id=$1', [t.id]);
  } return { hp, killed };
}
/** Mort d'un monstre : le sauvage disparaît (désespawn), l'ancré régénère ; le butin est tiré
 *  (rollLoot : or + entrées pondérées × drop_rate global) et les objets divins gardés sont
 *  transférés au vainqueur via grantDivine (transfert propre — plafonds respectés, jamais de
 *  duplication ; en cas de plafond la pièce reste sans détenteur). */
async function monsterDeath(db: any, t: Target, killerCharId: number) {
  const drops: string[] = [];
  if (t.row.data?.spawned) {
    await db.query('DELETE FROM character_monster WHERE monster_id=$1', [t.id]);
    await db.query('DELETE FROM positions WHERE monsters_id=$1', [t.id]);
    await db.query('DELETE FROM monster_loot WHERE monster_id=$1', [t.id]);
    await db.query('DELETE FROM divine_items WHERE guardian_monster_id=$1', [t.id]);
    await db.query('DELETE FROM monsters WHERE id=$1', [t.id]);
  } else {
    await db.query('UPDATE monsters SET hp_current=hp_max WHERE id=$1', [t.id]);
  }
  drops.push(...await rollLoot(db, t.row, killerCharId));
  const { rows: guarded } = await db.query('SELECT id FROM divine_items WHERE guardian_monster_id=$1 AND holder_character_id IS NULL', [t.id]);
  for (const g of guarded) {
    try { await grantDivine(db, killerCharId, null, g.id); drops.push('objet divin gardien (transfert)'); }
    catch (e: any) { drops.push(`objet divin gardien indisponible (${e?.message ?? 'plafond atteint'})`); }
  }
  if (drops.length) await log(db, killerCharId, `Butin de ${t.name} : ${drops.join(' ; ')}`);
  await refreshSurcharge(db, killerCharId);
}

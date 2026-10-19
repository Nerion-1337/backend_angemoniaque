import { computeCharacterDamage } from './rules.js';
/** Caractéristiques effectives : base + bonus d'équipement ; dégâts = arme × (Force − Force requise) ; armure = somme des équipements. */
export async function gearStats(db: any, ch: any) {
  const { rows } = await db.query(`SELECT i.name,i.armor,i.magic_armor,i.strength_bonus,i.agility_bonus,i.req_strength,i.weapon_damage,ci.equipped_slot FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.equipped_slot IS NOT NULL`, [ch.id]);
  const sum = (k: string) => rows.reduce((s: number, r: any) => s + (r[k] ?? 0), 0);
  const weapon = rows.find((r: any) => r.equipped_slot === 'weapon_main' && r.weapon_damage > 0) ?? rows.find((r: any) => r.equipped_slot === 'weapon_off' && r.weapon_damage > 0);
  const strength = ch.strength + sum('strength_bonus'), agility = ch.agility + sum('agility_bonus'), reqStrength = sum('req_strength');
  return { armor: sum('armor'), magicArmor: sum('magic_armor'), weaponDamage: weapon?.weapon_damage ?? 0, strength, agility, reqStrength, damage: computeCharacterDamage(strength, reqStrength, weapon?.weapon_damage ?? null), weaponName: weapon?.name ?? null, gear: rows.map((r: any) => r.name) as string[] };
}
export async function maxSummons(db: any, ch: any) {
  const { rows: [r] } = await db.query(`SELECT COALESCE(sum((i.data->>'bonusSummons')::int),0)::int n FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.equipped_slot IS NOT NULL`, [ch.id]);
  return ch.summon_cap + r.n;
}

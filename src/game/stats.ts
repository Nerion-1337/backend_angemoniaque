import { computeCharacterDamage } from './rules.js';
/** Caractéristiques effectives : base + bonus d'équipement ; dégâts = arme × (Force − Force requise) ; armure et armure magique =
 *  base du personnage (sorts compris) + équipements. PV, énergie, vue, portée, régénération : reportés sur la fiche à l'équipement
 *  (trigger trg_item_bonus, migration 26). */
export async function gearStats(db: any, ch: any) {
  const { rows } = await db.query(`SELECT i.name,i.armor,i.magic_armor,i.strength_bonus,i.agility_bonus,i.req_strength,i.weapon_damage,ci.equipped_slot FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.equipped_slot IS NOT NULL`, [ch.id]);
  const sum = (k: string) => rows.reduce((s: number, r: any) => s + (r[k] ?? 0), 0);
  const weapon = rows.find((r: any) => r.equipped_slot === 'weapon_main' && r.weapon_damage > 0) ?? rows.find((r: any) => r.equipped_slot === 'weapon_off' && r.weapon_damage > 0);
  const strength = ch.strength + sum('strength_bonus'), agility = ch.agility + sum('agility_bonus'), reqStrength = sum('req_strength');
  return { armor: (ch.armor ?? 0) + sum('armor'), magicArmor: (ch.magic_armor ?? 0) + sum('magic_armor'), weaponDamage: weapon?.weapon_damage ?? 0, strength, agility, reqStrength, damage: computeCharacterDamage(strength, reqStrength, weapon?.weapon_damage ?? null), weaponName: weapon?.name ?? null, gear: rows.map((r: any) => r.name) as string[] };
}
export async function maxSummons(db: any, ch: any) {
  const { rows: [r] } = await db.query(`SELECT COALESCE(sum((i.data->>'bonusSummons')::int),0)::int n FROM character_items ci JOIN items i ON i.id=ci.item_id WHERE ci.character_id=$1 AND ci.equipped_slot IS NOT NULL`, [ch.id]);
  return ch.summon_cap + r.n;
}
/**
 * Détail de chaque caractéristique affichée (inventaire, survol) : valeur finale = base + objets équipés + effets temporaires
 * (sorts, pactes, bénédictions de foi : temp_buffs, chacun nommé et typé) + monture / bâtiment occupé (vision, portée). Les colonnes du personnage contiennent déjà les bonus
 * d'objets reportés (PV, énergie, vue, portée, régénération) et les effets temporaires : la base est ce qui reste.
 */
export async function statBreakdown(db: any, ch: any, st: any, a: any, _mount?: any) {
  const { rows: items } = await db.query(`SELECT i.name,i.armor,i.magic_armor,i.strength_bonus,i.agility_bonus,i.bonuses FROM character_items ci JOIN items i ON i.id=ci.item_id
    WHERE ci.character_id=$1 AND ci.equipped_slot IS NOT NULL ORDER BY i.name`, [ch.id]);
  // Origine lisible de chaque effet temporaire : pacte (avec qui, quelle composition, donné ou reçu), foi (bénédiction de quel dieu), sort.
  const { rows: buffs } = await db.query(`SELECT b.stat, sum(b.delta)::int delta,
      CASE WHEN b.source LIKE 'pact:%' THEN 'Pacte avec ' || COALESCE(pc.pseudo, '?') || COALESCE(' (' || pt.name || ')', '')
           WHEN b.source LIKE 'faith:%' THEN 'Bénédiction de ' || COALESCE(gc.pseudo, 'un dieu')
           ELSE COALESCE(sp.name, b.source) END src,
      CASE WHEN b.source LIKE 'pact:%' THEN 'pact' WHEN b.source LIKE 'faith:%' THEN 'faith' WHEN sp.id IS NOT NULL THEN 'spell' ELSE 'buff' END kind
    FROM temp_buffs b LEFT JOIN spells sp ON b.source = 'spell:' || sp.id
      LEFT JOIN pacts pa ON b.source = 'pact:' || pa.id LEFT JOIN pact_tiers pt ON pt.id = pa.tier_id
      LEFT JOIN characters pc ON pc.id = CASE WHEN pa.human_id = b.character_id THEN pa.ethereal_id ELSE pa.human_id END
      LEFT JOIN faiths f ON b.source = 'faith:' || f.id LEFT JOIN characters gc ON gc.id = f.god_id
    WHERE b.character_id=$1 AND b.expires_at > now() GROUP BY 1, 3, 4`, [ch.id]);
  const final: Record<string, number> = { hp_max: ch.hp_max, energy_max: ch.energy_max, divine_energy_max: ch.divine_energy_max, recovery: ch.recovery, see: a.see, range: a.range,
    strength: st.strength, agility: st.agility, armor: st.armor, magic_armor: st.magicArmor };
  const ITEM: Record<string, (i: any) => number> = { strength: i => i.strength_bonus, agility: i => i.agility_bonus, armor: i => i.armor, magic_armor: i => i.magic_armor };
  const out: Record<string, { final: number; base: number; parts: { label: string; value: number; kind: string }[] }> = {};
  for (const k of Object.keys(final)) {
    const parts: { label: string; value: number; kind: string }[] = [];
    for (const i of items) { const v = Number(ITEM[k] ? ITEM[k](i) : i.bonuses?.[k]) || 0; if (v) parts.push({ label: i.name, value: v, kind: 'item' }); }
    for (const b of buffs) if (b.stat === k && b.delta) parts.push({ label: b.src, value: b.delta, kind: b.kind });   // kind : pact | faith | spell | buff
    if ((k === 'see' || k === 'range') && a.extra) parts.push(...a.extra[k]);   // hauteur, taille de la monture, capacités passives, bâtiment (actor)
    out[k] = { final: final[k], base: final[k] - parts.reduce((s, p) => s + p.value, 0), parts };
  }
  return out;
}

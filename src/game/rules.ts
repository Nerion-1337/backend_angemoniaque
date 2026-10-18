export type StatRule = { base_xp_cost: number; numb_up: number; multi_1: number; multi_2: number; multi_3: number };
/** Coût XP du prochain point : base × multiplicateur du palier (hypothèse : palier = floor(achats / numb_up), plafonné à multi_3). */
export function statUpgradeCost(rule: StatRule, purchased: number): number {
  const tier = Math.floor(purchased / rule.numb_up);
  const m = [rule.multi_1, rule.multi_2, rule.multi_3][Math.min(tier, 2)];
  return Math.round(rule.base_xp_cost * m);
}
/** 8 directions, diagonales incluses : distance de Chebyshev × coût du terrain. */
export function pathEnergy(from: {x:number;y:number}, to: {x:number;y:number}, costPerCell = 1): number {
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) * costPerCell;
}
/** Énergie totale d'un clic distant : trajet + action (interaction bâtiment = 0). */
export const totalEnergy = (path: number, action: number) => path + action;
/** Surcharge divine : rang effectif si on détient plus d'objets que requis (quota ignoré). */
export function effectiveRank(current: number, held: number, requiredByRank: Record<number, number>): number {
  let r = current; while (requiredByRank[r + 1] !== undefined && held > requiredByRank[r + 1]) r++; return r;
}
export const inVision = (c:{x:number;y:number}, p:{x:number;y:number}, see:number) => Math.max(Math.abs(c.x-p.x),Math.abs(c.y-p.y)) <= see;
/** Cases traversées de `a` vers `b` (diagonales d'abord), `a` exclue. */
export function walk(a: {x:number;y:number}, b: {x:number;y:number}) {
  const out: {x:number;y:number}[] = []; let { x, y } = a;
  while (x !== b.x || y !== b.y) { x += Math.sign(b.x - x); y += Math.sign(b.y - y); out.push({ x, y }); }
  return out;
}
export const routeEnergy = (a: any, b: any, cost: (x:number,y:number)=>number) => walk(a, b).reduce((s, c) => s + cost(c.x, c.y), 0);
// ---------- Règles reprises du dépôt (statCalculator) ----------
/** Dégâts = multiplicateur d'arme × (Force − Force requise des équipements) ; 1 à mains nues. */
export function computeCharacterDamage(strength: number, totalRequiredStrength: number, weaponMultiplier: number | null): number {
  if (!weaponMultiplier || weaponMultiplier <= 0) return 1;
  return Math.max(1, weaponMultiplier * Math.max(0, strength - totalRequiredStrength));
}
/** Les PV exacts d'un autre joueur ne sont jamais exposés : seulement son état de forme. */
export function getPublicHealthState(hp: number, hpMax: number): string {
  const r = hpMax > 0 ? (hp / hpMax) * 100 : 100;
  return r >= 75 ? 'En pleine forme' : r >= 50 ? 'Bon état' : r >= 25 ? 'Blessé' : 'Souffrant';
}
/** Pacte : l'Humain gagne 50 % des stats de l'être éthéré ; celui-ci perd moitié moins que le gain de l'Humain. */
export function computePactStatTransfer(etherealStrength: number, etherealAgility: number) {
  const humanStrengthBonus = Math.floor(etherealStrength * 0.5), humanAgilityBonus = Math.floor(etherealAgility * 0.5);
  return { humanStrengthBonus, humanAgilityBonus, etherealStrengthPenalty: Math.floor(humanStrengthBonus * 0.5), etherealAgilityPenalty: Math.floor(humanAgilityBonus * 0.5) };
}
export function canUseDivineEnergy(race: string, rank: string): boolean {
  if (race === 'nephilim') return true;
  return ['divin', 'dieu', 'demi-dieu', 'seraphin', 'séraphin', 'titan'].includes((rank || '').toLowerCase());
}
/** Agilité : chance de toucher (l'esquive est le complément). À agilité égale : 50 %, bornée 10–95 %. */
export const computeHitChance = (attackerAgi: number, defenderAgi: number) => Math.max(10, Math.min(95, Math.round(100 * (attackerAgi + 5) / (attackerAgi + defenderAgi + 10))));

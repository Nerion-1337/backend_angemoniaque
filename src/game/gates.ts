import { z } from '../lib/route.js'; import { fail } from '../lib/db.js'; import { cfgAll } from './content.js'; import { CAPS } from './spellEffects.js'; import { applyBuff, expireBuffs } from './faithPact.js';
/**
 * Portes des mondes et zones des structures (migration 48).
 * - Porte : `realm` (son monde : human / demon / angel / dead) et `leads_to`. Ses « portes en face » : realm = son leads_to et
 *   leads_to = son realm (portes des Hommes vers les Démons ↔ Brèche de Soufre ; vers les Anges ↔ Arche de Grâce).
 * - Activation : par un joueur de la race du monde de la porte, avec ses éléments d'activation (migration 49, structActivation.ts ;
 *   par défaut 1 objet divin de sa famille par période). Franchir une porte exige une porte en face ouverte :
 *   activer sa propre porte ne permet pas de la franchir, elle laisse venir l'autre monde.
 * - Porte détruite = sans position sur la carte (reconstruite par le tick de réapparition).
 * - Camp (demon / angel) : pactes suspendus si sa porte est détruite ou si TOUTES les portes des Hommes qui mènent chez lui le
 *   sont ; alliance (bonus `gate_bonus`, règles générales) tant que sa porte ET au moins une porte des Hommes vers lui sont ouvertes.
 * - Demi-dieux : leurs pactes ne valent que si TOUTES les portes du monde des Hommes sont détruites.
 */
export const FACTIONS = ['demon', 'angel'] as const;
/** Activée définitivement : date maximale (an 275760). */
export const FOREVER = 8.64e15;
export type Realm = 'demon' | 'angel' | 'demigod';
export const REALM_LABEL: Record<Realm, string> = { demon: 'démoniaques', angel: 'angéliques', demigod: 'des demi-dieux' };
/** Camp d'un pacte selon la race de l'Ange / Démon / demi-dieu qui le propose. */
export const pactRealm = (etherealRace: string): Realm => (etherealRace === 'human' ? 'demigod' : etherealRace as Realm);
export const realmSql = (col: string) => `(CASE ${col} WHEN 'human' THEN 'demigod' ELSE ${col} END)`;

export async function doors(db: any) {
  return (await db.query(`SELECT b.id, b.name, b.realm, b.leads_to, CASE WHEN b.open_until='infinity' THEN NULL ELSE b.open_until END open_until, COALESCE(b.open_until='infinity', false) forever,
      b.data, b.activation, b.activations, p.map_id, p.coord_x, p.coord_y, (p.id IS NOT NULL) placed, (p.id IS NOT NULL AND b.open_until > now()) open,
      CASE WHEN b.open_until='infinity' THEN NULL ELSE GREATEST(0, EXTRACT(EPOCH FROM b.open_until - now()))::int END open_in_s
    FROM buildings b LEFT JOIN positions p ON p.building_id=b.id WHERE b.kind='door' ORDER BY b.id`)).rows;
}
/** Portes en face d'une porte (celles par lesquelles on arrive / qui doivent être ouvertes pour la franchir). */
export const facing = (all: any[], d: any) => all.filter(o => o.realm === d.leads_to && o.leads_to === d.realm);
/** État de chaque camp (pur) : pactes valides, fin de l'alliance (null = pas d'alliance). */
export function realmStatus(all: any[]) {
  const ruined = (ds: any[]) => ds.length > 0 && ds.every(d => !d.placed);
  const lastOpen = (ds: any[]) => ds.filter(d => d.open).reduce((m: number, d) => Math.max(m, d.forever ? FOREVER : new Date(d.open_until).getTime()), 0);
  const out: Record<string, { pactsOn: boolean; allianceUntil: Date | null; reason?: string }> = {};
  for (const f of FACTIONS) {
    const own = all.filter(d => d.realm === f && d.leads_to === 'human'), hum = all.filter(d => d.realm === 'human' && d.leads_to === f);
    const reason = ruined(own) ? `${own.map(d => d.name).join(', ')} détruite` : ruined(hum) ? `portes des Hommes vers ce monde détruites (${hum.map(d => d.name).join(', ')})` : undefined;
    const t = Math.min(lastOpen(own), lastOpen(hum));
    out[f] = { pactsOn: !reason, allianceUntil: t > 0 ? new Date(t) : null, reason };
  }
  const human = all.filter(d => d.realm === 'human');   // portes sans monde (anciennes, realm NULL) : ignorées
  out.demigod = { pactsOn: ruined(human), allianceUntil: null, reason: ruined(human) ? undefined : `il faut que les ${human.length} portes du monde des Hommes soient détruites` };
  return out as Record<Realm, { pactsOn: boolean; allianceUntil: Date | null; reason?: string }>;
}
export const realmsOff = (st: ReturnType<typeof realmStatus>) => (Object.keys(st) as Realm[]).filter(r => !st[r].pactsOn);
export async function checkPactRealm(db: any, etherealRace: string) {
  const r = pactRealm(etherealRace), s = realmStatus(await doors(db))[r];
  if (!s.pactsOn) fail(409, `Pactes ${REALM_LABEL[r]} suspendus : ${s.reason}`);
}

/** Bonus des portes ouvertes (règles générales) : caractéristique → valeur, par camp. */
export const GateBonus = z.object({ demon: z.record(z.enum(CAPS), z.number().int().min(-1e4).max(1e4)).default({}), angel: z.record(z.enum(CAPS), z.number().int().min(-1e4).max(1e4)).default({}) });
export const gateBonus = async () => { const r = GateBonus.safeParse((await cfgAll()).gate_bonus ?? {}); return r.success ? r.data : { demon: {}, angel: {} }; };

/**
 * Remet les bonus d'accord avec l'état des portes (après une activation, une destruction, une reconstruction, chaque heure) :
 * bonus des pactes d'un camp suspendu retirés ; bonus d'alliance (source `gate:<camp>`) donnés aux joueurs du camp et aux Humains
 * en pacte avec eux tant que les deux côtés sont ouverts, jusqu'à la première fermeture, retirés sinon.
 */
export async function syncGates(db: any, bonus?: z.infer<typeof GateBonus>) {
  const st = realmStatus(await doors(db)), off = realmsOff(st); bonus ??= await gateBonus();
  if (off.length) await expireBuffs(db, `source IN (SELECT 'pact:' || p.id FROM pacts p JOIN characters e ON e.id=p.ethereal_id WHERE ${realmSql('e.race')} = ANY($1))`, [off]);
  for (const f of FACTIONS) {
    const src = `gate:${f}`, until = st[f].allianceUntil, stats = Object.entries(bonus[f] ?? {}).filter(([, v]) => v);
    if (!until || !stats.length) { await expireBuffs(db, 'source=$1', [src]); continue; }
    const ids: number[] = (await db.query(`SELECT c.id FROM characters c WHERE NOT c.blocked AND (c.race=$1 OR EXISTS (SELECT 1 FROM pacts p
      JOIN characters e ON e.id=p.ethereal_id WHERE p.active AND p.human_id=c.id AND e.race=$1))`, [f])).rows.map((r: any) => r.id);
    await expireBuffs(db, 'source=$1 AND NOT (character_id = ANY($2))', [src, ids]);
    await db.query('UPDATE temp_buffs SET expires_at=$2 WHERE source=$1', [src, until]);
    const has = new Set((await db.query('SELECT DISTINCT character_id FROM temp_buffs WHERE source=$1', [src])).rows.map((r: any) => r.character_id));
    const hours = (until.getTime() - Date.now()) / 3600e3;
    for (const id of ids) if (!has.has(id)) for (const [k, v] of stats) await applyBuff(db, id, k, v, src, hours);
  }
  return st;
}

/** Structure dont la zone (`peace_radius` : sans combat, `nobuild_radius` : sans construction) couvre la case ; `except` : structure ignorée. */
export async function zoneAt(db: any, col: 'peace_radius' | 'nobuild_radius', map: number, x: number, y: number, except = 0) {
  const { rows: [r] } = await db.query(`SELECT b.name FROM buildings b JOIN positions p ON p.building_id=b.id WHERE b.${col} > 0 AND b.id<>$4
    AND p.map_id=$1 AND GREATEST(abs(p.coord_x-$2), abs(p.coord_y-$3)) <= b.${col} LIMIT 1`, [map, x, y, except]);
  return (r?.name as string) ?? null;
}
/** Zone de paix : aucune attaque (corps à corps, distance, sort, monstre) si l'attaquant OU la cible s'y trouve. La structure
 *  elle-même reste attaquable depuis l'extérieur de sa zone. */
export async function checkPeace(db: any, map: number, from: { x: number; y: number }, to: { x: number; y: number }, targetBuildingId = 0) {
  const n = (await zoneAt(db, 'peace_radius', map, from.x, from.y)) ?? (await zoneAt(db, 'peace_radius', map, to.x, to.y, targetBuildingId));
  if (n) fail(403, `Zone de paix de ${n} : aucune attaque possible`);
}
export async function checkBuildable(db: any, map: number, x: number, y: number) {
  const n = await zoneAt(db, 'nobuild_radius', map, x, y); if (n) fail(403, `Construction interdite près de ${n}`);
}

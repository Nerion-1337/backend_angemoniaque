import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log } from '../lib/db.js';
import { faithCfg, blessingCost, applyBuff, fmtWait, CARD_SQL, godIncome } from '../game/faithPact.js';
/**
 * Foi (migration 44, réglages admin « Foi ») : un joueur devient fidèle d'un dieu de SA race (rang ≥ 5) ; le dieu accepte.
 * Le fidèle prie pour une caractéristique (`prayers` prières par `prayerPeriodH` heures) ; le dieu bénit un fidèle — en
 * réponse ou de lui-même — avec une valeur ≤ max et une durée de 1 h à la durée max, au coût en énergie divine proportionnel.
 * Le dieu gagne XP / or par heure par tranche de fidèles (tick horaire).
 */
export const faiths = router();
const GOD_RANK = 5;
async function god(db: any, c: any, id: number) {
  const g = await ownChar(db, c, id); const { rows: [s] } = await db.query('SELECT current_rank FROM specializations WHERE id=$1', [g.specialization_id]);
  if (s.current_rank < GOD_RANK) fail(403, 'Rang Divin requis'); return g;
}
/** Prières faites dans la période en cours : nombre et prochaine possible. */
async function prayerState(db: any, charId: number) {
  const f = await faithCfg();
  const { rows: [r] } = await db.query(`SELECT count(*)::int n, EXTRACT(EPOCH FROM min(created_at) + make_interval(secs => $2::numeric * 3600) - now())::int next_s
    FROM faith_prayers WHERE character_id=$1 AND created_at > now() - make_interval(secs => $2::numeric * 3600)`, [charId, f.prayerPeriodH]);
  return { max: f.prayers, periodH: f.prayerPeriodH, used: r.n, left: Math.max(0, f.prayers - r.n), nextInS: r.n >= f.prayers ? Math.max(0, r.next_s ?? 0) : 0 };
}
/** Dieux de la race du joueur (le nombre de dieux est très limité : liste, pas de recherche). */
def(faiths, 'get', '/faiths/gods/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  return (await db.query(`SELECT x.*, (SELECT count(*)::int FROM faiths f WHERE f.god_id=x.id AND f.status='accepted') followers,
      (SELECT f.status FROM faiths f WHERE f.god_id=x.id AND f.follower_id=$2) my_status
    FROM (${CARD_SQL} WHERE c.race=$1 AND s.current_rank >= ${GOD_RANK} AND c.id<>$2 AND NOT c.blocked) x ORDER BY x.current_rank DESC, x.pseudo`, [me.race, me.id])).rows;
}));
def(faiths, 'post', '/faiths/join', z.object({ characterId: z.number(), godId: z.number().int() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId);
  const { rows: [g] } = await db.query(`${CARD_SQL} WHERE c.id=$1 AND NOT c.blocked`, [b.godId]);
  if (!g || g.current_rank < GOD_RANK || g.id === me.id) fail(404, 'Dieu introuvable');
  if (g.race !== me.race) fail(403, 'Vous ne pouvez prier qu\'un dieu de votre race');
  if ((await db.query('SELECT 1 FROM faiths WHERE god_id=$1 AND follower_id=$2', [g.id, me.id])).rowCount) fail(409, `Vous êtes déjà (ou demandez à être) fidèle de ${g.pseudo}`);
  await db.query('INSERT INTO faiths(god_id,follower_id) VALUES ($1,$2)', [g.id, me.id]);
  await log(db, me.id, `Demande de foi envoyée à ${g.pseudo}`); await log(db, g.id, `${me.pseudo} demande à devenir votre fidèle`); return { ok: true };
}));
def(faiths, 'get', '/faiths/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId')), f = await faithCfg();
  const card = (col: string) => `SELECT f.id, f.status, f.request_choice, k.pseudo, k.race, k.race_name, k.rank_name, k.current_rank, k.guild, k.id char_id FROM faiths f JOIN (${CARD_SQL}) k ON k.id=f.${col}`;
  const asGod = (await db.query(`${card('follower_id')} WHERE f.god_id=$1 ORDER BY f.status DESC, k.pseudo`, [me.id])).rows;
  const asFollower = (await db.query(`${card('god_id')} WHERE f.follower_id=$1 ORDER BY k.pseudo`, [me.id])).rows;
  const accepted = asGod.filter((x: any) => x.status === 'accepted').length;
  return { asGod, asFollower, prayers: await prayerState(db, me.id), blessings: f.blessings, income: godIncome(accepted, f), followersStep: f.followersStep };
}));
def(faiths, 'post', '/faiths/{id}/accept', z.object({ characterId: z.number(), accept: z.boolean() }), (c, b) => tx(async db => {
  const g = await god(db, c, b.characterId);
  const r = b.accept ? await db.query("UPDATE faiths SET status='accepted' WHERE id=$1 AND god_id=$2", [P(c, 'id'), g.id]) : await db.query('DELETE FROM faiths WHERE id=$1 AND god_id=$2', [P(c, 'id'), g.id]);
  if (!r.rowCount) fail(404, 'Demande introuvable'); return { ok: true };
}));
/** Prière : une caractéristique proposée en admin ; limitée à `prayers` par période (toutes fois confondues). */
def(faiths, 'post', '/faiths/{id}/pray', z.object({ characterId: z.number(), stat: z.string() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId), f = await faithCfg();
  const { rows: [x] } = await db.query("SELECT * FROM faiths WHERE id=$1 AND follower_id=$2 AND status='accepted'", [P(c, 'id'), me.id]); if (!x) fail(404, 'Foi introuvable');
  if (!f.blessings[b.stat as keyof typeof f.blessings]) fail(400, 'Votre dieu ne peut pas accorder cette caractéristique');
  const st = await prayerState(db, me.id);
  if (st.left <= 0) fail(429, `Plus de prière disponible : prochaine dans ${fmtWait(st.nextInS)}`);
  await db.query('INSERT INTO faith_prayers(faith_id,character_id,stat) VALUES ($1,$2,$3)', [x.id, me.id, b.stat]);
  await db.query('UPDATE faiths SET last_request_at=now(), request_choice=$2 WHERE id=$1', [x.id, b.stat]);
  await log(db, x.god_id, `${me.pseudo} vous prie (${b.stat})`); return { ok: true, prayers: await prayerState(db, me.id) };
}));
/** Bénédiction par le dieu : valeur 1..max, durée 1..maxH heures ; coût en énergie divine proportionnel (arrondi au supérieur). */
def(faiths, 'post', '/faiths/{id}/bless', z.object({ characterId: z.number(), stat: z.string(), value: z.number().int().min(1), hours: z.number().int().min(1) }), (c, b) => tx(async db => {
  const g = await god(db, c, b.characterId), f = await faithCfg(), bl = f.blessings[b.stat as keyof typeof f.blessings];
  const { rows: [x] } = await db.query("SELECT * FROM faiths WHERE id=$1 AND god_id=$2 AND status='accepted'", [P(c, 'id'), g.id]); if (!x) fail(404, 'Fidèle introuvable');
  if (!bl) fail(400, 'Caractéristique non accordée par les dieux');
  if (b.value > bl.max) fail(400, `Valeur maximale : ${bl.max}`);
  if (b.hours > bl.maxH) fail(400, `Durée maximale : ${bl.maxH} h`);
  const cost = blessingCost(bl as { max: number; maxH: number; cost: number }, b.value, b.hours);
  if ((g.divine_energy_current ?? 0) < cost) fail(409, `Énergie divine insuffisante (${cost} requise)`);
  await db.query('UPDATE characters SET divine_energy_current=divine_energy_current-$2 WHERE id=$1', [g.id, cost]);
  await applyBuff(db, x.follower_id, b.stat, b.value, `faith:${x.id}`, b.hours);
  if (x.request_choice === b.stat) await db.query('UPDATE faiths SET request_choice=NULL WHERE id=$1', [x.id]);
  await log(db, x.follower_id, `Bénédiction de ${g.pseudo} : ${b.stat} +${b.value} pendant ${b.hours} h`); return { ok: true, cost };
}));

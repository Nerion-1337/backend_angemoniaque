import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log } from '../lib/db.js';
import { pactCfg, pactAmount, applyBuff, defaultMaxPacts, fmtWait, CARD_SQL } from '../game/faithPact.js';
/**
 * Pactes (migration 44, réglages admin « Pacte ») : un Humain et un Ange / Démon. L'Ange / le Démon choisit pour chaque pacte
 * une composition (`pact_tiers`) : XP / or par heure pour lui ; à l'activation par l'Humain, `percent` % de chaque
 * caractéristique choisie en admin passe de l'Ange / Démon à l'Humain (arrondi au supérieur) pendant `duration_h`, puis
 * réactivation possible après `cooldown_h`. L'Humain ne voit que le nom de la composition. Nombre de pactes par rang.
 */
export const pacts = router();
const ETHEREAL = ['demon', 'angel'];
async function maxPactsOf(db: any, ch: any) {
  const { rows: [s] } = await db.query('SELECT current_rank, max_pacts FROM specializations WHERE id=$1', [ch.specialization_id]);
  return s.max_pacts ?? defaultMaxPacts(ch.race, s.current_rank);
}
const activeCount = async (db: any, ch: any) => (await db.query(`SELECT count(*)::int n FROM pacts WHERE active AND ${ch.race === 'human' ? 'human_id' : 'ethereal_id'}=$1`, [ch.id])).rows[0].n;
async function checkLimits(db: any, ...who: any[]) {
  for (const ch of who) { const max = await maxPactsOf(db, ch); if (await activeCount(db, ch) >= max) fail(409, `${ch.pseudo} a atteint son nombre maximal de pactes (${max})`); }
}
/** Demande de pacte : l'Humain nomme un Ange/Démon, ou inversement. L'autre partie doit accepter ; plusieurs demandes possibles. */
def(pacts, 'post', '/pacts/request', z.object({ characterId: z.number(), targetPseudo: z.string().min(1) }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const { rows: [t] } = await db.query('SELECT * FROM characters WHERE pseudo=$1', [b.targetPseudo]); if (!t) fail(404, 'Personnage introuvable');
  const meHuman = me.race === 'human', tHuman = t.race === 'human'; if (meHuman === tHuman || (!meHuman && !ETHEREAL.includes(me.race)) || (!tHuman && !ETHEREAL.includes(t.race))) fail(400, 'Un pacte lie un Humain à un Ange ou un Démon');
  const human = meHuman ? me : t, ethereal = meHuman ? t : me;
  if ((await db.query('SELECT 1 FROM pacts WHERE human_id=$1 AND ethereal_id=$2', [human.id, ethereal.id])).rowCount) fail(409, 'Une demande ou un pacte existe déjà entre vous');
  const tier = (await db.query('SELECT id FROM pact_tiers ORDER BY sort, id LIMIT 1')).rows[0]?.id ?? null;
  const { rows: [r] } = await db.query("INSERT INTO pacts(human_id,ethereal_id,requested_by,active,status,tier_id) VALUES ($1,$2,$3,false,'pending',$4) RETURNING id", [human.id, ethereal.id, me.id, tier]);
  await log(db, me.id, `Demande de pacte envoyée à ${t.pseudo}`); await log(db, t.id, `Demande de pacte reçue de ${me.pseudo}`); return r;
}));
/** Pactes et demandes, avec la fiche publique de l'autre partie ; l'Ange/Démon reçoit le détail des compositions. */
def(pacts, 'get', '/pacts/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId')), human = me.race === 'human';
  const { rows } = await db.query(`SELECT p.id, p.active, p.requested_by, p.tier_id, t.name tier_name,
      GREATEST(0, EXTRACT(EPOCH FROM p.ready_at - now()))::int ready_in_s,
      (SELECT GREATEST(0, EXTRACT(EPOCH FROM max(b.expires_at) - now()))::int FROM temp_buffs b WHERE b.source='pact:'||p.id AND b.character_id=p.human_id) bonus_left_s,
      k.id partner_id, k.pseudo, k.race, k.race_name, k.rank_name, k.current_rank, k.guild
    FROM pacts p LEFT JOIN pact_tiers t ON t.id=p.tier_id JOIN (${CARD_SQL}) k ON k.id = CASE WHEN p.human_id=$1 THEN p.ethereal_id ELSE p.human_id END
    WHERE p.ethereal_id=$1 OR p.human_id=$1 ORDER BY p.id`, [me.id]);
  const tiers = human ? [] : (await db.query('SELECT * FROM pact_tiers ORDER BY sort, id')).rows;
  return { active: rows.filter((r: any) => r.active), incoming: rows.filter((r: any) => !r.active && r.requested_by !== me.id), outgoing: rows.filter((r: any) => !r.active && r.requested_by === me.id),
    tiers, stats: (await pactCfg()).stats, limit: { max: await maxPactsOf(db, me), used: await activeCount(db, me) } };
}));
def(pacts, 'post', '/pacts/{id}/answer', z.object({ characterId: z.number(), accept: z.boolean() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const { rows: [p] } = await db.query('SELECT * FROM pacts WHERE id=$1 AND NOT active AND (human_id=$2 OR ethereal_id=$2) FOR UPDATE', [P(c, 'id'), me.id]); if (!p) fail(404, 'Demande introuvable');
  if (p.requested_by === me.id) fail(403, 'Seule l’autre partie peut répondre à votre demande');
  if (!b.accept) { await db.query('DELETE FROM pacts WHERE id=$1', [p.id]); return { ok: true, accepted: false }; }
  const human = (await db.query('SELECT * FROM characters WHERE id=$1', [p.human_id])).rows[0], eth = (await db.query('SELECT * FROM characters WHERE id=$1', [p.ethereal_id])).rows[0];
  await checkLimits(db, human, eth); await db.query("UPDATE pacts SET active=true,status='active' WHERE id=$1", [p.id]);
  await log(db, human.id, `Pacte conclu avec ${eth.pseudo}`); await log(db, eth.id, `Pacte conclu avec ${human.pseudo}`); return { ok: true, accepted: true };
}));
/** Composition du pacte : choisie par l'Ange / le Démon, pacte par pacte (un bonus en cours n'est pas modifié). */
def(pacts, 'post', '/pacts/{id}/tier', z.object({ characterId: z.number(), tierId: z.number().int() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId);
  if (!(await db.query('SELECT 1 FROM pact_tiers WHERE id=$1', [b.tierId])).rowCount) fail(404, 'Composition inconnue');
  const r = await db.query('UPDATE pacts SET tier_id=$3 WHERE id=$1 AND ethereal_id=$2', [P(c, 'id'), me.id, b.tierId]);
  if (!r.rowCount) fail(404, 'Pacte introuvable (seul l\'Ange ou le Démon choisit la composition)'); return { ok: true };
}));
/** Annuler une demande envoyée ou résilier un pacte actif (chaque partie peut le faire). */
def(pacts, 'delete', '/pacts/{id}/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId')); const r = await db.query('DELETE FROM pacts WHERE id=$1 AND (ethereal_id=$2 OR human_id=$2)', [P(c, 'id'), me.id]); if (!r.rowCount) fail(404, 'Pacte introuvable'); return { ok: true };
}));
/** Activation par l'Humain : transfert de `percent` % des caractéristiques choisies, impossible si les PV de l'Ange/Démon n'y suffisent pas. */
def(pacts, 'post', '/pacts/{id}/activate', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const id = P(c, 'id');
  const { rows: [p] } = await db.query(`SELECT p.*, t.name tier_name, t.percent, t.duration_h, t.cooldown_h, GREATEST(0, EXTRACT(EPOCH FROM p.ready_at - now()))::int wait_s
    FROM pacts p LEFT JOIN pact_tiers t ON t.id=p.tier_id WHERE p.id=$1 AND p.human_id=$2 AND p.active FOR UPDATE OF p`, [id, me.id]); if (!p) fail(404, 'Pacte introuvable');
  if (!p.tier_id) fail(409, 'Aucune composition choisie par l\'Ange ou le Démon');
  if ((await db.query("SELECT 1 FROM temp_buffs WHERE character_id=$1 AND source=$2 AND expires_at>now()", [me.id, `pact:${id}`])).rowCount) fail(409, 'Bonus déjà actif');
  if (p.wait_s > 0) fail(409, `Pacte en recharge : encore ${fmtWait(p.wait_s)}`);
  const { rows: [e] } = await db.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [p.ethereal_id]);
  const moves = (await pactCfg()).stats.map(stat => ({ stat, n: pactAmount(Number(e[stat]) || 0, p.percent) })).filter(m => m.n > 0);
  const hp = moves.find(m => m.stat === 'hp_max');
  if (hp && e.hp_current - hp.n < 1) fail(409, `${e.pseudo} n'a pas assez de points de vie pour le transfert (${hp.n} requis)`);
  const hours = Number(p.duration_h);
  for (const m of moves) { await applyBuff(db, me.id, m.stat, m.n, `pact:${id}`, hours); await applyBuff(db, e.id, m.stat, -m.n, `pact:${id}`, hours); }
  await db.query('UPDATE pacts SET ready_at=now()+make_interval(secs => ($2::numeric + $3::numeric) * 3600) WHERE id=$1', [id, hours, p.cooldown_h]);
  await log(db, me.id, `Pacte ${p.tier_name} activé`); await log(db, e.id, `${me.pseudo} a activé votre pacte (${p.tier_name})`);
  return { ok: true, hours, transfer: Object.fromEntries(moves.map(m => [m.stat, m.n])) };
}));

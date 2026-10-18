import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log } from '../lib/db.js'; import { computePactStatTransfer } from '../game/rules.js';
export const pacts = router();
const maxPacts = (rank: number) => 3 + Math.max(0, rank - 2);   // Ange/Démon : 3 de base, +1 par rang au-dessus de Soldat ; Humain : 1
const BUFF_H = 1, ETHEREAL = ['demon', 'angel'];
/** Limites vérifiées à la conclusion : 1 pacte actif pour un Humain, selon le rang pour un Ange/Démon. */
async function checkLimits(db: any, human: any, ethereal: any) {
  if ((await db.query('SELECT 1 FROM pacts WHERE human_id=$1 AND active', [human.id])).rowCount) fail(409, `${human.pseudo} a déjà son pacte unique`);
  const { rows: [r] } = await db.query('SELECT current_rank FROM specializations WHERE id=$1', [ethereal.specialization_id]);
  const n = (await db.query('SELECT count(*)::int n FROM pacts WHERE ethereal_id=$1 AND active', [ethereal.id])).rows[0].n; if (n >= maxPacts(r.current_rank)) fail(409, `${ethereal.pseudo} a atteint son nombre maximal de pactes`);
}
/** Demande de pacte : l'Humain nomme un Ange/Démon, ou inversement. L'autre partie doit accepter ; plusieurs demandes possibles. */
def(pacts, 'post', '/pacts/request', z.object({ characterId: z.number(), targetPseudo: z.string().min(1) }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const { rows: [t] } = await db.query('SELECT * FROM characters WHERE pseudo=$1', [b.targetPseudo]); if (!t) fail(404, 'Personnage introuvable');
  const meHuman = me.race === 'human', tHuman = t.race === 'human'; if (meHuman === tHuman || (!meHuman && !ETHEREAL.includes(me.race)) || (!tHuman && !ETHEREAL.includes(t.race))) fail(400, 'Un pacte lie un Humain à un Ange ou un Démon');
  const human = meHuman ? me : t, ethereal = meHuman ? t : me;
  if ((await db.query('SELECT 1 FROM pacts WHERE human_id=$1 AND ethereal_id=$2', [human.id, ethereal.id])).rowCount) fail(409, 'Une demande ou un pacte existe déjà entre vous');
  const { rows: [r] } = await db.query("INSERT INTO pacts(human_id,ethereal_id,requested_by,active,status) VALUES ($1,$2,$3,false,'pending') RETURNING id", [human.id, ethereal.id, me.id]);
  await log(db, me.id, `Demande de pacte envoyée à ${t.pseudo}`); await log(db, t.id, `Demande de pacte reçue de ${me.pseudo}`); return r;
}));
def(pacts, 'get', '/pacts/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  const { rows } = await db.query(`SELECT p.id,p.active,p.requested_by, e.pseudo ethereal, e.race ethereal_race, h.pseudo human FROM pacts p JOIN characters e ON e.id=p.ethereal_id JOIN characters h ON h.id=p.human_id WHERE p.ethereal_id=$1 OR p.human_id=$1 ORDER BY p.id`, [me.id]);
  return { active: rows.filter((r: any) => r.active), incoming: rows.filter((r: any) => !r.active && r.requested_by !== me.id), outgoing: rows.filter((r: any) => !r.active && r.requested_by === me.id) };
}));
def(pacts, 'post', '/pacts/{id}/answer', z.object({ characterId: z.number(), accept: z.boolean() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const { rows: [p] } = await db.query('SELECT * FROM pacts WHERE id=$1 AND NOT active AND (human_id=$2 OR ethereal_id=$2) FOR UPDATE', [P(c, 'id'), me.id]); if (!p) fail(404, 'Demande introuvable');
  if (p.requested_by === me.id) fail(403, 'Seule l’autre partie peut répondre à votre demande');
  if (!b.accept) { await db.query('DELETE FROM pacts WHERE id=$1', [p.id]); return { ok: true, accepted: false }; }
  const human = (await db.query('SELECT * FROM characters WHERE id=$1', [p.human_id])).rows[0], eth = (await db.query('SELECT * FROM characters WHERE id=$1', [p.ethereal_id])).rows[0];
  await checkLimits(db, human, eth); await db.query("UPDATE pacts SET active=true,status='active' WHERE id=$1", [p.id]);
  await log(db, human.id, `Pacte conclu avec ${eth.pseudo}`); await log(db, eth.id, `Pacte conclu avec ${human.pseudo}`); return { ok: true, accepted: true };
}));
/** Annuler une demande envoyée ou résilier un pacte actif (chaque partie peut le faire). */
def(pacts, 'delete', '/pacts/{id}/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId')); const r = await db.query('DELETE FROM pacts WHERE id=$1 AND (ethereal_id=$2 OR human_id=$2)', [P(c, 'id'), me.id]); if (!r.rowCount) fail(404, 'Pacte introuvable'); return { ok: true };
}));
def(pacts, 'post', '/pacts/{id}/activate', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const id = P(c, 'id');
  const { rows: [p] } = await db.query('SELECT * FROM pacts WHERE id=$1 AND human_id=$2 AND active', [id, me.id]); if (!p) fail(404, 'Pacte introuvable');
  if ((await db.query("SELECT 1 FROM temp_buffs WHERE character_id=$1 AND source=$2 AND expires_at>now()", [me.id, `pact:${id}`])).rowCount) fail(409, 'Bonus déjà actif');
  const { rows: [e] } = await db.query('SELECT * FROM characters WHERE id=$1', [p.ethereal_id]);
  for (const stat of ['strength', 'agility']) {
    const T = computePactStatTransfer(e.strength, e.agility), bonus = stat === 'strength' ? T.humanStrengthBonus : T.humanAgilityBonus, malus = stat === 'strength' ? T.etherealStrengthPenalty : T.etherealAgilityPenalty;
    for (const [cid, d] of [[me.id, bonus], [e.id, -malus]] as const) {
      await db.query(`UPDATE characters SET ${stat}=${stat}+$2 WHERE id=$1`, [cid, d]);
      await db.query("INSERT INTO temp_buffs(character_id,stat,delta,source,expires_at) VALUES ($1,$2,$3,$4,now()+($5||' hours')::interval)", [cid, stat, d, `pact:${id}`, BUFF_H]);
    }
  } return { ok: true, hours: BUFF_H };
}));

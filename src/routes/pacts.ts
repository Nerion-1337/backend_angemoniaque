import { OpenAPIHono } from '@hono/zod-openapi'; import { def, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log } from '../lib/db.js';
export const pacts = new OpenAPIHono();
const maxPacts = (rank: number) => 3 + Math.max(0, rank - 2);   // 3 de base, +1 par rang au-dessus de Soldat
const BUFF_H = 1;
def(pacts, 'post', '/pacts', z.object({ characterId: z.number(), humanPseudo: z.string() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); if (me.race === 'human') fail(403, 'Seuls Anges et Démons signent un pacte');
  const { rows: [h] } = await db.query("SELECT id FROM characters WHERE pseudo=$1 AND race='human'", [b.humanPseudo]); if (!h) fail(404, 'Humain introuvable');
  const { rows: [r] } = await db.query('SELECT current_rank FROM specializations WHERE id=$1', [me.specialization_id]);
  const n = (await db.query('SELECT count(*)::int n FROM pacts WHERE ethereal_id=$1 AND active', [me.id])).rows[0].n; if (n >= maxPacts(r.current_rank)) fail(409, 'Nombre de pactes maximal atteint');
  if ((await db.query('SELECT 1 FROM pacts WHERE human_id=$1 AND active', [h.id])).rowCount) fail(409, 'Cet humain a déjà un pacte');
  await log(db, me.id, `Pacte signé avec ${b.humanPseudo}`); return (await db.query('INSERT INTO pacts(ethereal_id,human_id) VALUES ($1,$2) RETURNING id', [me.id, h.id])).rows[0];
}));
def(pacts, 'get', '/pacts/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  return (await db.query(`SELECT p.id, e.pseudo ethereal, h.pseudo human, e.race FROM pacts p JOIN characters e ON e.id=p.ethereal_id JOIN characters h ON h.id=p.human_id WHERE p.active AND (p.ethereal_id=$1 OR p.human_id=$1)`, [me.id])).rows;
}));
def(pacts, 'delete', '/pacts/{id}/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  const r = await db.query('UPDATE pacts SET active=false WHERE id=$1 AND (ethereal_id=$2 OR human_id=$2) AND active', [P(c, 'id'), me.id]); if (!r.rowCount) fail(404, 'Pacte introuvable'); return { ok: true };
}));
def(pacts, 'post', '/pacts/{id}/activate', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const id = P(c, 'id');
  const { rows: [p] } = await db.query('SELECT * FROM pacts WHERE id=$1 AND human_id=$2 AND active', [id, me.id]); if (!p) fail(404, 'Pacte introuvable');
  if ((await db.query("SELECT 1 FROM temp_buffs WHERE character_id=$1 AND source=$2 AND expires_at>now()", [me.id, `pact:${id}`])).rowCount) fail(409, 'Bonus déjà actif');
  const { rows: [e] } = await db.query('SELECT * FROM characters WHERE id=$1', [p.ethereal_id]);
  for (const stat of ['strength', 'agility']) {
    const bonus = Math.max(1, Math.floor(e[stat] * 0.2)), malus = Math.floor(bonus / 2);    // l'être éthéré perd moitié moins que le gain
    for (const [cid, d] of [[me.id, bonus], [e.id, -malus]] as const) {
      await db.query(`UPDATE characters SET ${stat}=${stat}+$2 WHERE id=$1`, [cid, d]);
      await db.query("INSERT INTO temp_buffs(character_id,stat,delta,source,expires_at) VALUES ($1,$2,$3,$4,now()+($5||' hours')::interval)", [cid, stat, d, `pact:${id}`, BUFF_H]);
    }
  } return { ok: true, hours: BUFF_H };
}));

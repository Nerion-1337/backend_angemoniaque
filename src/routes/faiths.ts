import { OpenAPIHono } from '@hono/zod-openapi'; import { def, router, z, P } from '../lib/route.js'; import { tx, ownChar, fail, log } from '../lib/db.js';
export const faiths = router();
const CHOICES = ['strength', 'agility', 'hp_max', 'recovery', 'heal'];
async function god(db: any, c: any, id: number) {
  const g = await ownChar(db, c, id); const { rows: [s] } = await db.query('SELECT current_rank FROM specializations WHERE id=$1', [g.specialization_id]);
  if (s.current_rank < 5) fail(403, 'Rang Divin requis'); return g;
}
def(faiths, 'post', '/faiths/join', z.object({ characterId: z.number(), godPseudo: z.string() }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId); const { rows: [g] } = await db.query('SELECT id FROM characters WHERE pseudo=$1', [b.godPseudo]); if (!g) fail(404, 'Dieu introuvable');
  await db.query("INSERT INTO faiths(god_id,follower_id) VALUES ($1,$2)", [g.id, me.id]); return { ok: true };
}));
def(faiths, 'get', '/faiths/{characterId}', null, c => tx(async db => {
  const me = await ownChar(db, c, P(c, 'characterId'));
  const asGod = (await db.query("SELECT f.id,f.status,f.request_choice,ch.pseudo follower FROM faiths f JOIN characters ch ON ch.id=f.follower_id WHERE f.god_id=$1", [me.id])).rows;
  const asFollower = (await db.query("SELECT f.id,f.status,f.last_request_at,f.request_choice,ch.pseudo god FROM faiths f JOIN characters ch ON ch.id=f.god_id WHERE f.follower_id=$1", [me.id])).rows;
  return { asGod, asFollower };
}));
def(faiths, 'post', '/faiths/{id}/accept', z.object({ characterId: z.number(), accept: z.boolean() }), (c, b) => tx(async db => {
  const g = await god(db, c, b.characterId);
  const r = b.accept ? await db.query("UPDATE faiths SET status='accepted' WHERE id=$1 AND god_id=$2", [P(c, 'id'), g.id]) : await db.query('DELETE FROM faiths WHERE id=$1 AND god_id=$2', [P(c, 'id'), g.id]);
  if (!r.rowCount) fail(404, 'Demande introuvable'); return { ok: true };
}));
def(faiths, 'post', '/faiths/{id}/request', z.object({ characterId: z.number(), choice: z.enum(['strength', 'agility', 'hp_max', 'recovery', 'heal']) }), (c, b) => tx(async db => {
  const me = await ownChar(db, c, b.characterId);
  const { rows: [f] } = await db.query("SELECT * FROM faiths WHERE id=$1 AND follower_id=$2 AND status='accepted'", [P(c, 'id'), me.id]); if (!f) fail(404, 'Foi introuvable');
  if (f.last_request_at && Date.now() - +new Date(f.last_request_at) < 72 * 3600_000) fail(429, 'Une requête toutes les 72 h');
  await db.query('UPDATE faiths SET last_request_at=now(), request_choice=$2 WHERE id=$1', [f.id, b.choice]); return { ok: true };
}));
def(faiths, 'post', '/faiths/{id}/answer', z.object({ characterId: z.number() }), (c, b) => tx(async db => {
  const g = await god(db, c, b.characterId); const COST = 5; if (g.divine_energy_current < COST) fail(409, `Énergie divine insuffisante (${COST})`);
  const { rows: [f] } = await db.query('SELECT * FROM faiths WHERE id=$1 AND god_id=$2 AND request_choice IS NOT NULL', [P(c, 'id'), g.id]); if (!f) fail(404, 'Aucune requête');
  if (!CHOICES.includes(f.request_choice)) fail(400, 'Choix invalide');
  if (f.request_choice === 'heal') await db.query('UPDATE characters SET hp_current=hp_max WHERE id=$1', [f.follower_id]);
  else await db.query(`UPDATE characters SET ${f.request_choice}=${f.request_choice}+1 WHERE id=$1`, [f.follower_id]);
  await db.query('UPDATE characters SET divine_energy_current=divine_energy_current-$2 WHERE id=$1', [g.id, COST]);
  await db.query('UPDATE faiths SET request_choice=NULL WHERE id=$1', [f.id]); await log(db, f.follower_id, `Bénédiction reçue (${f.request_choice})`); return { ok: true };
}));

import { def, router } from '../lib/route.js'; import { tx } from '../lib/db.js';
/**
 * Classement public (sans compte, comme le forum) : tous les personnages non bloqués, triés par rang puis XP (puis ancienneté).
 * Affiche pseudo, rang, race, guilde. Pagination `page` / `size` (25 par défaut, 100 max) ; `around=<pseudo>` ouvre la page
 * de ce personnage.
 */
export const ranking = router();
const BASE = `FROM characters c JOIN specializations s ON s.id=c.specialization_id LEFT JOIN guilds g ON g.id=c.guild_id LEFT JOIN races rc ON rc.key=c.race WHERE NOT c.blocked`;
const ORDER = 's.current_rank DESC, c.xp DESC, c.id ASC';
def(ranking, 'get', '/ranking', null, c => tx(async db => {
  const size = Math.min(100, Math.max(1, Math.trunc(Number(c.req.query('size'))) || 25));
  const total = (await db.query(`SELECT count(*)::int n ${BASE}`)).rows[0].n, pages = Math.max(1, Math.ceil(total / size));
  let page = Math.max(1, Math.trunc(Number(c.req.query('page'))) || 1), mine: number | null = null;
  const around = c.req.query('around');
  if (around) {
    const { rows: [r] } = await db.query(`SELECT pos FROM (SELECT c.pseudo, row_number() OVER (ORDER BY ${ORDER})::int pos ${BASE}) x WHERE pseudo=$1`, [around]);
    if (r) { mine = r.pos; page = Math.ceil(r.pos / size); }
  }
  page = Math.min(page, pages);
  const { rows } = await db.query(`SELECT row_number() OVER (ORDER BY ${ORDER})::int pos, c.pseudo, c.race, rc.name race_name, s.name rank_name, s.current_rank, g.name guild
    ${BASE} ORDER BY ${ORDER} LIMIT $1 OFFSET $2`, [size, (page - 1) * size]);
  return { total, page, pages, size, position: mine, rows };
}));

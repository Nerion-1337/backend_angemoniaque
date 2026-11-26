import { describe, test, expect, beforeAll } from 'vitest';
// Migration 35 : réapparition réglée par monstre posé ; objet divin porté un à la fois jusqu'au plafond de la famille ;
// XP ponctuelle (monstre tué, sort, objet) pondérée par l'écart de rang (table réglée dans Races & rangs).
describe.skipIf(!process.env.DATABASE_URL)('Réapparition par monstre, objet divin porté, XP', () => {
  let app: any, pool: any, lib: any, reincarnateDue: any; const s = Date.now() % 1e7; const T: any = {};
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const login = async (email: string) => { let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' }); return r.j.token; };
  const place = async (monsterId: number) => {
    for (let i = 0; i < 80; i++) {
      const r = await call('/admin/bestiary/place', { monsterId, mapId: 3, x: 20 + ((s + i * 7) % 160), y: 20 + ((s * 3 + i * 11) % 160) }, T.adm);
      if (r.status === 200) return r.j.id as number;
    }
    throw new Error('aucune case libre');
  };
  const kill = async (id: number) => {
    const { rows: [p] } = await pool.query('SELECT * FROM positions WHERE monsters_id=$1', [id]);
    await lib.applyDamage(pool, await lib.loadTarget(pool, p), 1e6, T.c);
  };
  const hp = async (id: number) => (await pool.query('SELECT hp_current FROM monsters WHERE id=$1', [id])).rows[0]?.hp_current;
  const xp = async () => (await pool.query('SELECT xp FROM characters WHERE id=$1', [T.c])).rows[0].xp as number;
  beforeAll(async () => {
    app = (await import('../../src/app')).app; pool = (await import('../../src/lib/db')).pool;
    lib = await import('../../src/game/combatlib'); reincarnateDue = (await import('../../src/game/spawn')).reincarnateDue;
    T.adm = await login(process.env.ADMIN_EMAIL ?? 'admin@ange.local');
    T.tk = await login(`xr${s}@x.fr`); T.c = (await call('/characters', { pseudo: `xr${s}`, race: 'human' }, T.tk)).j.id;
  });

  test('réapparition propre à chaque monstre posé : l\'un non recréé disparaît, l\'autre revient', async () => {
    const type = (await call('/admin/content/monsters', { name: `Inst${s}`, hp_max: 10, hp_current: 10 }, T.adm)).j.id;
    const a = await place(type), b = await place(type);
    expect((await call(`/admin/content/monsters/${a}`, { respawn: false }, T.adm, 'PUT')).status).toBe(200);
    expect((await call(`/admin/content/monsters/${b}`, { reincarnate_delay_h: 3 }, T.adm, 'PUT')).status).toBe(200);
    const st = (await call('/admin/bestiary/status', undefined, T.adm)).j.instances;
    expect(st.find((i: any) => i.id === b)).toMatchObject({ respawn: true, reincarnate_h: 3 });
    await kill(a); await kill(b);
    expect((await pool.query('SELECT 1 FROM monsters WHERE id=$1', [a])).rowCount).toBe(0);
    expect(await hp(b)).toBe(0);
    expect((await pool.query("SELECT due_at > now() + interval '2 hours' ok FROM monster_respawns WHERE monster_id=$1", [b])).rows[0].ok).toBe(true);
  });

  test('objet divin porté : un exemplaire par vie, donné au tueur ; plus de retour quand la famille est complète', async () => {
    const fam = `f${s}`;
    await pool.query('INSERT INTO divine_families(key,name,cap) VALUES ($1,$2,2)', [fam, `Fam ${s}`]);
    await pool.query("INSERT INTO items(name,rarity,divine_family) VALUES ($1,'divin',$2)", [`Modèle ${s}`, fam]);
    const type = (await call('/admin/content/monsters', { name: `Gard${s}`, hp_max: 10, hp_current: 10 }, T.adm)).j.id;
    const g = await place(type);
    expect((await call(`/admin/content/monsters/${g}`, { divine_family: 'nope' }, T.adm, 'PUT')).status).toBe(404);
    expect((await call(`/admin/content/monsters/${g}`, { divine_family: fam, reincarnate_delay_h: 0 }, T.adm, 'PUT')).status).toBe(200);
    const carried = async () => (await pool.query('SELECT count(*)::int n FROM divine_items WHERE guardian_monster_id=$1 AND holder_character_id IS NULL', [g])).rows[0].n;
    const held = async () => (await pool.query('SELECT count(*)::int n FROM divine_items WHERE kind=$1 AND holder_character_id=$2', [fam, T.c])).rows[0].n;
    expect(await carried()).toBe(1);
    await kill(g); expect(await held()).toBe(1); expect(await carried()).toBe(0); expect(await hp(g)).toBe(0);
    await reincarnateDue(pool); expect(await hp(g)).toBe(10); expect(await carried()).toBe(1);   // revenu avec un nouvel exemplaire
    await kill(g); expect(await held()).toBe(2);
    await reincarnateDue(pool); expect(await hp(g)).toBe(0);   // 2/2 chez les joueurs : ne revient pas
    expect((await pool.query('SELECT count(*)::int n FROM divine_items WHERE kind=$1', [fam])).rows[0].n).toBe(2);   // jamais au-delà du plafond
  });

  test('XP : récompense du monstre au tueur, sort et objet, pondérées par l\'écart de rang réglé en admin', async () => {
    expect((await call('/admin/content/xp-rank', { table: { '-1': 50, '0': 100, '+1': 200 } }, T.adm, 'PUT')).j.table).toEqual({ '-1': 50, '0': 100, '1': 200 });
    expect((await call('/admin/content/xp-rank', { table: { x: 1 } }, T.adm, 'PUT')).status).toBe(400);
    const type = (await call('/admin/content/monsters', { name: `Xp${s}`, hp_max: 10, hp_current: 10, xp_reward: 40, rank: 3 }, T.adm)).j.id;
    const m = await place(type);
    let x0 = await xp(); await kill(m); expect(await xp() - x0).toBe(80);   // écart +2 → ligne la plus proche (+1) : 200 %
    const { gainXp, weaponXp } = await import('../../src/game/xp');
    const sword = (await call('/admin/content/items', { name: `Lame xp${s}`, slot: 'weapon', xp_use: 6 }, T.adm)).j.id;
    await pool.query("INSERT INTO character_items(character_id,item_id,equipped_slot) VALUES ($1,$2,'weapon_main')", [T.c, sword]);
    expect(await weaponXp(pool, T.c)).toBe(6);
    x0 = await xp(); expect(await gainXp(pool, T.c, 6)).toBe(6); expect(await xp() - x0).toBe(6);   // sans cible : 100 %
    const sp = (await call('/admin/content/spells', { name: `Sxp${s}`, energyCost: 0, xpUse: 9 }, T.adm)).j;
    expect(sp.xp_use).toBe(9);
    await pool.query('INSERT INTO character_spells(character_id,spell_id) VALUES ($1,$2)', [T.c, sp.id]);
    x0 = await xp(); const r = await call('/spells/cast', { characterId: T.c, spellId: sp.id }, T.tk);
    expect(r.status, JSON.stringify(r.j)).toBe(200); expect(r.j.xp).toBe(9); expect(await xp() - x0).toBe(9);
    await call('/admin/content/xp-rank', { table: { '-2': 50, '-1': 75, '0': 100, '1': 125, '2': 150 } }, T.adm, 'PUT');
  });
});

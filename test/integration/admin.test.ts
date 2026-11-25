import { describe, test, expect, beforeAll } from 'vitest';
// Socle de l'espace admin : rôles, CRUD générique, règles transverses, divins, production, audit.
describe.skipIf(!process.env.DATABASE_URL)('Admin phase 1 (socle)', () => {
  let app: any; const s = Date.now(); const T: any = {};
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const mk = async (name: string, race: string, admin = false) => {
    const email = admin ? (process.env.ADMIN_EMAIL ?? 'admin@ange.local') : `${name}${s}@x.fr`;
    let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' });
    // 3 personnages max / compte admin partagé : on réutilise le 1er perso existant (idempotent à la relance).
    // POST /characters ne renvoie que l'id => le pseudo est calculé localement (repli = le pseudo lu côté base).
    const c0 = await call('/characters', undefined, r.j.token);
    if (c0.j?.[0]) return { tk: r.j.token, id: c0.j[0].id, pseudo: c0.j[0].pseudo };
    const pseudo = `${name}${s}`.slice(0, 20);
    const c = await call('/characters', { pseudo, race }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j));
    return { tk: r.j.token, id: c.j.id, pseudo };
  };
  beforeAll(async () => { T.p = await mk('adm1', 'human'); T.adm = await mk('adm', 'human', true); });

  test("rôles : admin a l'accès, player est refusé, /auth/me expose le rôle", async () => {
    expect((await call('/admin/dashboard', undefined, T.adm.tk)).status).toBe(200);
    expect((await call('/admin/dashboard', undefined, T.p.tk)).status).toBe(403);
    expect((await call('/auth/me', undefined, T.adm.tk)).j.role).toBe('admin');
    expect((await call('/auth/me', undefined, T.p.tk)).j.role).toBe('player');
  });

  test('CRUD races & arbre des rangs (paliers, prérequis, multiplicateurs)', async () => {
    const key = `elf${s}`;
    expect((await call('/admin/content/races', { key, name: 'Elf', base_stats: { strength: 8 } }, T.adm.tk)).status).toBe(200);
    const rk = await call('/admin/content/ranks', { race: key, name: 'Initié', current_rank: 1, hp_max: 120, prereq_xp: 300, multipliers: { strength: 1.5 } }, T.adm.tk);
    expect(rk.status).toBe(200);
    const up = await call(`/admin/content/ranks/${rk.j.id}`, { multipliers: { strength: 2 }, evolution: 'Se lève' }, T.adm.tk, 'PUT');
    expect(up.j.multipliers.strength).toBe(2);
    expect((await call('/admin/content/ranks', { race: `zzz${s}`, name: 'X', current_rank: 1 }, T.adm.tk)).status).toBe(400);   // race inconnue
    const races = await call('/admin/content/races', undefined, T.adm.tk);
    const elf = races.j.find((r: any) => r.key === key);
    expect(elf.ranks).toHaveLength(1); expect(elf.ranks[0].prereq_xp).toBe(300);
  });

  test('monstre : CRUD + règles transverses (coûts, caps, modificateurs)', async () => {
    const m = await call('/admin/content/monsters', { name: `Golem${s}`, hp_max: 800, strength: 30, data: { behavior: 'gardiennage' } }, T.adm.tk);
    expect(m.status).toBe(200); const id = m.j.id;
    expect((await call(`/admin/content/monsters/${id}/costs`, { resource: 'granit', qty: 10 }, T.adm.tk)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${id}/caps`, { scope: 'global', value: 3 }, T.adm.tk)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${id}/modifiers`, { stat: 'strength', value: 5, description: 'poigne' }, T.adm.tk)).status).toBe(200);
    const det = await call(`/admin/content/monsters/${id}`, undefined, T.adm.tk);
    expect(det.j.data.behavior).toBe('gardiennage');
    expect(det.j.costs).toHaveLength(1); expect(det.j.caps).toHaveLength(1); expect(det.j.modifiers).toHaveLength(1);
    expect((await call(`/admin/content/monsters/${id}/costs/granit`, undefined, T.adm.tk, 'DELETE')).status).toBe(200);
    expect((await call(`/admin/content/monsters/${id}/costs/granit`, undefined, T.adm.tk, 'DELETE')).status).toBe(404);
    expect((await call(`/admin/content/monsters/${id}`, { hp_max: 900 }, T.adm.tk, 'PUT')).j.hp_max).toBe(900);
    expect((await call(`/admin/content/monsters/${id}`, undefined, undefined)).status).toBe(401);
    expect((await call(`/admin/content/monsters/${id}`, undefined, T.adm.tk, 'DELETE')).status).toBe(200);
  });

  test('objets & divins : CRUD items, plafond des divins, transfert propre', async () => {
    const it = await call('/admin/content/items', { name: `Épée${s}`, slot: 'weapon_main', rarity: 'unique', durability: 50, weapon_damage: 2 }, T.adm.tk);
    expect(it.status).toBe(200);
    expect((await call(`/admin/content/items/${it.j.id}`, { rarity: 'legendary' }, T.adm.tk, 'PUT')).j.rarity).toBe('legendary');
    // cap global des reliques atteint (seed : 4) → aucune pièce de plus
    expect((await call('/admin/content/divine', { kind: 'relique', n: 1 }, T.adm.tk)).status).toBe(409);
    const div = await call('/admin/content/divine?kind=arcane', undefined, T.adm.tk);
    expect(div.j.length).toBe(4);
    const g = await call(`/admin/players/${T.p.id}/grant`, { kind: 'divine', refId: div.j[0].id }, T.adm.tk);
    expect(g.status).toBe(200);
    const div2 = await call('/admin/content/divine?kind=arcane', undefined, T.adm.tk);
    expect(div2.j.filter((d: any) => d.id === div.j[0].id)).toHaveLength(1);
    expect(div2.j.find((d: any) => d.id === div.j[0].id).holder).toBe(T.p.pseudo);   // UN détenteur, transféré
  });

  test('monture & bâtiment : création + production au tick (rendement/h, plafond de stock)', async () => {
    const mo = await call('/admin/content/monsters', { name: `Licorne${s}`, mountable: true, speed: 1.4, carry: 60, hp_max: 300 }, T.adm.tk);   // montures = monstres montables (lot B)
    expect(mo.status).toBe(200);
    const bd = await call('/admin/content/buildings', { name: `Mine${s}`, kind: 'mine', owner_id: T.p.id, structure: 120, data: { production: { lorien: 2 }, storage: { lorien: 5 } } }, T.adm.tk);
    expect(bd.status).toBe(200);
    const res = async () => (await call(`/characters/${T.p.id}`, undefined, T.p.tk)).j.resources.lorien ?? 0;
    console.log('DBG bd:', bd.status, 'owner', bd.j?.owner_id, 'data', JSON.stringify(bd.j?.data));
    expect(await res()).toBe(0);
    const tkd = await call('/admin/tick', undefined, T.adm.tk, 'POST');
    console.log('DBG tick:', tkd.status, JSON.stringify(tkd.j));
    console.log('DBG res after:', await res());
    expect(await res()).toBe(2);
    await call('/admin/tick', undefined, T.adm.tk, 'POST'); expect(await res()).toBe(4);
    await call('/admin/tick', undefined, T.adm.tk, 'POST'); expect(await res()).toBe(5);   // plafonné à 5
    await call('/admin/tick', undefined, T.adm.tk, 'POST'); expect(await res()).toBe(5);
  });

  test('audit : chaque mutation admin est tracée (qui/quoi/avant-après)', async () => {
    const a = await call('/admin/audit?target=item', undefined, T.adm.tk);
    expect(a.status).toBe(200);
    expect(a.j.some((r: any) => r.action === 'item.create')).toBe(true);
    expect(a.j.every((r: any) => r.actor)).toBe(true);
  });

  test('endpoints hérités : create dynamique, stat, dashboard', async () => {
    expect((await call('/admin/create/items', { data: { name: `Objet${s}`, slot: 'scroll' } }, T.adm.tk)).status).toBe(200);
    expect((await call(`/admin/players/${T.p.id}/stat`, { stat: 'gold', delta: 100 }, T.adm.tk)).status).toBe(200);
    expect((await call('/admin/dashboard', undefined, T.adm.tk)).j.counts).toHaveProperty('characters');
  });
});

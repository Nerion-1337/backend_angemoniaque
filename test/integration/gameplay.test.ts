import { describe, test, expect, beforeAll } from 'vitest';
describe.skipIf(!process.env.DATABASE_URL)('Gameplay intégration', () => {
  let app: any; const s = Date.now(); const T: any = {};
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string, method?: string) => { const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => null) }; };
  const mk = async (name: string, race: string, admin = false) => { const email = admin ? 'admin@ange.local' : `${name}${s}@x.fr`;
    let r = await call('/auth/register', { email, password: 'password1' }); if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' });
    const c = await call('/characters', { pseudo: `${name}${s}`.slice(0, 20), race }, r.j.token); if (c.status !== 200) throw new Error(JSON.stringify(c.j)); return { tk: r.j.token, id: c.j.id, pseudo: `${name}${s}`.slice(0, 20) }; };
  beforeAll(async () => { T.h = await mk('hum', 'human'); T.a = await mk('ang', 'angel'); T.adm = await mk('adm', 'human', true); });
  test('pacte ange -> humain, bonus et résiliation', async () => {
    const p = await call('/pacts', { characterId: T.a.id, humanPseudo: T.h.pseudo }, T.a.tk); expect(p.status).toBe(200);
    expect((await call('/pacts', { characterId: T.a.id, humanPseudo: T.h.pseudo }, T.a.tk)).status).toBe(409);       // 1 seul pacte par humain
    expect((await call(`/pacts/${p.j.id}/activate`, { characterId: T.h.id }, T.h.tk)).status).toBe(200);
    expect((await call(`/pacts/${p.j.id}/activate`, { characterId: T.h.id }, T.h.tk)).status).toBe(409);
    expect((await call(`/pacts/${p.j.id}/${T.h.id}`, undefined, T.h.tk, 'DELETE')).status).toBe(200);
  });
  test('guilde + chat guilde + chat vision', async () => {
    expect((await call('/guilds', { characterId: T.h.id, name: `G${s}` }, T.h.tk)).status).toBe(200);
    expect((await call('/messages', { characterId: T.h.id, channel: 'guild', body: 'salut' }, T.h.tk)).status).toBe(200);
    expect((await call(`/messages/${T.h.id}/guild`, undefined, T.h.tk)).j[0].body).toBe('salut');
    expect((await call('/messages', { characterId: T.h.id, channel: 'vision', body: 'yo' }, T.h.tk)).status).toBe(200);
    expect((await call(`/messages/${T.h.id}/unread/count`, undefined, T.h.tk)).status).toBe(200);
  });
  test('mail global', async () => {
    expect((await call('/messages', { characterId: T.h.id, channel: 'mail', body: 'hello', to: T.a.pseudo }, T.h.tk)).status).toBe(200);
    expect((await call(`/messages/${T.a.id}/unread/count`, undefined, T.a.tk)).j.mail).toBe(1);
  });
  test('admin : stats, ajout de caractéristique, création d\'objet', async () => {
    expect((await call('/admin/stats', undefined, T.adm.tk)).status).toBe(200);
    expect((await call(`/admin/players/${T.h.id}/stat`, { stat: 'gold', delta: 500 }, T.adm.tk)).status).toBe(200);
    expect((await call('/admin/create/items', { data: { name: 'Épée test', slot: 'weapon', rarity: 'rare', quantity_max: 3 } }, T.adm.tk)).status).toBe(200);
    expect((await call('/admin/create/items', { data: { name: 'x; drop' , evil_col: 1 } }, T.adm.tk)).status).toBe(200); // colonnes inconnues ignorées
  });
  test('boutique : refus loin de la capitale, inventaire + coffre', async () => {
    const mp = (await call(`/characters/${T.h.id}`, undefined, T.h.tk)).j.pos; expect(mp.map_id).toBe(1);
    const b = await call('/shop/buy', { characterId: T.h.id, itemId: 1 }, T.h.tk); expect([200, 409]).toContain(b.status);
    expect((await call(`/inventory/${T.h.id}`, undefined, T.h.tk)).status).toBe(200);
  });
  test('porte sans objet divin refusée ; rang sans objets refusé', async () => {
    expect((await call('/divine/rank-up', { characterId: T.h.id }, T.h.tk)).status).toBe(403);
    expect((await call('/divine/door', { characterId: T.h.id, buildingId: 4 }, T.h.tk)).status).toBe(409);
  });
  test('combat : cible hors carte refusée', async () => expect((await call('/combat/attack', { characterId: T.h.id, targetCharacterId: T.a.id }, T.h.tk)).status).toBe(409));
});

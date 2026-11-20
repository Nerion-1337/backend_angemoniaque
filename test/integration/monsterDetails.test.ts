import { describe, test, expect, beforeAll } from 'vitest';
// Étape 2 phase 3 (parcours complet admin) : catalogue de sorts, détails de monstre
// (compétences / équipement par slot / auras), placement spontané avec drops + retrait.
describe.skipIf(!process.env.DATABASE_URL)('Admin phase 3 (détails de monstre)', () => {
  let app: any; const s = Date.now();
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  let tk = '';
  beforeAll(async () => {
    const email = process.env.ADMIN_EMAIL ?? 'admin@ange.local';
    let r = await call('/auth/register', { email, password: 'password1' });
    if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' });
    tk = r.j.token;
  });

  test('catalogue de sorts : création, recherche, mise à jour, suppression (catalogue laissé propre)', async () => {
    const name = `Aura Test ${s}`;
    let r = await call('/admin/content/spells', { name, kind: 'buff', durationH: 24, description: 'test' }, tk);
    expect(r.status).toBe(200); const spellId: number = r.j.id;
    expect((await call(`/admin/content/spells?q=${encodeURIComponent(name)}`, undefined, tk)).j.map((x: any) => x.id)).toContain(spellId);
    r = await call(`/admin/content/spells/${spellId}`, { energyCost: 5 }, tk, 'PUT');
    expect(r.j.energy_cost).toBe(5);
    expect((await call(`/admin/content/spells/${spellId}`, undefined, tk, 'DELETE')).status).toBe(200);
    // Le catalogue revient à son état (pas de fuite dans les autres suites : le test « features » compte le catalogue seedé).
    expect((await call('/admin/content/spells', undefined, tk)).j.map((x: any) => x.name)).not.toContain(name);
  });

  test('détails de monstre : compétences, équipement (7 slots), auras', async () => {
    const r0 = await call('/admin/content/monsters', { name: `Troll ${s}`, hp_max: 500 }, tk);
    expect(r0.status).toBe(200); const mId: number = r0.j.id;
    // Réutilisation d'un sort du catalogue seedé (aucun sort créé → pas de fuite).
    const catalog: any[] = await call('/admin/content/spells', undefined, tk).then(x => x.j);
    expect(catalog.length).toBeGreaterThan(0); const spellId: number = catalog[0].id;
    // Compétences/sorts (catalogue global)
    expect((await call(`/admin/content/monsters/${mId}/spells`, { spellId }, tk)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${mId}/spells`, undefined, tk)).j[0].spell_id).toBe(spellId);
    // Équipement : objet du catalogue + slot
    const items: any[] = await call('/admin/content/items', undefined, tk).then(r => r.j);
    expect(items.length).toBeGreaterThan(0);
    let r = await call(`/admin/content/monsters/${mId}/equips`, { itemId: items[0].id, slot: 'mains' }, tk);
    expect(r.status).toBe(200);
    r = await call(`/admin/content/monsters/${mId}/equips`, { itemId: items[0].id, slot: 'tete' }, tk);
    expect(r.j.slot).toBe('tete');                                          // même objet → le slot est mis à jour
    expect((await call(`/admin/content/monsters/${mId}/equips`, undefined, tk)).j[0].item_name).toBe(items[0].name);
    // Auras : sort appliqué en continu (sans énergie), cible + périmètre
    r = await call(`/admin/content/monsters/${mId}/auras`, { spellId, target: 'enemy', radius: 4 }, tk);
    expect(r.status).toBe(200);
    const auras: any[] = await call(`/admin/content/monsters/${mId}/auras`, undefined, tk).then(x => x.j);
    expect(auras[0].spell_id).toBe(spellId); expect(auras[0].target).toBe('enemy'); expect(auras[0].radius).toBe(4);
    // Nettoyage : suppression du monstre (les sous-collections suivent en cascade)
    expect((await call(`/admin/content/monsters/${mId}`, undefined, tk, 'DELETE')).status).toBe(200);
  });

  test('placement spontané : instance clonée avec drops (or + butin) et réincarnation, puis retrait', async () => {
    const r0 = await call('/admin/content/monsters', { name: `Golem ${s}`, hp_max: 300 }, tk);
    const mId: number = r0.j.id;
    expect((await call(`/admin/content/monsters/${mId}/loot`, { itemId: (await call('/admin/content/items', undefined, tk).then(x => x.j[0].id)), dropRate: 100 }, tk)).status).toBe(200);
    let placed: any = null;
    // Balayage déterministe : la zone de la capitale (safe zone, cases praticables) puis le centre de carte.
    const cand: [number, number][] = [];
    for (const y of [40, 45, 50, 55, 60]) for (const x of [40, 45, 50, 55, 60]) cand.push([x, y]);
    for (const y of [95, 100, 105]) for (const x of [95, 100, 105]) cand.push([x, y]);
    for (const [x, y] of cand) {
      const r = await call('/admin/bestiary/place', { monsterId: mId, mapId: 1, x, y, gold: 7, items: true, reincarnateH: 1 }, tk);
      if (r.status === 200) { placed = { ...r.j, x, y }; break; }
      if (r.status === 409 || r.status === 400) continue;   // case occupée / invadable → candidate suivante
      throw new Error(`placement : ${r.status} ${JSON.stringify(r.j)}`);
    }
    expect(placed).toBeTruthy();
    const st: any = await call('/admin/bestiary/status', undefined, tk).then(x => x.j);
    const inst = st.instances.find((i: any) => i.id === placed.id);
    expect(inst).toBeTruthy();
    expect(inst.placed).toBe(true); expect(inst.prototype).toBe(mId);
    expect(inst.gold).toBe(7); expect(inst.reincarnate_h).toBe(1);
    expect((await call('/admin/content/monsters/' + placed.id + '/loot', undefined, tk)).j.length).toBe(1);  // drop copié sur l'instance
    expect((await call(`/admin/bestiary/place/${inst.pos_id}`, undefined, tk, 'DELETE')).status).toBe(200);
    const st2: any = await call('/admin/bestiary/status', undefined, tk).then(x => x.j);
    expect(st2.instances.find((i: any) => i.id === placed.id)).toBeFalsy();
    expect((await call(`/admin/content/monsters/${placed.id}`, undefined, tk)).status).toBe(404);   // instance supprimée
    // Nettoyage : le prototype (non placé après le retrait) est supprimé — rien ne fuit dans la base.
    expect((await call(`/admin/content/monsters/${mId}`, undefined, tk, 'DELETE')).status).toBe(200);
  });
});

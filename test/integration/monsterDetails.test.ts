import { describe, test, expect, beforeAll } from 'vitest';
// Étape 2 phase 3b (parcours complet admin) : catalogue de sorts, capacités actives/passives,
// parties équipables, équipement, placement spontané avec drops + déplacement + retrait.
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
    let r = await call('/auth/register', { email, password: 'Lune-Brisee-2026!' });
    if (r.status !== 200) r = await call('/auth/login', { email, password: 'Lune-Brisee-2026!' });
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

  test('capacités actives/passives + parties équipables + équipement', async () => {
    const r0 = await call('/admin/content/monsters', { name: `Troll ${s}`, hp_max: 500 }, tk);
    expect(r0.status).toBe(200); const mId: number = r0.j.id;
    const catalog: any[] = await call('/admin/content/spells', undefined, tk).then(x => x.j);
    expect(catalog.length).toBeGreaterThan(0); const spellId: number = catalog[0].id;
    // Capacité ACTIVE : sort que le monstre peut lancer (cible/périmètre ignorés → null).
    const act = (await call(`/admin/content/monsters/${mId}/spells`, { spellId, mode: 'active' }, tk));
    expect(act.status).toBe(200);
    expect(act.j.target ?? null).toBeNull(); expect(act.j.radius ?? null).toBeNull();
    // Capacité PASSIVE : sort appliqué en continu (sans énergie), cible + périmètre.
    const pas = (await call(`/admin/content/monsters/${mId}/spells`, { spellId, mode: 'passive', target: 'enemy', radius: 4 }, tk));
    expect(pas.status).toBe(200);
    const caps: any[] = await call(`/admin/content/monsters/${mId}/spells`, undefined, tk).then(x => x.j);
    expect(caps.find((x: any) => x.mode === 'active').spell_id).toBe(spellId);
    expect(caps.find((x: any) => x.mode === 'passive').target).toBe('enemy');
    expect(caps.find((x: any) => x.mode === 'passive').radius).toBe(4);
    // Doublon dans le même mode → 409 ; même sort dans l'autre mode → autorisé.
    expect((await call(`/admin/content/monsters/${mId}/spells`, { spellId, mode: 'active' }, tk)).status).toBe(409);
    // Parties équipables (grille style personnage) + équipement restreint côté UI
    for (const slot of ['head', 'weapon_main', 'weapon_off']) expect((await call(`/admin/content/monsters/${mId}/slots`, { slot }, tk)).status).toBe(200);
    let slots: any[] = await call(`/admin/content/monsters/${mId}/slots`, undefined, tk).then(x => x.j);
    expect(slots.map((x: any) => x.slot).sort()).toEqual(['head', 'weapon_main', 'weapon_off']);
    expect((await call(`/admin/content/monsters/${mId}/slots`, { slot: 'mains' }, tk)).status).toBe(400);   // anciens noms refusés (migration 35)
    const sword = (await call('/admin/content/items', { name: `Épée md${s}`, slot: 'weapon' }, tk)).j.id;
    const helm = (await call('/admin/content/items', { name: `Casque md${s}`, slot: 'head' }, tk)).j.id;
    // Deux armes (même objet dans les deux mains), comme un personnage ; un casque ne va pas en main.
    expect((await call(`/admin/content/monsters/${mId}/equips`, { itemId: sword, slot: 'weapon_main' }, tk)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${mId}/equips`, { itemId: sword, slot: 'weapon_off' }, tk)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${mId}/equips`, { itemId: helm, slot: 'weapon_main' }, tk)).status).toBe(400);
    let r = await call(`/admin/content/monsters/${mId}/equips`, { itemId: helm, slot: 'head' }, tk);
    expect(r.j.slot).toBe('head');
    expect((await call(`/admin/content/monsters/${mId}/equips`, undefined, tk)).j.map((e: any) => e.slot)).toEqual(['weapon_main', 'weapon_off', 'head']);
    expect((await call(`/admin/content/monsters/${mId}/equips/weapon_off`, undefined, tk, 'DELETE')).status).toBe(200);
    // Nettoyage : suppression du monstre (les sous-collections suivent en cascade)
    expect((await call(`/admin/content/monsters/${mId}`, undefined, tk, 'DELETE')).status).toBe(200);
  });

  test('placement spontané : instance clonée (drops + réincarnation), déplacement, liaison personnage, retrait', async () => {
    const r0 = await call('/admin/content/monsters', { name: `Golem ${s}`, hp_max: 300 }, tk);
    const mId: number = r0.j.id;
    expect((await call(`/admin/content/monsters/${mId}/loot`, { itemId: (await call('/admin/content/items', undefined, tk).then(x => x.j[0].id)), dropRate: 100 }, tk)).status).toBe(200);
    let placed: any = null; let px = 0, py = 0;
    // Balayage déterministe : la zone de la capitale (safe zone, cases praticables) puis le centre de carte.
    const cand: [number, number][] = [];
    for (const y of [40, 45, 50, 55, 60]) for (const x of [40, 45, 50, 55, 60]) cand.push([x, y]);
    for (const y of [95, 100, 105]) for (const x of [95, 100, 105]) cand.push([x, y]);
    for (const [x, y] of cand) {
      const r = await call('/admin/bestiary/place', { monsterId: mId, mapId: 1, x, y, gold: 7, items: true, reincarnateH: 1 }, tk);
      if (r.status === 200) { placed = { ...r.j, x, y }; px = x; py = y; break; }
      if (r.status === 409 || r.status === 400) continue;   // case occupée / invadable → candidate suivante
      throw new Error(`placement : ${r.status} ${JSON.stringify(r.j)}`);
    }
    expect(placed).toBeTruthy();
    const st: any = await call('/admin/bestiary/status', undefined, tk).then(x => x.j);
    let inst = st.instances.find((i: any) => i.id === placed.id);
    expect(inst).toBeTruthy();
    expect(inst.placed).toBe(true); expect(inst.prototype).toBe(mId);
    expect(inst.gold).toBe(7); expect(inst.reincarnate_h).toBe(1);
    expect(inst.linked).toBe(false); expect(inst.linked_pseudo ?? null).toBeNull();   // sans lien personnage = natif
    expect((await call('/admin/content/monsters/' + placed.id + '/loot', undefined, tk)).j.length).toBe(1);  // drop copié sur l'instance
    // Déplacement sur la même carte (case d'à côté, garde-fous inclus) : l'instance garde son butin.
    let moved: any = null;
    for (const [nx, ny] of [[px + 1, py], [px, py + 1], [px + 1, py + 1], [px - 1, py]]) {
      const mv = await call(`/admin/bestiary/place/${inst.pos_id}`, { x: nx, y: ny }, tk, 'PUT');
      if (mv.status === 200) { moved = { x: nx, y: ny }; break; }           // case libre praticable trouvée
      if (mv.status !== 409 && mv.status !== 400) throw new Error(`déplacement : ${mv.status} ${JSON.stringify(mv.j)}`);
    }
    expect(moved).toBeTruthy();
    inst = (await call('/admin/bestiary/status', undefined, tk).then(x => x.j)).instances.find((i: any) => i.id === placed.id);
    expect(`${inst.x},${inst.y}`).toBe(`${moved.x},${moved.y}`);
    expect((await call('/admin/content/monsters/' + placed.id + '/loot', undefined, tk)).j.length).toBe(1);
    // Équiper l'instance : le slot est borné PAR LA GRILLE DU TYPE (bornage serveur, phase 3d).
    const ring = (await call('/admin/content/items', { name: `Anneau md${s}`, slot: 'ring' }, tk)).j.id;
    expect((await call(`/admin/content/monsters/${placed.id}/equips`, { itemId: ring, slot: 'ring_l' }, tk)).status).toBe(400);   // grille vide → impossible
    expect((await call(`/admin/content/monsters/${mId}/slots`, { slot: 'ring_l' }, tk)).status).toBe(200);
    expect((await call(`/admin/content/monsters/${placed.id}/equips`, { itemId: ring, slot: 'ring_l' }, tk)).status).toBe(200);   // dans la grille → OK
    expect((await call(`/admin/content/monsters/${placed.id}/equips`, { itemId: ring, slot: 'ring_r' }, tk)).status).toBe(400);   // hors grille → refusé
    expect((await call(`/admin/content/monsters/${placed.id}/equips/ring_l`, undefined, tk, 'DELETE')).status).toBe(200);
    // Retrait : case libérée, instance supprimée (butin + équipement en cascade).
    expect((await call(`/admin/bestiary/place/${inst.pos_id}`, undefined, tk, 'DELETE')).status).toBe(200);
    const st2: any = await call('/admin/bestiary/status', undefined, tk).then(x => x.j);
    expect(st2.instances.find((i: any) => i.id === placed.id)).toBeFalsy();
    expect((await call(`/admin/content/monsters/${placed.id}`, undefined, tk)).status).toBe(404);   // instance supprimée
    // Nettoyage : le prototype (non placé après le retrait) est supprimé — rien ne fuit dans la base.
    expect((await call(`/admin/content/monsters/${mId}`, undefined, tk, 'DELETE')).status).toBe(200);
  });
});

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/lib/db.js';
// Phase 4 : onglets admin Objets & Sorts — rareté (5 niveaux), usable_by (qui peut
// s'équiper / apprendre), filtres ?rarity=/?slot= et décomptes détenteurs/apprenants.
describe.skipIf(!process.env.DATABASE_URL)('Admin phase 4 (rareté & acquisition objet/sort)', () => {
  let app: any; const s = Date.now();
  beforeAll(async () => { app = (await import('../../src/app')).app; });
  const call = async (path: string, body?: any, tk?: string, method?: string) => {
    const r = await app.request(path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined } as any);
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  let tk = '', ptk = '', cId = 0, itemIds: number[] = [], spellIds: number[] = [];
  /** usable_by : la base est jsonb — pg peut renvoyer une valeur parsée ou une chaîne : les deux formes sont acceptées. */
  const ub = (v: any): string[] => (typeof v === 'string' ? JSON.parse(v || '[]') : (v ?? []));
  beforeAll(async () => {
    const email = process.env.ADMIN_EMAIL ?? 'admin@ange.local';
    let r = await call('/auth/register', { email, password: 'password1' });
    if (r.status !== 200) r = await call('/auth/login', { email, password: 'password1' });
    tk = r.j.token;
    // Personnage (compte unique) pour mesurer les décomptes détenteurs/apprenants.
    const pem = `r4_${s}@test.local`;
    let p = await call('/auth/register', { email: pem, password: 'password1' });
    if (p.status !== 200) p = await call('/auth/login', { email: pem, password: 'password1' });
    ptk = p.j.token;
    cId = (await call('/characters', { pseudo: `R4${s}`, race: 'human' }, ptk)).j.id; // POST /characters renvoie { id }
  });
  afterAll(async () => {
    for (const id of itemIds) await pool.query('DELETE FROM character_items WHERE item_id=$1', [id]);
    for (const id of spellIds) await pool.query('DELETE FROM character_spells WHERE spell_id=$1', [id]);
    if (cId) {
      await pool.query('DELETE FROM character_items WHERE character_id=$1', [cId]);
      await pool.query('DELETE FROM character_spells WHERE character_id=$1', [cId]);
      await pool.query('DELETE FROM character_mounts WHERE character_id=$1', [cId]);
      await pool.query('DELETE FROM pacts WHERE ethereal_id=$1 OR human_id=$1', [cId, cId]).catch(() => {});
      // Autres FK potentielles sur characters (monde vide : le test échoue proprement sinon).
      await pool.query('DELETE FROM character_monster WHERE character_id=$1', [cId]).catch(() => {});
      await pool.query('DELETE FROM faiths WHERE god_id=$1 OR follower_id=$1', [cId, cId]).catch(() => {});
      await pool.query('DELETE FROM temp_buffs WHERE character_id=$1', [cId]).catch(() => {});
      await pool.query('DELETE FROM market_listings WHERE seller_id=$1', [cId]).catch(() => {});
      await pool.query('DELETE FROM history_action WHERE character_id=$1', [cId]).catch(() => {});
      await pool.query('DELETE FROM conversation_participants WHERE character_id=$1', [cId]).catch(() => {});
      await pool.query('DELETE FROM positions WHERE character_id=$1', [cId]);
      await pool.query('DELETE FROM characters WHERE id=$1', [cId]);
    }
    // Le compte de test est supprimé (l'admin de la stack reste en place).
    await pool.query('DELETE FROM accounts WHERE email=$1', [`r4_${s}@test.local`]);
    await pool.query('DELETE FROM items WHERE id = ANY($1)', [itemIds.length ? itemIds : []]).catch(() => {});
    await pool.query('DELETE FROM spells WHERE id = ANY($1)', [spellIds.length ? spellIds : []]).catch(() => {});
  });

  test('objets : rareté + usable_by + filtres + décompte détenteurs', async () => {
    const r1 = await call('/admin/content/items', { name: `Épée T4 ${s}`, slot: 'mains', rarity: 'epique', usable_by: ['humain', 'ange'], price: 10 }, tk);
    expect(r1.status).toBe(200);
    const r2 = await call('/admin/content/items', { name: `Épée T4b ${s}`, rarity: 'epique', usable_by: [] }, tk);
    itemIds = [r1.j.id, r2.j.id];

    // Filtre rareté : les 2 objets épiques sont là, l'épique n'est pas dans les « rare ».
    expect((await call('/admin/content/items?rarity=epique', undefined, tk)).j.filter((x: any) => [r1.j.id, r2.j.id].includes(x.id)).length).toBe(2);
    expect((await call('/admin/content/items?rarity=rare', undefined, tk)).j.find((x: any) => x.id === r1.j.id)).toBeUndefined();

    // Filtre type d'équipement (slot) : « mains » contient l'épée, pas l'objet sans slot.
    const bySlot = (await call('/admin/content/items?slot=mains', undefined, tk)).j;
    expect(bySlot.find((x: any) => x.id === r1.j.id)).toBeTruthy();
    expect(bySlot.find((x: any) => x.id === r2.j.id)).toBeUndefined();

    // Décompte « détenu par » : l'objet est donné au personnage → holders = 1.
    await pool.query('INSERT INTO character_items(character_id,item_id,equipped_slot) VALUES ($1,$2,$3)', [cId, r1.j.id, 'mains']);
    expect((await call('/admin/content/items', undefined, tk)).j.find((x: any) => x.id === r1.j.id).holders).toBe(1);

    // usable_by est renvoyé (JSON) ; l'objet sans kind vaut « tout le monde ».
    expect(ub((await call('/admin/content/items', undefined, tk)).j.find((x: any) => x.id === r1.j.id).usable_by)).toEqual(['humain', 'ange']);
  });

  test('sorts : rareté + usableBy + filtre + décompte apprenants + édition', async () => {
    const r = await call('/admin/content/spells', { name: `Nova ${s}`, kind: 'blessure', rarity: 'legendaire', usableBy: ['demon', 'monstre'], energyCost: 40, damage: 90 }, tk);
    expect(r.status).toBe(200);
    spellIds = [r.j.id];
    expect(r.j.rarity).toBe('legendaire');
    expect(ub(r.j.usable_by)).toEqual(['demon', 'monstre']);

    expect((await call('/admin/content/spells?rarity=legendaire', undefined, tk)).j.find((x: any) => x.id === r.j.id)).toBeTruthy();
    expect((await call('/admin/content/spells?rarity=commun', undefined, tk)).j.find((x: any) => x.id === r.j.id)).toBeUndefined();

    // « appris par » : le personnage apprend le sort → learners = 1.
    await pool.query('INSERT INTO character_spells(character_id,spell_id) VALUES ($1,$2)', [cId, r.j.id]);
    expect((await call('/admin/content/spells', undefined, tk)).j.find((x: any) => x.id === r.j.id).learners).toBe(1);

    // Édition : rareté + usable_by (UPDATE CASE $10::jsonb).
    const up = await call(`/admin/content/spells/${r.j.id}`, { rarity: 'divin', usableBy: ['humain'] }, tk, 'PUT');
    expect(up.status).toBe(200);
    expect(up.j.rarity).toBe('divin');
    expect(ub(up.j.usable_by)).toEqual(['humain']);
  });

  test('validation : rareté libre sur items (legacy) mais bornée sur sorts ; usable_by hors kinds refusée', async () => {
    // items : rareté libre (valeur historique conservée) — 200.
    const legacy = await call('/admin/content/items', { name: `X ${s}`, rarity: 'unique' }, tk);
    expect(legacy.status).toBe(200);
    itemIds.push(legacy.j.id); // pas de fuite dans le catalogue partagé
    // spells : colonne fraîche → l'enum des 5 raretés est imposée.
    expect((await call('/admin/content/spells', { name: `X ${s}`, rarity: 'mythique' }, tk)).status).toBe(400);
    // usable_by : kinds inconnus refusés.
    expect((await call('/admin/content/items', { name: `X ${s}`, usable_by: ['alien'] }, tk)).status).toBe(400);
  });
});

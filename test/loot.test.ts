import { describe, test, expect, vi } from 'vitest';
vi.mock('../src/game/divine.js', () => ({
  grantDivine: vi.fn(async (_db: any, _to: number, _kind: string | null, divineId?: number) => ({ id: divineId, kind: 'relique' })),
  refreshSurcharge: vi.fn(async () => {}),
  held: vi.fn(async () => 0)
}));
let DROP_RATE = 1;
vi.mock('../src/game/content.js', () => ({ cfgNum: vi.fn(async (k: string, def?: number) => (k === 'drop_rate' ? DROP_RATE : def)) }));
import { rollLoot } from '../src/game/loot.js';
import { grantDivine } from '../src/game/divine.js';

const lootDb = (lootRows: any[], resources: Record<string, number> = {}) => {
  const calls: any[] = [];
  return {
    calls,
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT * FROM monster_loot')) return { rows: lootRows };
      if (sql.startsWith('SELECT resources FROM characters')) return { rows: [{ resources }] };
      if (sql.startsWith('UPDATE character_items')) return { rows: [], rowCount: 0 };   // pas de rang existant : la branche INSERT se joue
      return { rows: [], rowCount: 1 };
    }
  };
};

describe('rollLoot : or + entrées pondérées (× multiplicateur global drop_rate)', () => {
  test('or du monstre crédité au vainqueur', async () => {
    const db = lootDb([]);
    const out = await rollLoot(db, { id: 3, gold_current: 15 }, 9);
    expect(out).toContain('or 15');
    expect(db.calls[0].params).toEqual([9, 15]);
  });
  test('objet + ressource + divin à 100 % : upsert, incrément, transfert propre', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const db = lootDb([
      { item_id: 5, drop_rate: 100, qty_min: 1, qty_max: 2 },
      { resource: 'bois', drop_rate: 100, qty_min: 2, qty_max: 2 },
      { divine_id: 12, drop_rate: 100 }
    ], { bois: 1 });
    const out = await rollLoot(db, { id: 3, gold_current: 0 }, 9);
    expect(out).toEqual(expect.arrayContaining(['objet x1', 'bois x2', 'objet divin (transfert)']));
    expect(db.calls.find(c => c.sql.startsWith('INSERT INTO character_items')).params).toEqual([9, 5, 1]);
    expect(JSON.parse(db.calls.find(c => c.sql.startsWith('UPDATE characters SET resources')).params[1])).toEqual({ bois: 3 });
    expect(grantDivine).toHaveBeenCalledWith(db, 9, null, 12);   // UPDATE du holder, jamais d'insertion
    vi.restoreAllMocks();
  });
  test('0 % jamais tiré ; le multiplicateur global lève la probabilité', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);   // 50
    const db = lootDb([{ item_id: 5, drop_rate: 0 }, { item_id: 6, drop_rate: 50 }]);
    DROP_RATE = 2;   // 50 % × 2 = 100 % : la 2e entrée est tirée, la 1re (0 %) non
    const out = await rollLoot(db, { id: 3, gold_current: 0 }, 9);
    expect(out).toEqual(['objet x1']);
    DROP_RATE = 1; vi.restoreAllMocks();
  });
  test('ressource spéciale « or » : créditée en OR du vainqueur, pas dans le JSONB ressources', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const db = lootDb([{ resource: 'or', drop_rate: 100, qty_min: 7, qty_max: 7 }], {});
    const out = await rollLoot(db, { id: 3, gold_current: 0 }, 9);
    expect(out).toContain('or x7');
    const upd = db.calls.find(c => c.sql.startsWith('UPDATE characters SET gold=gold+'));
    expect(upd.params).toEqual([9, 7]);
    expect(db.calls.find(c => c.sql.startsWith('UPDATE characters SET resources'))).toBeUndefined();
    vi.restoreAllMocks();
  });
  test('un monstre sauvage (data.spawned) tire le butin de son prototype', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let lootParam: any = null;
    const db = {
      async query(sql: string, params: any[] = []) {
        if (sql.startsWith('SELECT * FROM monster_loot')) { lootParam = params[0]; return { rows: [{ item_id: 6, drop_rate: 100, qty_min: 1, qty_max: 1 }] }; }
        if (sql.startsWith('SELECT resources')) return { rows: [{ resources: {} }] };
        return { rows: [], rowCount: 1 };
      }
    } as any;
    await rollLoot(db, { id: 81, gold_current: 0, data: { spawned: true, prototype: 77 } }, 9);
    expect(lootParam).toBe(77);   // le tirage porte sur le prototype, pas sur l'instance (81)
    vi.restoreAllMocks();
  });
});

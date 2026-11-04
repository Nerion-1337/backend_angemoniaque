import { describe, test, expect } from 'vitest';
import { checkEntityCost, assertCap } from '../src/game/entity.js';

/** db factice : réponses en file (ordre des queries), capture des calls. */
const fakeDb = (answers: any[]) => {
  const calls: any[] = []; let i = 0;
  return {
    calls,
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params }); i += 1;
      return (i <= answers.length && answers[i - 1]) || { rows: [], rowCount: 0 };
    }
  };
};

describe('checkEntityCost : coûts transverses (or / ressources)', () => {
  test('vérifie la solvabilité et ne débite pas sans apply', async () => {
    const db = fakeDb([
      { rows: [{ resource: 'or', qty: 50 }, { resource: 'bois', qty: 3 }] },
      { rows: [{ gold: 100, resources: { bois: 10 } }] }
    ]);
    const cost = await checkEntityCost(db, 1, 'monster', 5);
    expect(cost).toEqual({ or: 50, bois: 3 });
    expect(db.calls.some(c => c.sql.startsWith('UPDATE'))).toBe(false);
  });
  test('débite or + ressources avec apply=true', async () => {
    const db = fakeDb([
      { rows: [{ resource: 'or', qty: 50 }, { resource: 'bois', qty: 3 }] },
      { rows: [{ gold: 100, resources: { bois: 10 } }] },
      { rowCount: 1 }
    ]);
    await checkEntityCost(db, 1, 'monster', 5, true);
    const upd = db.calls.find(c => c.sql.startsWith('UPDATE characters'));
    expect(upd.params).toEqual([1, 50, JSON.stringify({ bois: 7 })]);
  });
  test('échec 409 si or ou ressource insuffisants', async () => {
    const db = fakeDb([
      { rows: [{ resource: 'or', qty: 50 }, { resource: 'bois', qty: 3 }] },
      { rows: [{ gold: 20, resources: { bois: 1 } }] }
    ]);
    await expect(checkEntityCost(db, 1, 'monster', 5)).rejects.toThrow('Coût insuffisant');
  });
  test('coût nul = aucun contrôle', async () => {
    const db = fakeDb([{ rows: [] }]);
    expect(await checkEntityCost(db, 1, 'building', 9, true)).toEqual({});
  });
});

describe('assertCap : plafonds global / per_player / per_zone', () => {
  const caps = { rows: [{ scope: 'global', value: 2 }, { scope: 'per_player', value: 1 }] };
  test('rejette si le cap global est atteint (compteur positions+prototypes)', async () => {
    const db = fakeDb([caps, { rows: [{ n: 2 }] }]);
    await expect(assertCap(db, 'monster', 5)).rejects.toThrow('global');
  });
  test('rejette si le cap per_player est atteint (character_monster)', async () => {
    const db = fakeDb([caps, { rows: [{ n: 0 }] }, { rows: [{ n: 1 }] }]);
    await expect(assertCap(db, 'monster', 5, 7)).rejects.toThrow('per_player');
  });
  test('sans cap configuré : rien à vérifier', async () => {
    const db = fakeDb([{ rows: [] }]);
    await expect(assertCap(db, 'monster', 5, 7, 1)).resolves.toBeUndefined();
    expect(db.calls).toHaveLength(1);
  });
});

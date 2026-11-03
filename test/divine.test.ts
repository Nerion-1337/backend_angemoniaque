import { describe, test, expect, vi, beforeEach } from 'vitest';
vi.mock('../src/lib/db.js', async () => {
  const actual: any = await vi.importActual('../src/lib/db.js');
  return { ...actual, pool: { query: vi.fn() } };
});
import { pool } from '../src/lib/db.js';
import { bumpContent } from '../src/game/content.js';
import { grantDivine } from '../src/game/divine.js';

describe('grantDivine : transfert propre des objets divins (caps, jamais de duplication)', () => {
  beforeEach(async () => { (pool.query as any).mockReset(); bumpContent(); });
  const fakeDb = (held: number, free: boolean) => ({
    query: async (sql: string) => {
      if (sql.startsWith('SELECT count')) return { rows: [{ n: held }] };
      if (sql.startsWith('UPDATE divine_items')) return { rowCount: free ? 1 : 0, rows: free ? [{ id: 7 }] : [] };
      return { rows: [] };
    }
  });
  test("transfère le holder (UPDATE, pas d'insertion) et rejette si le cap est déjà atteint", async () => {
    (pool.query as any).mockResolvedValue({ rows: [{ key: 'divine_caps', value: { relique: 4 } }] });
    await expect(grantDivine(fakeDb(4, true), 9, 'relique')).rejects.toMatchObject({ status: 409 });
    const row = await grantDivine(fakeDb(1, true), 9, 'relique');
    expect(row.id).toBe(7);   // la même pièce change de détenteur : aucune duplication
  });
  test('409 si aucune pièce libre du kind', async () => {
    (pool.query as any).mockResolvedValue({ rows: [] });
    await expect(grantDivine(fakeDb(0, false), 9, 'arcane')).rejects.toMatchObject({ status: 409 });
  });
});

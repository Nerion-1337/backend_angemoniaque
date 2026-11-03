import { describe, test, expect, vi, beforeEach } from 'vitest';
vi.mock('../src/lib/db.js', async () => {
  const actual: any = await vi.importActual('../src/lib/db.js');
  return { ...actual, pool: { query: vi.fn() } };
});
import { pool } from '../src/lib/db.js';
import { cfgAll, cfgNum, bumpContent, divineCap } from '../src/game/content.js';

describe('game/content : cache des paramètres globaux', () => {
  beforeEach(() => { (pool.query as any).mockReset(); bumpContent(); });
  test('cfgAll lit game_config une seule fois puis met en cache ; bumpContent invalide', async () => {
    (pool.query as any).mockResolvedValue({ rows: [{ key: 'xp_rate', value: 2 }] });
    expect(await cfgNum('xp_rate', 1)).toBe(2);
    expect((pool.query as any)).toHaveBeenCalledTimes(1);
    await cfgAll(); expect((pool.query as any)).toHaveBeenCalledTimes(1);
    bumpContent();
    await cfgAll(); expect((pool.query as any)).toHaveBeenCalledTimes(2);
  });
  test('cfgNum retombe sur la valeur par défaut quand la clé est absente', async () => {
    (pool.query as any).mockResolvedValue({ rows: [] });
    expect(await cfgNum('inexistant', 7)).toBe(7);
  });
  test('divineCap lit divine_caps (plafond des objets uniques par kind)', async () => {
    (pool.query as any).mockResolvedValue({ rows: [{ key: 'divine_caps', value: { relique: 4, arcane: 4, artefact: 5 } }] });
    expect(await divineCap('relique')).toBe(4);
    expect(await divineCap('arcane')).toBe(4);
    expect(await divineCap('inconnu')).toBeNull();
  });
});

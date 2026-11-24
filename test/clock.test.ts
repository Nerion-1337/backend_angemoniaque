// Horloge du monde persistante : un tick par heure pleine écoulée, reste < 1 h conservé, borne de rattrapage.
import { describe, test, expect, vi } from 'vitest';
const state = { last: new Date('2026-01-01T00:00:00Z') };
vi.mock('../src/lib/db.js', async () => {
  const actual: any = await vi.importActual('../src/lib/db.js');
  const client = {
    async query(sql: string, p: any[] = []) {
      if (sql.startsWith('SELECT last_tick_at')) return { rows: [{ last_tick_at: state.last }] };
      if (sql.includes("interval '1 hour'")) { state.last = new Date(state.last.getTime() + 3600e3); return { rows: [] }; }
      if (sql.includes('make_interval')) { state.last = new Date(state.last.getTime() + p[0] * 3600e3); return { rows: [] }; }
      return { rows: [] };
    },
    release() {}
  };
  return { ...actual, pool: { connect: async () => client, query: vi.fn() } };
});
vi.mock('../src/routes/tick.js', () => ({ hourlyTick: async () => {} }));
import { catchUp, hoursDue, MAX_CATCHUP_H } from '../src/game/clock.js';

describe('horloge du monde', () => {
  test('hoursDue : heures pleines seulement, jamais négatif', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    expect(hoursDue(t0, new Date('2026-01-01T03:59:00Z'))).toBe(3);
    expect(hoursDue(t0, new Date('2025-12-31T23:00:00Z'))).toBe(0);
  });
  test('3 h 30 d’arrêt : 3 ticks, l’horloge avance de 3 h (les 30 min restent dues)', async () => {
    state.last = new Date('2026-01-01T00:00:00Z');
    let n = 0;
    expect(await catchUp(() => new Date('2026-01-01T03:30:00Z'), async () => { n++; })).toBe(3);
    expect(n).toBe(3);
    expect(state.last.toISOString()).toBe('2026-01-01T03:00:00.000Z');
    expect(await catchUp(() => new Date('2026-01-01T03:59:00Z'), async () => { n++; })).toBe(0);   // pas encore une heure pleine
    expect(await catchUp(() => new Date('2026-01-01T04:00:00Z'), async () => { n++; })).toBe(1);
  });
  test('arrêt plus long que la borne : seules les MAX_CATCHUP_H dernières heures sont rejouées', async () => {
    state.last = new Date('2026-01-01T00:00:00Z');
    const now = new Date(state.last.getTime() + (MAX_CATCHUP_H + 50) * 3600e3 + 600e3);
    let n = 0;
    expect(await catchUp(() => now, async () => { n++; })).toBe(MAX_CATCHUP_H);
    expect(hoursDue(state.last, now)).toBe(0);
  });
  test('un tick en échec arrête le rattrapage sans avancer l’horloge pour cette heure', async () => {
    state.last = new Date('2026-01-01T00:00:00Z');
    let n = 0;
    await expect(catchUp(() => new Date('2026-01-01T05:00:00Z'), async () => { if (++n === 3) throw new Error('boom'); })).rejects.toThrow('boom');
    expect(state.last.toISOString()).toBe('2026-01-01T02:00:00.000Z');   // 2 ticks réussis comptés, le 3e sera rejoué
  });
});

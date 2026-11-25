import { describe, test, expect, vi } from 'vitest';
// Étape 2 phase 3 — mort de monstre & réincarnation différée (combatlib/spawn, db mocké).
vi.mock('../src/game/content.js', () => ({ cfgNum: async (_k: string, def?: number) => def ?? 1, bumpContent: () => {} }));
import { applyDamage, scheduleRespawn } from '../src/game/combatlib.js';
import { reincarnateDue } from '../src/game/spawn.js';

const mockDb = () => {
  const calls: { sql: string; params: any[] }[] = [];
  return {
    calls,
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params });
      if (/^\s*SELECT/.test(sql)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    }
  };
};
const monster = (over: any = {}) =>
  ({ kind: 'monster', id: 3, row: { id: 3, hp_current: 10, hp_max: 100, data: {}, ...over },
    pos: {}, armor: 0, magicArmor: 0, agility: 0, name: 'Léviathan' } as any);
const has = (db: any, prefix: string) => db.calls.some((c: any) => c.sql.startsWith(prefix));

describe('mort d’un monstre (phase 3 : réincarnation différée)', () => {
  test('ancré sans délai : régénération instantanée (historique) + butin tiré à la mort', async () => {
    const db = mockDb();
    const r = await applyDamage(db, monster({ data: { placed: true, prototype: 1 }, gold_current: 15 }), 100, 9);
    expect(r.killed).toBe(true);
    expect(has(db, 'UPDATE monsters SET hp_current=hp_max')).toBe(true);   // regen instantanée
    expect(has(db, 'INSERT INTO monster_respawns')).toBe(false);
    expect(has(db, 'SELECT * FROM monster_loot')).toBe(true);            // butin tiré
    expect(has(db, 'UPDATE characters SET gold')).toBe(true);           // or crédité au vainqueur
  });

  test('posé avec délai (réglage de CE monstre, migration 35) : mort + échéance programmée (le butin reste tiré à la mort ; le corps repart vide)', async () => {
    const db = mockDb();
    const r = await applyDamage(db, monster({ data: { placed: true, prototype: 1 }, reincarnate_delay_h: 2, gold_current: 15 }), 100, 9);
    expect(r.killed).toBe(true);
    expect(has(db, 'INSERT INTO monster_respawns')).toBe(true);
    const q = db.calls.find((c: any) => c.sql.startsWith('INSERT INTO monster_respawns'));
    expect(q.params).toEqual([3, 2]);                                     // (monstre, délai heures)
    expect(has(db, 'UPDATE monsters SET hp_current=hp_max')).toBe(false); // reste mort (PV 0) jusqu’à due_at
    expect(has(db, 'SELECT * FROM monster_loot')).toBe(true);            // la récompense est normale à la mort
  });

  test('déjà mort (en attente de réincarnation) : le butin ne se retoue JAMAIS, l’échéance est rafraîchie', async () => {
    const db = mockDb();
    await applyDamage(db, monster({ hp_current: 0, data: { placed: true }, reincarnate_delay_h: 2 }), 50, 9);
    expect(has(db, 'INSERT INTO monster_respawns')).toBe(true);          // ON CONFLICT → due_at rafraîchi
    expect(has(db, 'SELECT * FROM monster_loot')).toBe(false);
    expect(has(db, 'INSERT INTO history_action')).toBe(false);
  });

  test('sauvage (spawned) : suppression classique, aucune réincarnation', async () => {
    const db = mockDb();
    await applyDamage(db, monster({ data: { spawned: true, prototype: 1 }, gold_current: 5 }), 100, 9);
    expect(has(db, 'DELETE FROM monsters WHERE id=$1')).toBe(true);
    expect(has(db, 'INSERT INTO monster_respawns')).toBe(false);
  });
});

describe('réincarnation à l’échéance (tick horaire)', () => {
  test('reincarnateDue : PV complets + suppression de l’échéance', async () => {
    const calls: any[] = [];
    const db = {
      async query(sql: string, params: any[] = []) {
        calls.push({ sql, params });
        if (sql.includes('FROM monster_respawns')) return { rows: [{ monster_id: 3 }, { monster_id: 4 }] };
        return { rows: [], rowCount: 1 };
      }
    };
    const n = await reincarnateDue(db);
    expect(n).toBe(2);
    expect(calls.filter(c => c.sql.startsWith('UPDATE monsters SET hp_current=hp_max')).map(c => c.params[0])).toEqual([3, 4]);
    expect(calls.filter(c => c.sql.startsWith('DELETE FROM monster_respawns')).length).toBe(2);
  });

  test('reincarnateDue : rien à faire quand aucune échéance n’est atteinte', async () => {
    const n = await reincarnateDue({ async query() { return { rows: [] }; } });
    expect(n).toBe(0);
  });

  test('scheduleRespawn : même monstre → ON CONFLICT rafraîchit due_at (pas de doublon)', async () => {
    const db = mockDb();
    await scheduleRespawn(db, 7, 1);
    await scheduleRespawn(db, 7, 4);
    const q = db.calls.filter(c => c.sql.startsWith('INSERT INTO monster_respawns'));
    expect(q.length).toBe(2);
    expect(q[1].sql).toContain('ON CONFLICT (monster_id) DO UPDATE');
    expect(q[1].params).toEqual([7, 4]);
  });
});

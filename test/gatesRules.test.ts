import { describe, test, expect } from 'vitest';
import { realmStatus, facing, pactRealm } from '../src/game/gates';
import { deathLoss } from '../src/game/divine';
const soon = new Date(Date.now() + 3600e3).toISOString(), later = new Date(Date.now() + 7200e3).toISOString();
const d = (id: number, realm: string, leads_to: string, placed = true, open_until: string | null = null) => ({ id, name: `P${id}`, realm, leads_to, placed, open: placed && !!open_until, open_until });
const world = () => [d(1, 'human', 'demon'), d(2, 'human', 'demon'), d(3, 'human', 'angel'), d(4, 'human', 'angel'), d(5, 'demon', 'human'), d(6, 'angel', 'human'), d(7, 'dead', null as any)];
describe('Portes (pur)', () => {
  test('portes en face : Hommes→Démons ↔ porte des Démons', () => {
    const w = world(); expect(facing(w, w[0]).map(x => x.id)).toEqual([5]); expect(facing(w, w[4]).map(x => x.id)).toEqual([1, 2]); expect(facing(w, w[6])).toEqual([]);
  });
  test('pactes : suspendus si la porte du camp, ou TOUTES les portes des Hommes vers lui, sont détruites', () => {
    const w = world(); expect(realmStatus(w).demon.pactsOn).toBe(true); expect(realmStatus(w).demigod.pactsOn).toBe(false);
    w[0].placed = false; expect(realmStatus(w).demon.pactsOn).toBe(true);
    w[1].placed = false; expect(realmStatus(w).demon.pactsOn).toBe(false); expect(realmStatus(w).angel.pactsOn).toBe(true);
    const v = world(); v[5].placed = false; expect(realmStatus(v).angel).toMatchObject({ pactsOn: false, reason: expect.stringMatching(/P6 détruite/) });
    for (const x of v.filter(x => x.realm === 'human')) x.placed = false; expect(realmStatus(v).demigod.pactsOn).toBe(true);
  });
  test('alliance : jusqu’à la première fermeture des deux côtés', () => {
    const w = world(); w[4] = d(5, 'demon', 'human', true, later); expect(realmStatus(w).demon.allianceUntil).toBeNull();
    w[1] = d(2, 'human', 'demon', true, soon); expect(realmStatus(w).demon.allianceUntil?.toISOString()).toBe(soon);
    expect(realmStatus(w).angel.allianceUntil).toBeNull();
  });
  test('camp d’un pacte et perte à la mort', () => {
    expect(pactRealm('human')).toBe('demigod'); expect(pactRealm('angel')).toBe('angel');
    expect(deathLoss(1000, 401, 25)).toEqual({ xp: 250, gold: 100 }); expect(deathLoss(-5, 0, 25)).toEqual({ xp: 0, gold: 0 }); expect(deathLoss(7, 7, 0)).toEqual({ xp: 0, gold: 0 });
  });
});

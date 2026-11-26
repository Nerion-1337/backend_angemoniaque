import { describe, test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { passwordProblems, passwordBits, leadingZeroBits, issueChallenge, verifyPow, RULES } from '../src/lib/security';
// Politique de mot de passe, preuve de travail anti-robot, règles de limitation (fonctions pures / sans base).
const solve = (token: string) => { const s = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()); for (let n = 0; ; n++) if (leadingZeroBits(createHash('sha256').update(`${s.s}:${n}`).digest()) >= s.b) return n; };
describe('mot de passe', () => {
  test('refusés : court, peu varié, courant, suite, répétition, email ; accepté : long et varié', () => {
    expect(passwordProblems('Ab1!')).toContain('12 caractères minimum');
    expect(passwordProblems('abcdefghijklmnop').join()).toMatch(/3 types/);
    expect(passwordProblems('MonPassword2026!').join()).toMatch(/courant/);
    expect(passwordProblems('Zx1234Qw!rtyuP').join()).toMatch(/suite/);
    expect(passwordProblems('Aaaaa!9Bbcdefgh').join()).toMatch(/identiques/);
    expect(passwordProblems('Martin-Lion-77!', 'martin@x.fr').join()).toMatch(/email/);
    expect(passwordProblems('Lune-Brisee-2026!')).toEqual([]);
    expect(passwordBits('Lune-Brisee-2026!')).toBeGreaterThanOrEqual(60);
  });
});
describe('preuve de travail', () => {
  test('résolue → acceptée une seule fois ; falsifiée, insuffisante ou expirée → refusée', async () => {
    const c = issueChallenge(10), n = solve(c.token);
    expect(await verifyPow(c.token, n)).toBeNull();
    expect(await verifyPow(c.token, n)).toMatch(/déjà utilisée/);
    const d = issueChallenge(12); expect(await verifyPow(d.token.replace(/.$/, x => (x === 'A' ? 'B' : 'A')), 0)).toMatch(/invalide/);
    let bad = 0; const s = JSON.parse(Buffer.from(d.token.split('.')[0], 'base64url').toString()); while (leadingZeroBits(createHash('sha256').update(`${s.s}:${bad}`).digest()) >= 12) bad++;
    expect(await verifyPow(d.token, bad)).toMatch(/échouée/);
    expect(await verifyPow(issueChallenge(8, -1).token, 0)).toMatch(/expirée/);
    expect(await verifyPow(undefined, undefined)).toMatch(/manquante/);
  });
  test('règles de débit : inscription, connexion, messages, forum présentes', () => {
    const names = RULES.map(r => r.name); for (const n of ['global', 'register', 'login', 'chat', 'ftopic', 'fpost', 'gpost', 'writes']) expect(names).toContain(n);
  });
});

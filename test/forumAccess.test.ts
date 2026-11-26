import { describe, test, expect } from 'vitest';
import { readDenied, postDenied, ANON } from '../src/game/forumAccess';
import { checkClaims, authUrl } from '../src/routes/google';
// Droits du forum public (migration 40) et contrôles de la connexion Google (migration 39) : fonctions pures.
const cat = (o: any = {}) => ({ read_access: 'public', post_access: 'members', races: [], min_rank: 1, locked: false, hidden: false, ...o });
const player = (o: any = {}) => ({ logged: true, role: 'player', races: ['human'], rank: 2, tos: true, muted: false, ...o });
describe('forum : lecture', () => {
  test('public lisible sans compte ; membres, races, rang exigent un compte conforme', () => {
    expect(readDenied(cat(), ANON)).toBeNull();
    expect(readDenied(cat({ read_access: 'members' }), ANON)).toMatch(/Connectez-vous/);
    expect(readDenied(cat({ races: ['demon'] }), player())).toMatch(/races/);
    expect(readDenied(cat({ races: ['demon', 'human'] }), player())).toBeNull();
    expect(readDenied(cat({ min_rank: 3 }), player())).toMatch(/rang 3/);
    expect(readDenied(cat({ min_rank: 3 }), player({ rank: 3 }))).toBeNull();
  });
  test('masqué ou réservé à l’équipe : staff seulement (mod et admin passent outre tout)', () => {
    for (const o of [{ hidden: true }, { read_access: 'staff' }]) { expect(readDenied(cat(o), player())).toBeTruthy(); expect(readDenied(cat(o), player({ role: 'mod' }))).toBeNull(); }
    expect(readDenied(cat({ races: ['angel'], min_rank: 5 }), player({ role: 'admin', races: [], rank: 0 }))).toBeNull();
  });
});
describe('forum : écriture', () => {
  test('compte, CGU, sourdine, annonces réservées à l’équipe, verrous', () => {
    expect(postDenied(cat(), ANON)).toMatch(/Connectez-vous/);
    expect(postDenied(cat(), player({ tos: false }))).toMatch(/conditions générales/);
    expect(postDenied(cat(), player({ muted: true }))).toMatch(/sourdine/);
    expect(postDenied(cat({ post_access: 'staff' }), player())).toMatch(/équipe/);
    expect(postDenied(cat({ locked: true }), player())).toMatch(/verrouillée/);
    expect(postDenied(cat(), player(), { locked: true })).toMatch(/Sujet verrouillé/);
    expect(postDenied(cat(), player())).toBeNull();
    expect(postDenied(cat({ post_access: 'staff', locked: true }), player({ role: 'mod', tos: false }), { locked: true })).toBeNull();
  });
});
describe('connexion Google', () => {
  const ok = { aud: 'cid', iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), sub: '42', email: 'a@b.fr', email_verified: 'true' };
  test('jeton : audience, émetteur, expiration, email vérifié', () => {
    expect(checkClaims(ok, 'cid')).toBeNull();
    expect(checkClaims({ ...ok, aud: 'autre' }, 'cid')).toMatch(/autre application/);
    expect(checkClaims({ ...ok, iss: 'evil' }, 'cid')).toMatch(/Émetteur/);
    expect(checkClaims({ ...ok, exp: '1' }, 'cid')).toMatch(/expiré/);
    expect(checkClaims({ ...ok, email_verified: false }, 'cid')).toMatch(/non vérifié/);
  });
  test('URL d’autorisation : client, redirection, portée openid email, état', () => {
    const u = new URL(authUrl('cid', 'https://jeu.fr/api/auth/google/callback', 'st'));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: 'cid', redirect_uri: 'https://jeu.fr/api/auth/google/callback', response_type: 'code', scope: 'openid email profile', state: 'st' });
  });
});

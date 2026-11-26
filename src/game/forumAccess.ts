/**
 * Droits du forum public (migration 40) — fonctions pures.
 * Visiteur = { logged, role, races (races des personnages du compte), rank (rang max), tos (CGU acceptées à jour), muted }.
 * Staff = rôles mod et admin : voit tout (catégories, sujets et messages masqués), écrit partout, même verrouillé.
 * Lecture : catégorie masquée → staff ; read_access public / members (connecté) / staff ; races (vide = toutes : un des
 * personnages du compte doit être de l'une d'elles) et rang minimal (rang max des personnages) → connecté et conforme.
 * Écriture : lecture permise + connecté + CGU acceptées + pas en sourdine + post_access (members / staff) + catégorie et sujet
 * non verrouillés.
 */
export type Viewer = { logged: boolean; role: string; races: string[]; rank: number; tos: boolean; muted: boolean };
export type Cat = { read_access: string; post_access: string; races: string[] | null; min_rank: number; locked: boolean; hidden: boolean };
export const ANON: Viewer = { logged: false, role: 'guest', races: [], rank: 0, tos: false, muted: false };
export const isStaff = (v: Viewer) => v.role === 'mod' || v.role === 'admin';
/** Raison du refus de lecture, ou null. */
export function readDenied(cat: Cat, v: Viewer): string | null {
  if (isStaff(v)) return null;
  if (cat.hidden) return 'Catégorie réservée à l\'équipe';
  if (cat.read_access === 'staff') return 'Catégorie réservée à l\'équipe';
  const races = cat.races ?? [], restricted = cat.read_access === 'members' || races.length > 0 || cat.min_rank > 1;
  if (restricted && !v.logged) return 'Connectez-vous pour lire cette catégorie';
  if (races.length && !races.some(r => v.races.includes(r))) return 'Catégorie réservée à certaines races';
  if (cat.min_rank > 1 && v.rank < cat.min_rank) return `Catégorie réservée au rang ${cat.min_rank} et plus`;
  return null;
}
/** Raison du refus d'écriture (nouveau sujet ou réponse), ou null. */
export function postDenied(cat: Cat, v: Viewer, topic?: { locked: boolean; hidden?: boolean } | null): string | null {
  const r = readDenied(cat, v); if (r) return r;
  if (!v.logged) return 'Connectez-vous pour écrire';
  if (isStaff(v)) return null;
  if (!v.tos) return 'Acceptez les conditions générales d\'utilisation pour écrire';
  if (v.muted) return 'Votre compte est en sourdine sur le forum';
  if (cat.post_access === 'staff') return 'Seule l\'équipe publie ici';
  if (cat.locked) return 'Catégorie verrouillée';
  if (topic?.locked) return 'Sujet verrouillé';
  if (topic?.hidden) return 'Sujet masqué';
  return null;
}

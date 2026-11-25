// Niveaux verticaux (miroir de front/src/lib/levels.js:levelAt — garder les deux identiques) : sol 0 ; eau peu profonde −1
// (−2 au contact de l'eau profonde) ; eau profonde −4 ; massifs de +1 au bord à +5 au cœur (lave plate +1) ; volants au niveau +6.
import { terrain } from './terrain.js';
export const FLY_LEVEL = 6;
const ROCK = new Set(['mountain', 'snow', 'ether', 'volcano']);
const memo = new Map<string, number>();
const ring = (x: number, y: number, m: number, r: number, f: (k: string) => boolean) => { for (let i = -r; i <= r; i++) for (const [dx, dy] of [[i, -r], [i, r], [-r, i], [r, i]]) if (f(terrain(x + dx, y + dy, m).kind)) return true; return false; };
export function levelAt(x: number, y: number, m: number): number {
  const k = `${m}:${x},${y}`; let v = memo.get(k); if (v !== undefined) return v;
  const t: any = terrain(x, y, m);
  if (t.kind === 'deep') v = -4;
  else if (t.kind === 'shallow') v = ring(x, y, m, 1, kd => kd === 'deep') ? -2 : -1;
  else if (ROCK.has(t.kind)) { v = 5; if (t.flat) v = 1; else for (let r = 1; r <= 4; r++) if (ring(x, y, m, r, kd => !ROCK.has(kd))) { v = r; break; } }
  else v = 0;
  if (memo.size > 300000) memo.clear(); memo.set(k, v); return v;
}
/**
 * Hauteur du héros → +1 vision et +1 portée par niveau : sol de la case (jamais négatif), +taille de la monture terrestre /
 * aquatique (1 à 3) ; sur une monture volante, niveau +6 quel que soit le sol. Renvoie les apports détaillés.
 */
export function heightParts(mapId: number, x: number, y: number, mount: any) {
  if (mount?.flying) return [{ label: `Monture volante : ${mount.name} (niveau +${FLY_LEVEL})`, value: FLY_LEVEL, kind: 'height' }];
  const out: { label: string; value: number; kind: string }[] = [], l = Math.max(0, levelAt(x, y, mapId));
  if (l) out.push({ label: `Hauteur du terrain (niveau +${l})`, value: l, kind: 'height' });
  if (mount) { const s = Math.min(3, Math.max(1, Number(mount.size) || 1)); out.push({ label: `Sur ${mount.name} (taille ${s})`, value: s, kind: 'mount' }); }
  return out;
}

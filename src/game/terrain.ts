// ⚠ GÉNÉRÉ par tools/gen_human_map.py — copie identique dans backend/src/game/terrain.ts et frontend/src/lib/terrain.js. Ne pas éditer à la main.
// Monde des Hommes (carte 1) : grille dessinée (humanMap) ; autres mondes : bruit procédural d'origine.
import { W, H, ROWS, CODES, FEATURES } from './humanMap.js';
import { RES_BY_ID } from './resources.js'; import { terrain2, noise2 } from './world2.js';
export { FEATURES };
export const MAP_HUMAN = 1;
let WORLD = MAP_HUMAN;
/** Monde « courant » : le front l'appelle à chaque rafraîchissement du personnage ; le back passe toujours mapId explicitement. */
export const setWorld = id => { WORLD = id ?? MAP_HUMAN; };
export const BURN_DAMAGE = 10;       // dégâts de brûlure par heure (case de volcan)
export const KIND_COST = { plain: 1, forest: 2, mountain: 3, arid: 2, snow: 3, ether: 3, volcano: 3, shallow: 4, deep: 99 };
export const KIND_LABEL = { plain: 'Plaine', forest: 'Forêt', mountain: 'Massif rocheux', arid: 'Terre aride', snow: 'Pics glacés', ether: 'Pics d’éther', volcano: 'Volcan (brûlure)', shallow: 'Eau peu profonde', deep: 'Eau profonde' };
const mk = (kind, id = null) => Object.freeze({ kind, cost: KIND_COST[kind], resourceId: id, resource: id ? RES_BY_ID[id].name : null, burn: kind === 'volcano' ? BURN_DAMAGE : 0 });
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };

// ---------- Monde des Hommes : grille décodée une seule fois (RLE par ligne) ----------
const CELLS = new Uint8Array(W * H);
ROWS.forEach((row, y) => { let x = 0; for (const m of row.matchAll(/(\D)(\d+)/g)) { const n = +m[2]; CELLS.fill(m[1].charCodeAt(0), y * W + x, y * W + x + n); x += n; } });
const BY_CODE = {};
for (const c of Object.keys(CODES)) BY_CODE[c.charCodeAt(0)] = mk(CODES[c][0], CODES[c][1]);
const VOID = mk('deep');
const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const humanCell = (x, y) => (inMap(x, y) ? BY_CODE[CELLS[y * W + x]] : VOID);
// Élévation logique par type de case [base, amplitude] : mêmes seuils que le bruit d'origine (eau < 0.22, plaine < 0.58, forêt < 0.74, massif au-delà).
const VR = { deep: [0.05, 0.08], shallow: [0.16, 0.05], plain: [0.3, 0.2], arid: [0.3, 0.2], forest: [0.6, 0.12], mountain: [0.76, 0.12], snow: [0.82, 0.13], ether: [0.84, 0.14], volcano: [0.78, 0.14] };
const V = new Float32Array(W * H);
for (let i = 0; i < V.length; i++) { const r = VR[BY_CODE[CELLS[i]].kind]; V[i] = r[0] + r[1] * hash(i % W, Math.floor(i / W)); }
const vAt = (x, y) => (inMap(x, y) ? V[y * W + x] : 0.05);

// ---------- Autres mondes : bruit procédural d'origine ----------
const h0 = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
function procNoise(x, y) {
  const s = 8, gx = Math.floor(x / s), gy = Math.floor(y / s), ex = x / s - gx, ey = y / s - gy, fx = ex * ex * (3 - 2 * ex), fy = ey * ey * (3 - 2 * ey);
  return h0(gx, gy) * (1 - fx) * (1 - fy) + h0(gx + 1, gy) * fx * (1 - fy) + h0(gx, gy + 1) * (1 - fx) * fy + h0(gx + 1, gy + 1) * fx * fy;
}
const POOL = {
  plain: ['pissenlit_tempete', 'lavande_crepusculaire', 'tresle_six_feuilles'], forest: ['lorien', 'shinju', 'adam', 'weirwood'],
  mountain: ['adamantine', 'mithril', 'uru', 'ebonite'], shallow: ['nenuphar_spectres', 'gingembre_marees'], deep: ['granit_marin', 'corail_abyssal', 'sable_noir', 'perle_ecume'],
};
const PROC = {};
for (const k of Object.keys(POOL)) PROC[k] = POOL[k].map(id => mk(k, id));

/** Scalaire d'élévation (0..1) ; interpolé entre les cases, exact aux coordonnées entières. */
export function noiseAt(x, y, mapId = WORLD) {
  if (mapId === 2) return noise2(x, y);
  if (mapId !== MAP_HUMAN) return procNoise(x, y);
  const x0 = Math.floor(x), y0 = Math.floor(y), ex = x - x0, ey = y - y0, fx = ex * ex * (3 - 2 * ex), fy = ey * ey * (3 - 2 * ey);
  return vAt(x0, y0) * (1 - fx) * (1 - fy) + vAt(x0 + 1, y0) * fx * (1 - fy) + vAt(x0, y0 + 1) * (1 - fx) * fy + vAt(x0 + 1, y0 + 1) * fx * fy;
}
/** { kind, cost, resource (nom affiché), resourceId (clé stable), burn } — objet partagé et figé. */
export function terrain(x, y, mapId = WORLD) {
  if (mapId === MAP_HUMAN) return humanCell(x, y);
  if (mapId === 2) return terrain2(x, y);
  const v = procNoise(x, y), k = v < 0.14 ? 'deep' : v < 0.22 ? 'shallow' : v < 0.58 ? 'plain' : v < 0.74 ? 'forest' : 'mountain', a = PROC[k];
  return a[Math.floor(h0(x + 11.3, y + 5.7) * a.length) % a.length];
}

// ---------- Zone sacrée : aucun combat entre joueurs (personnages et invocations) autour de l'Hôtel de ville ----------
export const SAFE_ZONES = [{ map: MAP_HUMAN, x: FEATURES.hotel.x, y: FEATURES.hotel.y, r: FEATURES.safeRadius }];
export const inSafeZone = (mapId, x, y) => SAFE_ZONES.some(z => z.map === mapId && Math.max(Math.abs(x - z.x), Math.abs(y - z.y)) <= z.r);

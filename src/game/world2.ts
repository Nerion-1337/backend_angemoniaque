// ⚠ GÉNÉRÉ par tools/gen_angel_demon_map.py — copie identique dans backend/src/game/world2.ts et frontend/src/lib/world2.js. Ne pas éditer à la main.
// Monde des Anges et des Démons (carte 2, 300x300) : grille de ZONES ; la ressource d'une case est tirée dans les ressources de sa zone,
// avec un hash ENTIER (pas de Math.sin) pour que serveur et navigateurs voient exactement la même chose.
import { W2, H2, ROWS2 } from './angelDemonMap.js';
import { ZONES2, RES2_BY_ID } from './resources2.js';
export const MAP_ANGDEM = 2;
const COST = { plain: 1, forest: 2, mountain: 3, arid: 2, snow: 3, ether: 3, volcano: 3, shallow: 4, deep: 99 }, BURN = 10;   // identiques à terrain.* (testé)
const ihash = (x, y, s) => { let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const CELLS = new Uint8Array(W2 * H2);
ROWS2.forEach((row, y) => { let x = 0; for (const m of row.matchAll(/(\D)(\d+)/g)) { const n = +m[2]; CELLS.fill(m[1].charCodeAt(0), y * W2 + x, y * W2 + x + n); x += n; } });

/** Objet de case (partagé, figé) : mêmes champs que terrain.* + zone/ground/rock/grass/lone/flat pour l'affichage. */
const mk = (z, rid) => Object.freeze({ kind: z.kind, cost: COST[z.kind], resourceId: rid, resource: RES2_BY_ID[rid].name, burn: z.kind === 'volcano' ? BURN : 0,
  zone: z.label, zoneId: z.id, ground: z.ground, rock: z.rock ?? null, grass: z.grass ?? null, lone: z.lone ?? null, flat: !!z.flat });
const ZBY = {};
for (const z of ZONES2) {
  const items = z.res.map(([id, w]) => ({ obj: mk(z, id), w: +w })), rare = items.filter(i => i.w < 20), common = items.filter(i => i.w >= 20);
  ZBY[z.c.charCodeAt(0)] = { kind: z.kind, rare, common, rareSum: rare.reduce((a, i) => a + i.w, 0) / 100, commonSum: common.reduce((a, i) => a + i.w, 0), only: items.length === 1 ? items[0].obj : null };
}
const VOID = Object.freeze({ kind: 'deep', cost: COST.deep, resourceId: null, resource: null, burn: 0, zone: null, zoneId: null, ground: null, rock: null, grass: null, lone: null, flat: false });
const inMap = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2;

function pick(z, x, y) {
  if (z.only) return z.only;
  const r = ihash(x, y, 1);
  if (r < z.rareSum) { let a = 0; for (const it of z.rare) { a += it.w / 100; if (r < a) return it.obj; } }
  const q = ihash((x + (y >> 3) * 3) >> 2, (y + (x >> 3) * 5) >> 2, 2) * z.commonSum;     // taches irrégulières d'environ 4 cases
  let a = 0; for (const it of z.common) { a += it.w; if (q < a) return it.obj; }
  return z.common[z.common.length - 1].obj;
}
export const terrain2 = (x, y) => (inMap(x, y) ? pick(ZBY[CELLS[y * W2 + x]], x, y) : VOID);

// Élévation logique par type de case [base, amplitude] (mêmes seuils que les autres mondes : eau < 0.22, plaine < 0.58, forêt < 0.74, massif au-delà).
// La lave est en contrebas (cratères, rivières) : elle ne forme pas de crêtes.
const VR = { deep: [0.05, 0.08], shallow: [0.16, 0.05], plain: [0.3, 0.2], arid: [0.3, 0.2], forest: [0.6, 0.12], mountain: [0.76, 0.12], snow: [0.82, 0.13], ether: [0.84, 0.14], volcano: [0.36, 0.1] };
const V = new Float32Array(W2 * H2);
for (let i = 0; i < V.length; i++) { const r = VR[ZBY[CELLS[i]].kind]; V[i] = r[0] + r[1] * ihash(i % W2, Math.floor(i / W2), 3); }
const vAt = (x, y) => (inMap(x, y) ? V[y * W2 + x] : 0.05);
/** Scalaire d'élévation (0..1) ; interpolé entre les cases, exact aux coordonnées entières. */
export function noise2(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), ex = x - x0, ey = y - y0, fx = ex * ex * (3 - 2 * ex), fy = ey * ey * (3 - 2 * ey);
  return vAt(x0, y0) * (1 - fx) * (1 - fy) + vAt(x0 + 1, y0) * fx * (1 - fy) + vAt(x0, y0 + 1) * (1 - fx) * fy + vAt(x0 + 1, y0 + 1) * fx * fy;
}

// Eau : sombre et rougeâtre côté démons, claire côté anges, violacée sur la frontière (le Voile) — fondu progressif.
const lerpHex = (a, b, t) => { const c = s => ((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t); return (Math.round(c(16)) << 16) | (Math.round(c(8)) << 8) | Math.round(c(0)); };
export const FRONTIER_X = 150;
export function waterTint(mapId, x) {
  if (mapId !== MAP_ANGDEM) return 0x2a7fa3;
  const t = Math.min(1, Math.max(0, (x - (FRONTIER_X - 40)) / 80));
  return t < 0.5 ? lerpHex(0x5c1620, 0x4a4a78, t * 2) : lerpHex(0x4a4a78, 0x86d4f0, (t - 0.5) * 2);
}

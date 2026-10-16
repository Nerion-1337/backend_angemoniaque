// Terrain procédural déterministe (dupliqué à l'identique côté front : src/lib/terrain.js)
const h = (x: number, y: number) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
function smooth(x: number, y: number) {
  const s = 8, gx = Math.floor(x / s), gy = Math.floor(y / s), fx = x / s - gx, fy = y / s - gy;
  return h(gx, gy) * (1 - fx) * (1 - fy) + h(gx + 1, gy) * fx * (1 - fy) + h(gx, gy + 1) * (1 - fx) * fy + h(gx + 1, gy + 1) * fx * fy;
}
export type Terrain = { kind: 'plain' | 'forest' | 'mountain' | 'lake'; cost: number; resource: string | null };
export function terrain(x: number, y: number): Terrain {
  const v = smooth(x, y);
  if (v < 0.22) return { kind: 'lake', cost: 99, resource: 'eau' };
  if (v < 0.6) return { kind: 'plain', cost: 1, resource: 'herbe' };
  if (v < 0.78) return { kind: 'forest', cost: 2, resource: 'bois' };
  return { kind: 'mountain', cost: 3, resource: 'pierre' };
}

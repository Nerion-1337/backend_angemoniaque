import { describe, test, expect } from 'vitest';
import { dist3, groundReach, powerAt, mountElevation } from '../src/game/reach.js';
// Portée 3D (Pythagore) et puissance des armes à distance (migration 36).
describe('portée et hauteur', () => {
  test('cavalier (hauteur 1) collé : hors de portée 1, à portée 2 ; à 2 cases au sol : portée 2 ne suffit pas', () => {
    expect(dist3(1, 1)).toBeCloseTo(1.414, 3);
    expect(dist3(1, 1) <= 1).toBe(false); expect(dist3(1, 1) <= 2).toBe(true);
    expect(dist3(2, 1) <= 2).toBe(false); expect(dist3(2, 0) <= 2).toBe(true);
  });
  test('distance au sol atteignable selon la portée et l\'écart de hauteur', () => {
    expect(groundReach(1, 0)).toBe(1); expect(groundReach(1, 1)).toBe(0); expect(groundReach(2, 1)).toBe(1);
    expect(groundReach(5, 0)).toBe(5); expect(groundReach(6, 6)).toBe(0); expect(groundReach(7, 6)).toBe(3);   // volant (niveau 6) : √(3²+6²) ≈ 6,7 ≤ 7
  });
  test('hauteur d\'une monture : à pied 0, taille 1 à 3, volante 6', () => {
    expect(mountElevation(null)).toBe(0); expect(mountElevation({ size: 2 })).toBe(2); expect(mountElevation({ size: 9 })).toBe(3); expect(mountElevation({ flying: true, size: 1 })).toBe(6);
  });
  test('puissance : 100 % jusqu\'à la pleine puissance, puis baisse linéaire jusqu\'à 50 % à la portée max', () => {
    expect(powerAt(3, 6, 3)).toBe(100); expect(powerAt(6, 6, 3)).toBe(50); expect(powerAt(4.5, 6, 3)).toBe(75);
    expect(powerAt(6, 6, null)).toBe(100); expect(powerAt(9, 6, 3)).toBe(50);
  });
});

import { describe, test, expect } from 'vitest';
import { buildingGains } from '../src/routes/tick.js';

describe('production des bâtiments (tick horaire)', () => {
  test('buildingGains fusionne production et collection par ressource', () => {
    expect(buildingGains({ production: { or: 2 }, collection: { lorien: 3, or: 1 } })).toEqual({ or: 3, lorien: 3 });
    expect(buildingGains({ production: {} })).toEqual({});
    expect(buildingGains(null)).toEqual({});
  });
});

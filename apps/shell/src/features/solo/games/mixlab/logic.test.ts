import { describe, expect, it } from 'vitest';
import { BASICS, byId, hint, ITEMS, mix } from './logic';

describe('Mix Lab', () => {
  it('has four basics and 80 to 140 things, each with its own id, picture and name', () => {
    expect(BASICS).toEqual(['water', 'fire', 'earth', 'air']);
    expect(ITEMS.length).toBeGreaterThanOrEqual(80);
    expect(ITEMS.length).toBeLessThanOrEqual(140);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    expect(new Set(ITEMS.map((i) => i.name)).size).toBe(ITEMS.length);
    for (const i of ITEMS) for (const x of i.from ?? []) expect(byId.has(x), `${i.id} needs ${x}`).toBe(true);
  });

  it('mixes in either order; some things don’t mix', () => {
    expect(mix('water', 'fire')).toBe('steam');
    expect(mix('fire', 'water')).toBe('steam');
    expect(mix('water', 'water')).toBe('sea');
    expect(mix('cat', 'rocket')).toBeNull();
  });

  it('no two recipes are the same pair', () => {
    const pairs = ITEMS.filter((i) => i.from).map((i) => [...i.from!].sort().join('+'));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('every thing can be found from the four basics, and the hints lead there', () => {
    let found = [...BASICS];
    for (let i = 0; i < ITEMS.length; i++) {
      const h = hint(found);
      if (!h) break;
      expect(mix(h[0], h[1])).toBe(h[2]);
      found = [...found, h[2]];
    }
    expect(found.length).toBe(ITEMS.length);
    expect(hint(found)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { mapsLink, tileOf } from './location';

describe('location', () => {
  it('finds the OpenStreetMap tile for a point', () => {
    // India Gate, New Delhi at zoom 15
    const t = tileOf(28.6129, 77.2295, 15);
    expect(t).toMatchObject({ x: 23413, y: 13664 }); // matches the OSM wiki formula (asinh form)
    expect(t.fx).toBeGreaterThanOrEqual(0);
    expect(t.fx).toBeLessThan(1);
  });
  it('links to the map app', () => {
    expect(mapsLink({ lat: 28.6129, lng: 77.2295, acc: 10 })).toBe('https://www.google.com/maps/search/?api=1&query=28.6129,77.2295');
  });
});

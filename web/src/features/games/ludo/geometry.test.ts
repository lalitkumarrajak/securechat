import { describe, expect, it } from 'vitest';
import { homeAt, loopLen } from '../../../../../shared/games/ludo.js';
import { makeLayout } from './geometry';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe.each([4, 6])('%i-arm board', (n) => {
  const L = makeLayout(n, 0);
  it('each track square touches the next one', () => {
    for (let i = 0; i < loopLen(n); i++) {
      const d = dist(L.track[i], L.track[(i + 1) % loopLen(n)]);
      expect(d).toBeGreaterThan(0.9);
      expect(d).toBeLessThan(1.5); // straight step = 1, the hop to the next arm is a short diagonal
    }
  });
  it('no two squares overlap, home columns included', () => {
    const all = [...L.track, ...Array.from({ length: n }, (_, a) => L.homeCol(a)).flat()];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(dist(all[i], all[j])).toBeGreaterThan(0.95);
  });
  it('a token walks its own path into the home column and home', () => {
    for (let a = 0; a < n; a++) {
      let prev = L.at(a, 0, 0)!;
      expect(dist(prev, L.startCell(a))).toBeLessThan(1e-9);
      for (let p = 1; p <= homeAt(n) - 1; p++) {
        const cur = L.at(a, p, 0)!;
        expect(dist(prev, cur)).toBeLessThan(1.5);
        prev = cur;
      }
      expect(dist(L.at(a, homeAt(n), 0)!, { x: 0, y: 0 })).toBeLessThan(n === 4 ? 1.1 : 1.8); // inside the centre
    }
  });
  it('yards stay clear of the track', () => {
    for (let a = 0; a < n; a++) for (const s of L.yard(a).spots) for (const c of L.track) expect(dist(s, c)).toBeGreaterThan(1.2);
  });
  it('turns the board so my yard is bottom-left', () => {
    for (let me = 0; me < n; me++) {
      const y = makeLayout(n, me).yard(me).c;
      expect(y.x).toBeLessThan(0);
      expect(y.y).toBeGreaterThan(0);
    }
  });
});

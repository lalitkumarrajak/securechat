import { describe, expect, it } from 'vitest';
import { CROWD, DT, OVERFLOW, SPEED, WEEK, addTrain, chooseGift, extendLine, newGame, newLine, removeLine, step, trainAt, tunnelsUsed, type Line, type Metro, type Shape } from './logic';

/** A quiet city: these stations, the river out of the way, nobody new arriving unless asked. */
function city(stations: [number, number, Shape][]): Metro {
  const m = newGame(1);
  m.river = [[-50, 540], [410, 540]];
  m.stations = stations.map(([x, y, shape], i) => ({ id: 100 + i, x, y, shape, waiting: [], over: 0, born: 0 }));
  m.nextStation = m.nextPassenger = 1e9;
  return m;
}
const run = (m: Metro, seconds: number) => { for (let i = 0; i < Math.round(seconds / DT); i++) step(m, DT); };

describe('Metro Lines', () => {
  it('starts with three stations of three shapes, and the same city for the same seed', () => {
    const m = newGame(5);
    expect(m.stations.map((s) => s.shape)).toEqual([0, 1, 2]);
    expect(newGame(5).stations).toEqual(m.stations);
    expect(newGame(6).stations).not.toEqual(m.stations);
  });

  it('a train picks people up for its line, carries them and drops them at their shape', () => {
    const m = city([[50, 100, 0], [150, 100, 1]]);
    m.stations[0].waiting = [1, 2]; // one wants a triangle (on the line), one a square (not)
    const l = newLine(m, 100, 101) as Line;
    expect(l.stops).toEqual([100, 101]);
    expect(m.trains).toHaveLength(1);
    expect(m.trains[0].load).toEqual([1]);
    expect(m.stations[0].waiting).toEqual([2]);
    run(m, 100 / SPEED + 1);
    expect(m.score).toBe(1);
    expect(m.trains[0].load).toEqual([]);
  });

  it('trains run along the line and turn back at its ends', () => {
    const m = city([[40, 100, 0], [140, 100, 1], [140, 300, 2]]);
    newLine(m, 100, 101);
    extendLine(m, m.lines[0].id, 'tail', 102);
    const tr = m.trains[0];
    run(m, 1);
    expect(trainAt(m, tr).y).toBe(100);
    expect(trainAt(m, tr).x).toBeGreaterThan(40);
    run(m, 100 / SPEED + 1);
    expect(tr.seg).toBe(1); // round the corner
    expect(trainAt(m, tr).x).toBe(140);
    run(m, 200 / SPEED + 1);
    expect(tr.dir).toBe(-1); // turned at the end
    run(m, 300 / SPEED + 2);
    expect(tr.dir).toBe(1); // and back at the start
  });

  it('people change lines to reach a shape their line doesn’t go to', () => {
    const m = city([[40, 100, 0], [140, 100, 1], [240, 100, 2]]);
    m.stations[0].waiting = [2];
    newLine(m, 100, 101);
    expect(m.trains[0].load).toEqual([]); // nothing goes to a square yet
    newLine(m, 101, 102);
    run(m, 6);
    expect(m.stations[0].waiting).toEqual([]); // now it can change at the triangle
    run(m, 10);
    expect(m.score).toBe(1);
  });

  it('a station crowded for too long ends the game', () => {
    const m = city([[50, 100, 0], [150, 100, 1]]);
    m.stations[1].waiting = Array(CROWD + 1).fill(0);
    run(m, OVERFLOW * 0.5);
    expect(m.stations[1].over).toBeGreaterThan(0.4);
    expect(m.phase).toBe('play');
    run(m, OVERFLOW * 0.6);
    expect(m.phase).toBe('over');
    expect(m.lost).toBe(101);
  });

  it('crossing the river takes a tunnel; lines and trains are limited', () => {
    const m = city([[50, 100, 0], [150, 100, 1], [100, 400, 2], [300, 400, 0], [300, 100, 2]]);
    m.river = [[-50, 250], [410, 250]];
    m.tunnels = 1;
    const a = newLine(m, 100, 102) as Line;
    expect(tunnelsUsed(m)).toBe(1);
    expect(extendLine(m, a.id, 'head', 101)).toBe('ok');
    expect(newLine(m, 101, 103)).toBe('tunnel');
    expect(newLine(m, 102, 103)).not.toBe('tunnel');
    expect(newLine(m, 101, 104)).not.toBe('tunnel');
    expect(newLine(m, 100, 104)).toBe('lines');
    expect(addTrain(m, a.id)).toBe(false);
    removeLine(m, a.id);
    expect(m.lines).toHaveLength(2);
    expect(addTrain(m, m.lines[0].id)).toBe(true);
  });

  it('each week gives a choice', () => {
    const m = city([[50, 100, 0], [150, 100, 1]]);
    run(m, WEEK + 1);
    expect(m.phase).toBe('week');
    const before = m.t;
    run(m, 5);
    expect(m.t).toBe(before); // waits for the choice
    chooseGift(m, 'line');
    expect([m.phase, m.maxLines, m.trainCount, m.week]).toEqual(['play', 4, 4, 1]);
    run(m, WEEK);
    chooseGift(m, 'tunnel');
    expect(m.tunnels).toBe(4);
  });

  it('plays out the same for the same seed and moves', () => {
    const play = () => {
      const m = newGame(9);
      newLine(m, m.stations[0].id, m.stations[1].id);
      for (let i = 0; i < 6000 && m.phase !== 'over'; i++) { step(m, DT); if (m.phase === 'week') chooseGift(m, 'train'); }
      return { score: m.score, t: m.t, phase: m.phase, stations: m.stations.length };
    };
    const a = play();
    expect(a).toEqual(play());
    expect(a.stations).toBeGreaterThan(3);
  });
});

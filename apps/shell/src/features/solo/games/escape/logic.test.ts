import { describe, expect, it } from 'vitest';
import { CODES, ITEMS, KNOBS, SPOTS, SPOT_NAMES, combine, enter, fresh, hint, knobs, nextRoom, tap, use, type Escape, type Item, type Result } from './logic';

type Move = ['tap', string] | ['use', Item, string] | ['combine', Item, Item] | ['code', string, string] | ['knobs', boolean[]];
function play(s: Escape, moves: Move[]) {
  const hints: string[] = [];
  for (const m of moves) {
    hints.push(hint(s));
    const r: Result = m[0] === 'tap' ? tap(s, m[1]) : m[0] === 'use' ? use(s, m[1], m[2]) : m[0] === 'combine' ? combine(s, m[1], m[2]) : m[0] === 'code' ? enter(s, m[1], m[2]) : knobs(s, m[1]);
    s = r.s;
  }
  return { s, hints };
}

const STUDY: Move[] = [['tap', 'rug'], ['use', 'smallKey', 'desk'], ['tap', 'clock'], ['combine', 'torchEmpty', 'batteries'], ['use', 'torch', 'bookshelf'], ['tap', 'painting'], ['code', 'study', '4781']];
const KITCHEN: Move[] = [['tap', 'fridge'], ['tap', 'recipe'], ['knobs', KNOBS], ['use', 'ice', 'stove'], ['use', 'brassKey', 'pantry'], ['use', 'spoon', 'table'], ['tap', 'shelf'], ['code', 'kitchen', '352']];
const LAB: Move[] = [['tap', 'bin'], ['tap', 'coat'], ['combine', 'cardB', 'cardA'], ['use', 'keycard', 'locker'], ['use', 'fuse', 'fuses'], ['tap', 'whiteboard'], ['tap', 'bottles'], ['code', 'computer', '6929'], ['tap', 'door']];

describe('Escape Room', () => {
  it('every room can be escaped by its solution, and the hints change as you go', () => {
    let s = fresh();
    for (const [room, moves] of [[0, STUDY], [1, KITCHEN], [2, LAB]] as const) {
      expect(s.room).toBe(room);
      const r = play(s, [...moves]);
      expect(r.s.out).toBe(true);
      expect(new Set(r.hints).size).toBeGreaterThanOrEqual(moves.length - 2); // each step has its own hint, nearly
      s = nextRoom(r.s);
    }
    expect(s.room).toBe(2);
    expect(nextRoom(s)).toBe(s); // no room after the lab
  });

  it('a room isn’t done before its last step', () => {
    for (const [room, moves] of [[0, STUDY], [1, KITCHEN], [2, LAB]] as const) {
      const r = play(fresh(room), moves.slice(0, -1));
      expect(r.s.out).toBe(false);
      expect(nextRoom(r.s).room).toBe(room);
    }
  });

  it('wrong codes are turned away', () => {
    expect(enter(fresh(), 'study', '1874').s.out).toBe(false);
    expect(enter(fresh(), 'study', '1874').msg).toMatch(/Wrong code/);
    expect(enter(fresh(1), 'kitchen', '253').s.out).toBe(false);
    expect(enter(fresh(2), 'computer', '2969').s.flags).toEqual([]);
    expect(Object.keys(CODES)).toHaveLength(3);
  });

  it('items only work where they fit, and only if you have them', () => {
    let s = tap(fresh(), 'rug').s;
    expect(s.inv).toEqual(['smallKey']);
    const wrong = use(s, 'smallKey', 'door');
    expect(wrong.s).toBe(s);
    expect(wrong.msg).toMatch(/doesn’t work/);
    expect(use(s, 'torch', 'bookshelf').s).toBe(s); // not in the bag
    s = tap(s, 'clock').s;
    expect(combine(s, 'smallKey', 'batteries').s).toBe(s);
    // ice on a cold stove does nothing; it melts once the knobs are right
    let k = tap(fresh(1), 'fridge').s;
    expect(use(k, 'ice', 'stove').s.inv).toEqual(['ice']);
    expect(knobs(k, [true, true, true, true]).s).toBe(k);
    k = knobs(k, KNOBS).s;
    expect(use(k, 'ice', 'stove').s.inv).toEqual(['brassKey']);
  });

  it('looking again doesn’t give an item twice', () => {
    const s = tap(tap(fresh(), 'rug').s, 'rug').s;
    expect(s.inv).toEqual(['smallKey']);
    const l = tap(tap(fresh(2), 'bin').s, 'bin').s;
    expect(l.inv).toEqual(['cardA']);
  });

  it('every spot and item has a name', () => {
    for (const spots of SPOTS) for (const id of spots) { expect(SPOT_NAMES[id]).toBeTruthy(); expect(tap(fresh(SPOTS.indexOf(spots)), id).msg).not.toBe('Nothing there.'); }
    expect(Object.values(ITEMS).every((i) => i.name && i.about && i.icon)).toBe(true);
  });
});

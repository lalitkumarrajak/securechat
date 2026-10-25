import { describe, expect, it } from 'vitest';
import { applyEdit, applyPin, applyReact, canDeleteForEveryone, canEdit, reactionSummary, EDIT_WINDOW_MS, DELETE_WINDOW_MS } from './controls';
import type { Msg } from './types';

const base: Msg = { k: 'alice/c1', cid: 'c1', id: 1, peer: 'bob', out: true, ts: 1_000_000, s: 0, type: 'text', text: 'hello' };

describe('edits', () => {
  it('accepts an edit from the sender within 15 minutes', () => {
    expect(applyEdit(base, 'alice', base.ts + 60e3, 'hi')).toMatchObject({ text: 'hi', edited: base.ts + 60e3 });
  });
  it('rejects edits from someone else, too late, empty, or older than the last edit', () => {
    expect(applyEdit(base, 'bob', base.ts + 1, 'x')).toBeNull();
    expect(applyEdit(base, 'alice', base.ts + EDIT_WINDOW_MS + 1, 'x')).toBeNull();
    expect(applyEdit(base, 'alice', base.ts + 1, '   ')).toBeNull();
    const edited = applyEdit(base, 'alice', base.ts + 5000, 'newer')!;
    expect(applyEdit(edited, 'alice', base.ts + 1000, 'older')).toBeNull();
  });
  it('only edits text', () => {
    expect(applyEdit({ ...base, type: 'img' }, 'alice', base.ts + 1, 'x')).toBeNull();
  });
});

describe('reactions', () => {
  it('keeps one reaction per person and removes on empty', () => {
    let m = applyReact(base, 'bob', '❤️')!;
    m = applyReact(m, 'bob', '😂')!;
    m = applyReact(m, 'alice', '😂')!;
    expect(m.reacts).toEqual({ bob: '😂', alice: '😂' });
    expect(reactionSummary(m.reacts, 'alice')).toEqual([{ e: '😂', n: 2, mine: true }]);
    m = applyReact(m, 'bob', '')!;
    expect(m.reacts).toEqual({ alice: '😂' });
  });
  it("can't react to deleted messages", () => {
    expect(applyReact({ ...base, type: 'deleted' }, 'bob', '👍')).toBeNull();
  });
});

describe('pins', () => {
  it('keeps the newest three, newest first', () => {
    let pins = applyPin([], 'a/1', true, 1);
    pins = applyPin(pins, 'a/2', true, 2);
    pins = applyPin(pins, 'a/3', true, 3);
    pins = applyPin(pins, 'a/4', true, 4);
    expect(pins.map((p) => p.k)).toEqual(['a/4', 'a/3', 'a/2']);
  });
  it('unpins, and ignores out-of-order older events', () => {
    let pins = applyPin([], 'a/1', true, 10);
    expect(applyPin(pins, 'a/1', false, 5)).toBe(pins);
    pins = applyPin(pins, 'a/1', false, 11);
    expect(pins).toEqual([]);
  });
});

describe('delete for everyone', () => {
  it('needs all messages to be mine, sent and recent', () => {
    const now = base.ts + 60e3;
    expect(canDeleteForEveryone([base], now)).toBe(true);
    expect(canDeleteForEveryone([base, { ...base, out: false }], now)).toBe(false);
    expect(canDeleteForEveryone([{ ...base, id: undefined }], now)).toBe(false);
    expect(canDeleteForEveryone([base], base.ts + DELETE_WINDOW_MS)).toBe(false);
    expect(canDeleteForEveryone([], now)).toBe(false);
  });
  it('edit is only offered for my sent text messages in time', () => {
    expect(canEdit(base, base.ts + 1000)).toBe(true);
    expect(canEdit({ ...base, out: false }, base.ts + 1000)).toBe(false);
    expect(canEdit(base, base.ts + EDIT_WINDOW_MS)).toBe(false);
  });
});

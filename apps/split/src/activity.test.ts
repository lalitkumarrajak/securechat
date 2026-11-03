import { describe, expect, it } from 'vitest';
import { activityFor } from './activity';
import type { Expense, Meta, Settlement } from './model';

const exp = (o: Partial<Expense> = {}): Expense => ({ type: 'expense', id: 'e1', desc: 'Dinner', amount: 900, cat: 'food', date: '2026-11-02', paidBy: 'a', mode: 'equal', values: {}, owed: { a: 450, b: 450 }, by: 'a', edited: 0, ...o });
const meta = (o: Partial<Meta> = {}): Meta => ({ type: 'meta', id: 'meta', name: 'Goa', emoji: '👥', currency: 'INR', people: [{ id: 'a', name: 'A', u: 'a' }], cats: [], edited: 0, ...o });
const kinds = (l: { kind: string }[]) => l.map((x) => x.kind);

describe('history lines', () => {
  it('an expense added, edited (what changed), and deleted', () => {
    expect(activityFor(undefined, exp(), 'a', 10)).toMatchObject([{ kind: 'expense_add', by: 'a', ts: 10, ref: 'e1', desc: 'Dinner', amount: 900 }]);
    expect(activityFor(exp(), exp({ amount: 1000, owed: { a: 500, b: 500 } }), 'b', 20)).toMatchObject([{ kind: 'expense_edit', by: 'b', wasAmount: 900, amount: 1000 }]);
    expect(activityFor(exp(), exp({ desc: 'Lunch' }), 'b', 20)).toMatchObject([{ kind: 'expense_edit', wasDesc: 'Dinner', desc: 'Lunch' }]);
    expect(activityFor(exp(), exp({ deleted: true }), 'b', 30)).toMatchObject([{ kind: 'expense_delete', desc: 'Dinner' }]);
  });
  it('saving without changing anything, or deleting what is gone, says nothing', () => {
    expect(activityFor(exp(), exp(), 'a', 1)).toEqual([]);
    expect(activityFor(exp({ deleted: true }), exp({ deleted: true }), 'a', 1)).toEqual([]);
    expect(activityFor(undefined, exp({ deleted: true }), 'a', 1)).toEqual([]);
  });
  it('payments recorded and undone', () => {
    const s: Settlement = { type: 'settle', id: 's', from: 'b', to: 'a', amount: 450, date: '2026-11-02', by: 'b', edited: 0 };
    expect(kinds(activityFor(undefined, s, 'b', 1))).toEqual(['settle_add']);
    expect(kinds(activityFor(s, { ...s, deleted: true }, 'b', 1))).toEqual(['settle_undo']);
  });
  it('the group: made, renamed, people added, removed, left; categories added', () => {
    expect(activityFor(null, meta(), 'a', 1)).toMatchObject([{ kind: 'group_create', name: 'Goa' }]);
    const two = meta({ people: [{ id: 'a', name: 'A', u: 'a' }, { id: 'b', name: 'B', u: 'b' }, { id: 'p1', name: 'Rohan' }] });
    expect(activityFor(meta(), two, 'a', 1).map((l) => [l.kind, l.who])).toEqual([['person_add', 'b'], ['person_add', 'p1']]);
    expect(kinds(activityFor(two, { ...two, name: 'Goa 2026' }, 'a', 1))).toEqual(['group_rename']);
    const gone = (id: string) => ({ ...two, people: two.people.map((p) => (p.id === id ? { ...p, gone: true as const } : p)) });
    expect(kinds(activityFor(two, gone('b'), 'a', 1))).toEqual(['person_remove']);   // a removed b
    expect(kinds(activityFor(two, gone('b'), 'b', 1))).toEqual(['person_left']);     // b left
    expect(kinds(activityFor(two, { ...two, people: two.people.filter((p) => p.id !== 'p1') }, 'a', 1))).toEqual(['person_remove']);
    expect(activityFor(two, { ...two, cats: [{ id: 'c1', name: 'Cricket', emoji: '🏏', color: '#22c55e' }] }, 'a', 1)).toMatchObject([{ kind: 'category_add', name: 'Cricket' }]);
  });
  it('a payment that needs confirming: asked, confirmed, or cancelled', () => {
    const s: Settlement = { type: 'settle', id: 's', from: 'b', to: 'a', amount: 50, date: '2026-11-03', pending: true, by: 'b', edited: 0 };
    expect(kinds(activityFor(undefined, s, 'b', 1))).toEqual(['settle_request']);
    const { pending: _p, ...done } = s;
    expect(kinds(activityFor(s, done, 'a', 2))).toEqual(['settle_confirm']);
    expect(kinds(activityFor(s, { ...s, deleted: true }, 'a', 3))).toEqual(['settle_decline']);
    expect(kinds(activityFor(done, { ...done, deleted: true }, 'a', 4))).toEqual(['settle_undo']);
  });
});

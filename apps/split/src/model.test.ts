import { describe, expect, it } from 'vitest';
import { addDays, apportion, balances, pairDebts, byCategory, grainFor, linesOf, moveLedger, needsConfirm, standing, parseAmount, rangeFor, series, simplify, splitAmount, sum, toInput, type Expense, type Settlement } from './model';

const exp = (o: Partial<Expense>): Expense => ({ type: 'expense', id: 'e' + Math.random(), desc: 'x', amount: 0, cat: 'food', date: '2026-11-02', paidBy: 'a', mode: 'equal', values: {}, owed: {}, by: 'a', edited: 0, ...o });

describe('splitting', () => {
  it('apportion always sums to the total and gives leftovers to the earlier people', () => {
    expect(apportion(100, [1, 1, 1])).toEqual([34, 33, 33]);
    for (let t = 0; t < 500; t++) {
      const total = Math.floor(Math.random() * 100000), w = Array.from({ length: 1 + (t % 7) }, () => 1 + Math.floor(Math.random() * 9));
      expect(apportion(total, w).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
  it('equal, shares and percent', () => {
    expect(splitAmount(1000, 'equal', ['a', 'b', 'c'], {})).toEqual({ owed: { a: 334, b: 333, c: 333 } });
    expect(splitAmount(1000, 'shares', ['a', 'b'], { a: 3, b: 1 })).toEqual({ owed: { a: 750, b: 250 } });
    expect(splitAmount(1000, 'percent', ['a', 'b'], { a: 3333, b: 6667 })).toEqual({ owed: { a: 333, b: 667 } });
  });
  it('explains what is wrong instead of guessing', () => {
    expect(splitAmount(1000, 'percent', ['a', 'b'], { a: 5000, b: 4000 })).toEqual({ error: 'Percentages add up to 90%, not 100%' });
    expect('error' in splitAmount(1000, 'exact', ['a', 'b'], { a: 400, b: 500 })).toBe(true);
    expect('error' in splitAmount(1000, 'equal', [], {})).toBe(true);
    expect('error' in splitAmount(0, 'equal', ['a'], {})).toBe(true);
    expect(splitAmount(1000, 'exact', ['a', 'b'], { a: 400, b: 600 })).toEqual({ owed: { a: 400, b: 600 } });
  });
  it('parses and prints amounts without floats', () => {
    expect(parseAmount('1,234.5', 'INR')).toBe(123450);
    expect(parseAmount('0.1', 'INR')).toBe(10);
    expect(parseAmount('19.999', 'INR')).toBeNull();
    expect(parseAmount('abc', 'INR')).toBeNull();
    expect(parseAmount('500', 'JPY')).toBe(500);
    expect(toInput(123450, 'INR')).toBe('1234.50');
  });
});

describe('balances', () => {
  it('who paid minus what they owe, with settlements', () => {
    const e = [exp({ amount: 900, paidBy: 'a', owed: { a: 300, b: 300, c: 300 } }), exp({ amount: 200, paidBy: 'b', owed: { a: 100, b: 100 } })];
    expect(balances(e, [])).toEqual({ a: 900 - 300 - 100, b: -300 + 200 - 100, c: -300 });
    const s: Settlement[] = [{ type: 'settle', id: 's', from: 'c', to: 'a', amount: 300, date: '2026-11-02', by: 'c', edited: 0 }];
    expect(balances(e, s).c).toBe(0);
    expect(balances([exp({ amount: 50, owed: { b: 50 }, deleted: true })], [])).toEqual({});
  });
  it('simplify settles everyone, conserves money and needs at most n−1 payments', () => {
    for (let t = 0; t < 300; t++) {
      const ids = ['a', 'b', 'c', 'd', 'e'].slice(0, 2 + (t % 4));
      const es = Array.from({ length: 6 }, () => {
        const amount = 100 + Math.floor(Math.random() * 9000), who = ids.filter(() => Math.random() < 0.7);
        const people = who.length ? who : [ids[0]];
        const r = splitAmount(amount, 'equal', people, {}) as { owed: Record<string, number> };
        return exp({ amount, paidBy: ids[Math.floor(Math.random() * ids.length)], owed: r.owed });
      });
      const net = balances(es, []);
      expect(Object.values(net).reduce((a, b) => a + b, 0)).toBe(0);
      const pay = simplify(net);
      expect(pay.length).toBeLessThanOrEqual(ids.length - 1);
      const after = { ...net };
      for (const p of pay) { after[p.from] += p.amount; after[p.to] -= p.amount; }
      expect(Object.values(after).every((n) => n === 0)).toBe(true);
    }
  });
});

describe('who owes whom, person to person (lending)', () => {
  const settle = (from: string, to: string, amount: number, extra: Partial<Settlement> = {}): Settlement => ({ type: 'settle', id: from + to + amount, from, to, amount, date: '2026-11-02', by: from, edited: 0, ...extra });
  it('never routes one person’s debt through another', () => {
    // I lent Vikram 5,000; Rohan lent me 2,000. Netting the group would have Vikram pay Rohan.
    const e = [exp({ amount: 5000, paidBy: 'me', owed: { v: 5000 } }), exp({ amount: 2000, paidBy: 'r', owed: { me: 2000 } })];
    expect(pairDebts(e, [])).toEqual([{ from: 'v', to: 'me', amount: 5000, lent: 5000 }, { from: 'me', to: 'r', amount: 2000, lent: 2000 }]);
    expect(simplify(balances(e, [])).some((t) => t.from === 'v' && t.to === 'r')).toBe(true); // what the group shortcut would say
  });
  it('paying back, and lending both ways, bring a pair down; confirmed payments only', () => {
    const e = [exp({ amount: 8000, paidBy: 'me', owed: { v: 8000 } }), exp({ amount: 1000, paidBy: 'v', owed: { me: 1000 } })];
    expect(pairDebts(e, [settle('v', 'me', 2000)])).toEqual([{ from: 'v', to: 'me', amount: 5000, lent: 8000 }]);
    expect(pairDebts(e, [settle('v', 'me', 2000, { pending: true })])[0].amount).toBe(7000);
    expect(pairDebts(e, [settle('v', 'me', 7000)])).toEqual([]);
    expect(pairDebts(e, [settle('v', 'me', 9000)])).toEqual([{ from: 'me', to: 'v', amount: 2000, lent: 1000 }]); // paid too much
  });
  it('a shared expense: each person owes the one who paid their part', () => {
    expect(pairDebts([exp({ amount: 900, paidBy: 'a', owed: { a: 300, b: 300, c: 300 } })], [])).toEqual([
      { from: 'b', to: 'a', amount: 300, lent: 300 }, { from: 'c', to: 'a', amount: 300, lent: 300 }]);
    expect(pairDebts([exp({ amount: 50, paidBy: 'a', owed: { b: 50 }, deleted: true })], [])).toEqual([]);
  });
});

describe('lent and borrowed money in the charts', () => {
  it('what you lent is what you paid for others; what you borrowed is what they paid for you', () => {
    const es = [exp({ amount: 5000, paidBy: 'me', cat: 'lent', owed: { v: 5000 } }), exp({ amount: 2000, paidBy: 'r', cat: 'borrowed', owed: { me: 2000 } }),
      exp({ amount: 600, paidBy: 'me', cat: 'food', owed: { me: 300, v: 300 } })];
    expect(linesOf('g', es, 'share', 'me').map((l) => [l.cat, l.amount])).toEqual([['lent', 5000], ['borrowed', 2000], ['food', 300]]);
    // In a lending group every entry is lent or borrowed, whatever its category says
    expect(linesOf('g', es, 'share', 'me', true).map((l) => [l.cat, l.amount])).toEqual([['lent', 5000], ['borrowed', 2000], ['lent', 300]]);
    expect(linesOf('g', es, 'total', 'me').map((l) => l.amount)).toEqual([5000, 2000, 600]); // the group total is untouched
  });
});

describe('statistics', () => {
  const es = [
    exp({ id: '1', amount: 300, date: '2026-11-01', cat: 'metro', owed: { me: 100, you: 200 } }),
    exp({ id: '2', amount: 900, date: '2026-11-02', cat: 'gym', owed: { me: 900 } }),
    exp({ id: '3', amount: 500, date: '2026-10-15', cat: 'metro', owed: { me: 250, you: 250 } }),
    exp({ id: '4', amount: 70, date: '2026-11-02', cat: 'bus', owed: { you: 70 } }),
  ];
  it('own share versus whole bill', () => {
    expect(sum(linesOf('g', es, 'share', 'me'))).toBe(1250);
    expect(sum(linesOf('g', es, 'total', 'me'))).toBe(1770);
  });
  it('ranks categories by what you spent', () => {
    expect(byCategory(linesOf('g', es, 'share', 'me')).map((c) => [c.cat, c.total])).toEqual([['gym', 900], ['metro', 350]]);
  });
  it('ranges and series: no gaps, nothing lost', () => {
    const r = { from: '2026-10-01', to: '2026-11-02' };
    const days = series(linesOf('g', es, 'share', 'me'), r);
    expect(grainFor(r)).toBe('day');
    expect(days).toHaveLength(33);
    expect(days.reduce((a, b) => a + b.total, 0)).toBe(1250);
    const months = series(linesOf('g', es, 'share', 'me'), { from: '2026-01-15', to: '2026-11-02' });
    expect(months.map((b) => b.key.slice(0, 7)).slice(0, 2)).toEqual(['2026-01', '2026-02']);
    expect(months.at(-1)!.total).toBe(1000);
    expect(months.at(-2)!.total).toBe(250);
    expect(rangeFor('week', new Date(2026, 10, 2))).toEqual({ from: '2026-11-02', to: '2026-11-02' }); // a Monday
    expect(rangeFor('lastMonth', new Date(2026, 10, 2))).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('linking a name to an account', () => {
  const es = [
    exp({ id: '1', amount: 300, paidBy: 'me', owed: { me: 100, p1: 200 } }),
    exp({ id: '2', amount: 100, paidBy: 'p1', owed: { me: 50, p1: 25, ravi: 25 } }),
    exp({ id: '3', amount: 90, paidBy: 'me', owed: { me: 90 } }),
  ];
  const st = [{ type: 'settle', id: 's1', from: 'p1', to: 'me', amount: 50, date: '2026-11-01', by: 'me', edited: 0 } as Settlement,
    { type: 'settle', id: 's2', from: 'p1', to: 'ravi', amount: 5, date: '2026-11-01', by: 'me', edited: 0 } as Settlement];
  it('keeps every balance the same, moved onto the account', () => {
    const before = balances(es, st);
    const moved = moveLedger(es, st, 'p1', 'ravi');
    expect(moved.map((r) => r.id).sort()).toEqual(['1', '2', 's1', 's2']);
    const e2 = es.map((e) => (moved.find((m) => m.id === e.id) as Expense) ?? e);
    const s2 = st.map((s) => (moved.find((m) => m.id === s.id) as Settlement) ?? s).filter((s) => !s.deleted);
    const after = balances(e2, s2);
    expect(after.ravi).toBe((before.p1 ?? 0) + (before.ravi ?? 0));
    expect(after.me).toBe(before.me);
    expect(after.p1 ?? 0).toBe(0);
    expect(e2[1].owed).toEqual({ me: 50, ravi: 50 });
  });
});

describe('standing across groups', () => {
  const people = [{ id: 'me', name: 'me', u: 'me' }, { id: 'ravi', name: 'Ravi', u: 'ravi' }, { id: 'p1', name: 'Rohan' }];
  it('totals what you get and owe, per currency, and with whom', () => {
    const trip = { currency: 'INR', people, expenses: [exp({ amount: 900, paidBy: 'me', owed: { me: 300, ravi: 300, p1: 300 } })], settles: [] };
    const flat = { currency: 'INR', people, expenses: [exp({ amount: 500, paidBy: 'ravi', owed: { me: 250, ravi: 250 } })], settles: [] };
    const usd = { currency: 'USD', people, expenses: [exp({ amount: 100, paidBy: 'p1', owed: { me: 50, p1: 50 } })], settles: [] };
    const [inr, usdS] = standing([trip, flat, usd], 'me');
    expect(inr).toMatchObject({ cur: 'INR', get: 600, owe: 250 });
    expect(inr.people.map((p) => [p.name, p.amount])).toEqual([['Rohan', 300], ['Ravi', 50]]);
    expect(usdS).toMatchObject({ cur: 'USD', get: 0, owe: 50 });
  });
});

describe('payments waiting for confirmation', () => {
  it('do not count until the one who got the money confirms', () => {
    const es = [exp({ amount: 100, paidBy: 'a', owed: { a: 50, b: 50 } })];
    const s = { type: 'settle', id: 's', from: 'b', to: 'a', amount: 50, date: '2026-11-03', by: 'b', edited: 0 } as Settlement;
    expect(balances(es, [{ ...s, pending: true }])).toEqual({ a: 50, b: -50 });
    expect(balances(es, [s])).toEqual({ a: 0, b: 0 });
  });
  it('are needed unless you got the money or they are not on Sanga', () => {
    expect(needsConfirm({ id: 'a', name: 'A', u: 'a' }, 'b')).toBe(true);
    expect(needsConfirm({ id: 'a', name: 'A', u: 'a' }, 'a')).toBe(false);
    expect(needsConfirm({ id: 'p1', name: 'Rohan' }, 'b')).toBe(false);
  });
});

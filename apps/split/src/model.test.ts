import { describe, expect, it } from 'vitest';
import { addDays, apportion, balances, byCategory, grainFor, linesOf, parseAmount, rangeFor, series, simplify, splitAmount, sum, toInput, type Expense, type Settlement } from './model';

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

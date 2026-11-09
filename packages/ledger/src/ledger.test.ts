import { describe, expect, it } from 'vitest';
import { balances, cashbackList, cashbackOf, creditLine, effect, netWorth, valid, type LedgerState } from './model';
import { awaitingBill, billState, cardReminders, unpaid, type CardBill, type CardStatement, type CreditCard } from './cards';
import type { Account, Entry } from './types';

const acc = (id: string, kind: Account['kind'], opening = 0, o: Partial<Account> = {}): Account => ({ id, type: 'account', kind, name: id, currency: 'INR', color: 'blue', opening, created: 0, edited: 0, ...o });
const ent = (id: string, kind: Entry['kind'], account: string, amount: number, o: Partial<Entry> = {}): Entry => ({ id, type: 'entry', kind, account, amount, date: '2026-11-01', desc: '', created: 0, edited: 0, ...o });
const state = (accounts: Account[], entries: Entry[]): LedgerState => ({ accounts: Object.fromEntries(accounts.map((a) => [a.id, a])), debits: {}, entries: Object.fromEntries(entries.map((e) => [e.id, e])), bills: {}, statements: {}, loaded: true });

describe('balances', () => {
  const s = state([acc('bank', 'bank', 5000000), acc('card', 'credit', -200000, { limit: 10000000 }), acc('cash', 'cash', 100000)], [
    ent('e1', 'out', 'bank', 120000),                    // rent share from the bank
    ent('e2', 'out', 'card', 50000),                     // dinner on the card: you owe more
    ent('e3', 'transfer', 'bank', 200000, { to: 'card' }), // paid the card's bill
    ent('e4', 'transfer', 'bank', 300000, { to: 'cash' }), // ATM
    ent('e5', 'in', 'bank', 7500000),                    // salary
    ent('e6', 'adjust', 'cash', -20000),                 // counted the cash: 200 less
    ent('e7', 'out', 'bank', 999999, { deleted: true }),
  ]);
  it('adds up each account', () => {
    const b = balances(s);
    expect(b.get('bank')).toBe(5000000 - 120000 - 200000 - 300000 + 7500000);
    expect(b.get('card')).toBe(-200000 - 50000 + 200000);
    expect(b.get('cash')).toBe(100000 + 300000 - 20000);
  });
  it('a transfer takes from one and gives to the other', () => {
    expect(effect(s.entries.e3, 'bank')).toBe(-200000);
    expect(effect(s.entries.e3, 'card')).toBe(200000);
    expect(effect(s.entries.e3, 'cash')).toBe(0);
  });
  it('what you have, what you owe on cards, and the net', () => {
    const [n] = netWorth(s);
    const have = 5000000 - 120000 - 200000 - 300000 + 7500000 + 380000;
    expect(n).toEqual({ currency: 'INR', have, owe: 50000, net: have - 50000 });
  });
});

describe('records from other devices are checked', () => {
  it('keeps only last four digits, never a full number', () => {
    const a = valid({ type: 'account', kind: 'credit', name: 'X', last4: '4111111111111111', currency: 'INR', opening: 0 }, 'aaaaaaaa') as Account;
    expect(a.last4).toBeUndefined();
    expect((valid({ type: 'account', kind: 'credit', name: 'X', last4: '1234', expiry: '13/27' }, 'aaaaaaaa') as Account)).toMatchObject({ last4: '1234' });
    expect((valid({ type: 'account', kind: 'credit', name: 'X', expiry: '13/27' }, 'aaaaaaaa') as Account).expiry).toBeUndefined();
  });
  it('a transfer needs somewhere to go', () => {
    expect(valid({ type: 'entry', kind: 'transfer', account: 'a', amount: 5, date: '2026-11-01' }, 'aaaaaaaa')).toBeNull();
  });
});

describe('no bill this month', () => {
  const card: CreditCard = { ...acc('cardaaaaaaaa', 'credit'), kind: 'credit', statementDay: 5, dueAfter: 20, remind: [3, 1, 0], time: '09:00' };
  const none: CardBill = { id: 'b1', type: 'bill', card: card.id, month: '2026-11', amount: 0, due: '2026-11-25', none: true, created: 0, edited: 0 };
  it('stops asking for the bill and reminding of it', () => {
    expect(awaitingBill([card], [none], '2026-11-06')).toEqual([]);
    expect(cardReminders([card], [none], '2026-11-06').filter((r) => r.key.includes('2026-11'))).toEqual([]);
  });
  it('isn’t owed, and says so', () => {
    expect(unpaid([none])).toEqual([]);
    expect(billState(none, '2026-11-30')).toBe('none');
  });
});

describe('a shared credit limit', () => {
  // Millennia holds a ₹2,00,000 limit; Regalia shares it; Amex has its own.
  const s = state([
    acc('mil', 'credit', -3000000, { limit: 20000000 }),
    acc('reg', 'credit', -5000000, { limitWith: 'mil' }),
    acc('amex', 'credit', -1000000, { limit: 5000000 }),
  ], []);
  it('what is owed on every card sharing it uses it up, seen from either card', () => {
    for (const id of ['mil', 'reg']) {
      const l = creditLine(s.accounts[id], s);
      expect(l.limit).toBe(20000000);
      expect(l.owe).toBe(8000000);
      expect(l.available).toBe(12000000);
      expect(l.shared).toBe(true);
    }
    expect(creditLine(s.accounts.reg, s).others.map((x) => x.id)).toEqual(['mil']);
  });
  it('a card with its own limit is on its own', () => {
    const l = creditLine(s.accounts.amex, s);
    expect([l.limit, l.owe, l.available, l.shared]).toEqual([5000000, 1000000, 4000000, false]);
  });
  it('sharing with a card that is gone: its own limit again', () => {
    const gone = { ...s, accounts: { ...s.accounts, mil: { ...s.accounts.mil, deleted: true } } };
    expect(creditLine(gone.accounts.reg, gone).shared).toBe(false);
  });
  it('the link survives sync', () => {
    expect((valid({ ...s.accounts.reg }, 'reg') as Account).limitWith).toBe('mil');
  });
});

describe('cashback', () => {
  const st: CardStatement = { id: 'st1', type: 'statement', card: 'card', month: '2026-10', date: '2026-10-14', from: '2026-09-15', total: 0,
    txns: [{ d: '2026-10-01', t: 'SWIGGY', a: 50000, c: 'food' }, { d: '2026-10-05', t: 'CASHBACK CREDIT', a: -10000, c: 'cashback' }, { d: '2026-10-06', t: 'REFUND', a: -5000, c: 'refund' }], created: 0, edited: 0 };
  const s: LedgerState = {
    ...state([acc('bank', 'bank', 0), acc('card', 'credit', -100000), acc('other', 'credit', 0)], [
      ent('c1', 'in', 'card', 10000, { date: '2026-10-05', cat: 'cashback' }),  // added by hand, then on the statement too
      ent('c2', 'in', 'card', 2000, { date: '2026-10-20', cat: 'cashback' }),   // after the statement
      ent('c3', 'in', 'bank', 30000, { date: '2026-10-21', cat: 'cashback', card: 'card' }), // paid to the bank
      ent('c4', 'in', 'bank', 99900, { date: '2026-10-21' }),                   // not cashback
      ent('c5', 'in', 'other', 4000, { date: '2026-10-05', cat: 'cashback' }),
    ]),
    statements: { st1: st },
  };
  it('lowers what you owe on the card it went into', () => {
    expect(balances(s).get('card')).toBe(-100000 + 10000 + 2000);
    expect(balances(s).get('bank')).toBe(30000 + 99900);
  });
  it('counts statement lines and entries once, by the card that earned it', () => {
    expect(cashbackList(s).map((x) => [x.key, x.card, x.amount])).toEqual([
      ['c3', 'card', 30000], ['c2', 'card', 2000], ['st1:1', 'card', 10000], ['c5', 'other', 4000],
    ]);
    expect(cashbackOf('card', '', '9999', s)).toBe(42000);
    expect(cashbackOf('card', '2026-10-15', '2026-10-31', s)).toBe(32000);
  });
  it('keeps the card that earned it through sync', () => {
    expect((valid({ ...s.entries.c3 }, 'c3') as Entry).card).toBe('card');
  });
});

describe('cashback in statements imported before it had its own category', () => {
  it('is read as cashback when the line says so', () => {
    const st: CardStatement = { id: 'st0', type: 'statement', card: 'card', month: '2026-08', date: '2026-08-14', total: 0, created: 0, edited: 0,
      txns: [{ d: '2026-08-02', t: 'CASHBACK CREDIT', a: -7000, c: 'refund' }, { d: '2026-08-03', t: 'AMAZON REFUND', a: -9000, c: 'refund' }] };
    const s: LedgerState = { ...state([acc('card', 'credit')], []), statements: { st0: st } };
    expect(cashbackList(s).map((x) => [x.desc, x.amount])).toEqual([['CASHBACK CREDIT', 7000]]);
  });
});

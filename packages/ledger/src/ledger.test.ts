import { describe, expect, it } from 'vitest';
import { balances, effect, netWorth, valid, type LedgerState } from './model';
import { awaitingBill, billState, cardReminders, unpaid, type CardBill, type CreditCard } from './cards';
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

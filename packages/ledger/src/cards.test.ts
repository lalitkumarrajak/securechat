import { describe, expect, it } from 'vitest';
import { awaitingBill, billId, billState, cardReminders, lastStatement, parseAmount, statementDate, suggestedDue, toInput, unpaid, type CardBill, type CreditCard } from './cards';

const card = (o: Partial<CreditCard> = {}): CreditCard => ({ id: 'cardaaaaaaaa', type: 'account', kind: 'credit', opening: 0, name: 'HDFC', statementDay: 5, dueAfter: 20, remind: [3, 1, 0], time: '09:00', currency: 'INR', color: 'blue', created: 0, edited: 0, ...o });
const bill = (o: Partial<CardBill> = {}): CardBill => ({ id: 'b1', type: 'bill', card: 'cardaaaaaaaa', month: '2026-11', amount: 1234500, due: '2026-11-25', created: 0, edited: 0, ...o });

describe('statement dates', () => {
  it('short months use their last day', () => {
    expect(statementDate('2026-04', 31)).toBe('2026-04-30');
    expect(statementDate('2026-02', 30)).toBe('2026-02-28');
    expect(statementDate('2028-02', 31)).toBe('2028-02-29');
    expect(statementDate('2026-11', 5)).toBe('2026-11-05');
  });
  it('the latest statement already made: this month once its day has come, else last month', () => {
    expect(lastStatement(card(), '2026-11-05')).toEqual({ month: '2026-11', date: '2026-11-05' });
    expect(lastStatement(card(), '2026-11-04')).toEqual({ month: '2026-10', date: '2026-10-05' });
    expect(lastStatement(card({ statementDay: 28 }), '2027-01-02')).toEqual({ month: '2026-12', date: '2026-12-28' });
  });
  it('the due date is suggested from the statement', () => {
    expect(suggestedDue(card(), '2026-11')).toBe('2026-11-25');
    expect(suggestedDue(card({ statementDay: 20, dueAfter: 15 }), '2026-12')).toBe('2027-01-04');
  });
  it('a bill has the same id on every device', () => { expect(billId('cardaaaaaaaa', '2026-11')).toBe(billId('cardaaaaaaaa', '2026-11')); expect(billId('cardaaaaaaaa', '2026-11')).toMatch(/^[A-Za-z0-9_-]{8,40}$/); });
});

describe('asking for the bill', () => {
  it('asks once the statement is out and nothing is entered; stops when it is', () => {
    expect(awaitingBill([card()], [], '2026-11-05').map((x) => x.month)).toEqual(['2026-11']);
    expect(awaitingBill([card()], [bill()], '2026-11-05')).toEqual([]);
    expect(awaitingBill([card()], [bill({ deleted: true })], '2026-11-05')).toHaveLength(1);
    expect(awaitingBill([card({ archived: true })], [], '2026-11-05')).toEqual([]);
  });
  it('a card added after its statement day asks for the current bill; an old statement is let go', () => {
    expect(awaitingBill([card({ statementDay: 1 })], [], '2026-11-10')).toHaveLength(1);
    expect(awaitingBill([card({ statementDay: 1 })], [], '2026-11-30')).toEqual([]); // 29 days on: it'll ask on the 1st
  });
});

describe('bills', () => {
  it('state: paid, overdue, due within 3 days, later; unpaid are most urgent first', () => {
    expect(billState(bill({ paid: '2026-11-20' }), '2026-11-21')).toBe('paid');
    expect(billState(bill(), '2026-11-26')).toBe('overdue');
    expect(billState(bill(), '2026-11-25')).toBe('soon');
    expect(billState(bill(), '2026-11-22')).toBe('soon');
    expect(billState(bill(), '2026-11-21')).toBe('later');
    const list = [bill({ id: 'x', due: '2026-12-01' }), bill({ id: 'y', due: '2026-11-25' }), bill({ id: 'z', paid: '2026-11-01' })];
    expect(unpaid(list).map((b) => b.id)).toEqual(['y', 'x']);
  });
  it('amounts are whole numbers of paise', () => {
    expect(parseAmount('12,345.50', 'INR')).toBe(1234550);
    expect(parseAmount('0.1', 'INR')).toBe(10);
    expect(parseAmount('1.999', 'INR')).toBeNull();
    expect(parseAmount('', 'INR')).toBeNull();
    expect(toInput(1234550, 'INR')).toBe('12345.50');
  });
});

describe('reminders', () => {
  const at = (r: { at: number }) => new Date(r.at).toISOString();
  it('asks on each statement day (and two days later) while no bill is entered', () => {
    const r = cardReminders([card()], [], '2026-11-02');
    const s = r.filter((x) => /\|s$/.test(x.key)).map((x) => x.key.split('|')[2]);
    expect(s).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(r.find((x) => x.key.endsWith('2026-12|s'))!.title).toBe('💳 HDFC: is your bill ready?');
    expect(r.filter((x) => x.key.endsWith('|s2'))).toHaveLength(4);
  });
  it('once the bill is in: due-date reminders with the amount, and an overdue one; no more asking for that month', () => {
    const r = cardReminders([card()], [bill({ minDue: 61700 })], '2026-11-06');
    expect(r.some((x) => x.key.endsWith('2026-11|s'))).toBe(false);
    const due = r.filter((x) => x.key.includes('2026-11|d'));
    expect(due.map((x) => x.key.split('|')[3])).toEqual(['d3', 'd1', 'd0']);
    expect(due[0].title).toMatch(/due in 3 days/);
    expect(due[1].title).toMatch(/due tomorrow/);
    expect(due[2].title).toMatch(/pay .* today/);
    expect(due[0].body).toMatch(/Minimum/);
    expect(new Date(due[2].at).getDate()).toBe(25);
    expect(new Date(due[2].at).getHours()).toBe(9);
    expect(r.find((x) => x.key.endsWith('|od'))!.title).toMatch(/overdue/);
    expect(at(r.find((x) => x.key.endsWith('|od'))!)).toContain('-26');
  });
  it('a paid bill reminds of nothing; an archived or deleted card is silent', () => {
    expect(cardReminders([card()], [bill({ paid: '2026-11-20' })], '2026-11-21').filter((x) => /d\d|od/.test(x.key.split('|')[3] ?? ''))).toEqual([]);
    expect(cardReminders([card({ archived: true })], [], '2026-11-02')).toEqual([]);
    expect(cardReminders([card({ deleted: true })], [], '2026-11-02')).toEqual([]);
  });
  it('the days before are the card’s own', () => {
    const r = cardReminders([card({ remind: [7, 0] })], [bill()], '2026-11-06').filter((x) => x.key.includes('2026-11|d'));
    expect(r.map((x) => x.key.split('|')[3])).toEqual(['d7', 'd0']);
  });
});

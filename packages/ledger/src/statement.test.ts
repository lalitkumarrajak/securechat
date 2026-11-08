import { describe, expect, it } from 'vitest';
import { categorize, findAmounts, findDates, parseStatement, textLines, totals, type Line } from './statement';

/** A PDF line from columns: [x, text] pairs. */
const L = (...cols: [number, string][]): Line => cols.map(([x, s]) => ({ x, w: s.length * 5, s }));

describe('dates and amounts', () => {
  it('reads the ways Indian statements write dates', () => {
    expect(findDates('15/03/2025')[0].date).toBe('2025-03-15');
    expect(findDates('05-Apr-25')[0].date).toBe('2025-04-05');
    expect(findDates('Due on 7 April, 2025')[0].date).toBe('2025-04-07');
    expect(findDates('Mar 15, 2025')[0].date).toBe('2025-03-15');
    expect(findDates('2025-03-15')[0].date).toBe('2025-03-15');
    expect(findDates('28 Dec', '2025-01-12')[0].date).toBe('2024-12-28');
    expect(findDates('31/02/2025')).toHaveLength(0);
  });
  it('reads amounts, and which are credits', () => {
    expect(findAmounts('₹1,23,456.78')[0]).toMatchObject({ minor: 12345678, credit: false });
    expect(findAmounts('Rs. 1,234.00')[0].minor).toBe(123400);
    expect(findAmounts('5,000.00 Cr')[0]).toMatchObject({ minor: 500000, credit: true });
    expect(findAmounts('-2,000.00')[0]).toMatchObject({ minor: 200000, credit: true });
    expect(findAmounts('Due:Rs.620.00')[0].minor).toBe(62000);
    expect(findAmounts('XXXX XXXX XXXX 1234').filter((a) => a.decimals)).toHaveLength(0);
  });
});

describe('a statement with labels beside values', () => {
  const lines = [
    L([40, 'HDFC Bank Credit Card Statement']),
    L([40, 'Card No: 4321 56XX XXXX 9876']),
    L([40, 'Statement Date: 14/03/2025'], [300, 'Payment Due Date: 03/04/2025']),
    L([40, 'Total Dues'], [200, '12,345.67'], [300, 'Minimum Amount Due'], [450, '620.00']),
    L([40, 'Credit Limit'], [200, '2,00,000.00'], [300, 'Available Credit Limit'], [450, '1,80,000.00']),
    L([40, 'Date'], [100, 'Transaction Description'], [450, 'Amount (in Rs.)']),
    L([40, '16/02/2025'], [100, 'SWIGGY BANGALORE'], [450, '456.00']),
    L([40, '18/02/2025'], [100, 'AMAZON PAY INDIA PRIVATE'], [450, '2,499.00']),
    L([40, '20/02/2025'], [100, 'PAYMENT RECEIVED - NETBANKING THANK YOU'], [450, '10,000.00 Cr']),
    L([40, '22/02/2025'], [100, 'HPCL FUEL STATION PUNE'], [450, '1,500.00']),
    L([40, '01/03/2025'], [100, 'NETFLIX.COM'], [450, '649.00']),
    L([40, '02/03/2025'], [100, 'AMAZON REFUND'], [450, '300.00 Cr']),
    L([40, '05/03/2025'], [100, 'IGST ON FEE'], [450, '18.00']),
  ];
  const p = parseStatement(lines);
  it('finds the bill', () => {
    expect(p).toMatchObject({ kind: 'statement', bank: 'HDFC Bank', last4: '9876', statementDate: '2025-03-14', dueDate: '2025-04-03', total: 1234567, minDue: 62000, limit: 20000000 });
  });
  it('finds each transaction and what it was for', () => {
    expect(p.txns.map((x) => [x.date, x.cat, x.amount, x.credit])).toEqual([
      ['2025-02-16', 'food', 45600, false], ['2025-02-18', 'shopping', 249900, false], ['2025-02-20', 'payment', 1000000, true],
      ['2025-02-22', 'fuel', 150000, false], ['2025-03-01', 'entertainment', 64900, false], ['2025-03-02', 'refund', 30000, true], ['2025-03-05', 'fees', 1800, false],
    ]);
    expect(totals(p.txns)).toEqual({ spent: 45600 + 249900 + 150000 + 64900 + 1800, refunds: 30000, paid: 1000000, net: 45600 + 249900 + 150000 + 64900 + 1800 - 30000 });
  });
});

describe('a statement with a row of labels over a row of values', () => {
  const lines = [
    L([40, 'ICICI Bank']),
    L([40, 'Statement period : 13 Feb 2025 to 12 Mar 2025']),
    L([40, 'Statement Date'], [160, 'Payment Due Date'], [300, 'Total Amount due'], [440, 'Minimum Amount due']),
    L([40, 'March 12, 2025'], [160, 'March 30, 2025'], [300, '₹8,210.50'], [440, '₹410.00']),
    L([40, '4315XXXXXXXX1002']),
    L([40, '15 Feb'], [100, 'BIGBASKET BANGALORE'], [380, '35'], [450, '1,210.50']),
    L([40, '27 Feb'], [100, 'UBER INDIA'], [380, '4'], [450, '210.00']),
  ];
  const p = parseStatement(lines);
  it('reads each value from under its label', () => {
    expect(p).toMatchObject({ bank: 'ICICI Bank', last4: '1002', from: '2025-02-13', to: '2025-03-12', statementDate: '2025-03-12', dueDate: '2025-03-30', total: 821050, minDue: 41000 });
  });
  it('gives transactions without a year the statement’s year, and skips reward points', () => {
    expect(p.txns.map((x) => [x.date, x.cat, x.amount])).toEqual([['2025-02-15', 'groceries', 121050], ['2025-02-27', 'travel', 21000]]);
  });
});

describe('SMS from the bank', () => {
  it('a statement SMS', () => {
    const p = parseStatement(textLines('Your SBI Card ending 4455 statement is generated. Total Amt Due: Rs.12,345.67, Min Amt Due: Rs.620.00, Payment Due Date: 05-Apr-25.'));
    expect(p).toMatchObject({ kind: 'statement', bank: 'SBI Card', last4: '4455', total: 1234567, minDue: 62000, dueDate: '2025-04-05' });
  });
  it('a payment SMS', () => {
    const p = parseStatement(textLines('Payment of Rs 12,345.67 has been received on your ICICI Bank Credit Card XX1002 on 02-04-2025. Thank you.'));
    expect(p).toMatchObject({ kind: 'payment', last4: '1002', paidAmount: 1234567, paidOn: '2025-04-02' });
  });
});

describe('categories', () => {
  it('guesses from the merchant', () => {
    expect(categorize('ZOMATO ONLINE ORDER')).toBe('food');
    expect(categorize('SWIGGY INSTAMART')).toBe('groceries');
    expect(categorize('AIRTEL PREPAID RECHARGE')).toBe('bills');
    expect(categorize('APOLLO PHARMACY')).toBe('health');
    expect(categorize('RANDOM SHOP 123')).toBe('other');
    expect(categorize('CASHBACK CREDIT', true)).toBe('refund');
  });
});

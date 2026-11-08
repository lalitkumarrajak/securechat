// Credit card bills: for each card (a credit account: the day each month its statement is made, how
// many days before the due date to remind you) and month, the bill (amount, due date, whether you've
// paid it, or that there was none), and the statement it came from. Plain arithmetic on dates, tested
// on its own (cards.test.ts); model.ts stores the records, and the Calendar turns cardReminders into
// notifications.
import { locale, t } from '@sanga/i18n';
import type { Account } from './types';

const pad2 = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const addDays = (key: string, n: number) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n)); };
export const todayKey = () => dayKey(new Date());

/** A credit card account, with what its bills need filled in (see asCard). */
export type CreditCard = Account & { kind: 'credit'; statementDay: number; dueAfter: number; remind: number[]; time: string };
/** A credit account with its bill settings filled in from the defaults. */
export const asCard = (a: Account): CreditCard => ({ ...a, kind: 'credit', statementDay: a.statementDay ?? 1, dueAfter: a.dueAfter ?? 20, remind: a.remind ?? [3, 1, 0], time: a.time ?? '09:00' });

/** One line of an imported statement: date, description, amount in paise (negative: a credit), category. */
export interface StatementTxn { d: string; t: string; a: number; c: string }
/** A statement read from the bank's PDF or SMS, kept so you can see where the money went. */
export interface CardStatement {
  id: string; type: 'statement';
  card: string;
  month: string;               // YYYY-MM of the statement date, like its bill
  date: string;                // statement date
  from?: string;               // the period it covers
  due?: string;
  total: number; minDue?: number; limit?: number;
  txns: StatementTxn[];
  created: number; edited: number;
  srv?: number; dirty?: boolean; deleted?: boolean;
}
export const MAX_TXNS = 400;
export const statementId = (card: string, month: string) => `s${card}${month.replace('-', '')}`.slice(0, 40);

export interface CardBill {
  id: string; type: 'bill';
  card: string;                // the credit account's id
  month: string;               // YYYY-MM of the statement
  amount: number;              // total due, in the smallest unit (paise, cents)
  minDue?: number;
  due: string;                 // YYYY-MM-DD
  paid?: string;               // YYYY-MM-DD it was paid
  paidAmount?: number;
  split?: boolean;             // already sent to Split as an expense
  none?: boolean;              // no bill this month (nothing spent, or a credit balance): nothing to pay or remind
  created: number; edited: number;
  srv?: number; dirty?: boolean; deleted?: boolean;
}

/** One reminder to send: when, and what it says. */
export interface Reminder { key: string; at: number; title: string; body: string }

// ---------- money (whole numbers of the smallest unit, never floats) ----------
const ZERO_DECIMAL = new Set(['JPY', 'KRW']);
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
const digits = (cur: string) => (ZERO_DECIMAL.has(cur) ? 0 : 2);
export function money(minor: number, cur: string) {
  const d = digits(cur), v = minor / 10 ** d;
  try { return new Intl.NumberFormat(locale(), { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
  catch { return `${cur} ${v.toFixed(d)}`; }
}
/** "1,234.5" → 123450. Null if it isn't an amount. */
export function parseAmount(text: string, cur: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return null;
  const d = digits(cur), [whole, frac = ''] = t.split('.');
  if (frac.length > d) return null;
  const n = Number(whole || '0') * 10 ** d + Number(frac.padEnd(d, '0') || '0');
  return Number.isSafeInteger(n) ? n : null;
}
export const toInput = (minor: number, cur: string) => (minor / 10 ** digits(cur)).toFixed(digits(cur));

// ---------- dates ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const monthOf = (day: string) => day.slice(0, 7);
export const addMonths = (month: string, n: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const daysIn = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const atTime = (day: string, hhmm: string) => new Date(`${day}T${hhmm}`).getTime();

/** The day in `month` a statement made on the card's statement day falls: day 31 in April is April 30. */
export const statementDate = (month: string, day: number) => `${month}-${pad(Math.min(Math.max(1, day), daysIn(month)))}`;

/** The id of a card's bill for a month: the same on every device, so two devices can't make two. */
export const billId = (card: string, month: string) => `b${card}${month.replace('-', '')}`.slice(0, 40);

export const liveCards = (cards: CreditCard[]) => cards.filter((c) => !c.deleted && !c.archived).sort((a, b) => a.name.localeCompare(b.name));
export const liveBills = (bills: CardBill[]) => bills.filter((b) => !b.deleted);

/** The most recent statement (its month and date) that has already been made as of `now`. */
export function lastStatement(card: CreditCard, now: string) {
  const here = monthOf(now);
  const month = statementDate(here, card.statementDay) <= now ? here : addMonths(here, -1);
  return { month, date: statementDate(month, card.statementDay) };
}

/** Cards whose latest statement is out (in the last 25 days) but whose bill you haven't entered yet. */
export function awaitingBill(cards: CreditCard[], bills: CardBill[], now: string) {
  const have = new Set(liveBills(bills).map((b) => b.card + b.month));
  return liveCards(cards).flatMap((card) => {
    const s = lastStatement(card, now);
    const ago = Math.round((new Date(`${now}T12:00:00`).getTime() - new Date(`${s.date}T12:00:00`).getTime()) / 864e5);
    return have.has(card.id + s.month) || ago > 25 ? [] : [{ card, month: s.month, date: s.date }];
  });
}

export type BillState = 'none' | 'paid' | 'overdue' | 'soon' | 'later';
const gap = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);
/** Where a bill stands: paid, past its due date, due within 3 days, or later. */
export const billState = (b: CardBill, now: string): BillState => (b.none ? 'none' : b.paid ? 'paid' : b.due < now ? 'overdue' : gap(now, b.due) <= 3 ? 'soon' : 'later');
/** Days from `now` to the due date (negative once overdue). */
export const daysToDue = (b: CardBill, now: string) => gap(now, b.due);

/** Unpaid bills, most urgent first. */
export const unpaid = (bills: CardBill[]) => liveBills(bills).filter((b) => !b.paid && !b.none).sort((a, b) => a.due.localeCompare(b.due));

/** The bill's due date suggested from the statement: `dueAfter` days later. */
export const suggestedDue = (card: CreditCard, month: string) => addDays(statementDate(month, card.statementDay), card.dueAfter);

// ---------- reminders ----------
const dayName = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });

/** What to remind you of: on each statement day (and two days later) while the bill isn't entered, and before,
 *  on and after the due date of each unpaid bill. Reminders already in the past are left for the caller to drop. */
export function cardReminders(cards: CreditCard[], bills: CardBill[], now: string): Reminder[] {
  const out: Reminder[] = [];
  const all = liveBills(bills);
  for (const card of liveCards(cards)) {
    const mine = all.filter((b) => b.card === card.id);
    // Statements: this month and the next two (the horizon is ~6 weeks).
    for (let k = -1; k <= 2; k++) {
      const month = addMonths(monthOf(now), k), date = statementDate(month, card.statementDay);
      if (mine.some((b) => b.month === month)) continue; // already entered
      out.push({ key: `c|${card.id}|${month}|s`, at: atTime(date, card.time), title: t('💳 {card}: is your bill ready?', { card: card.name }), body: t('Your statement is generated today. Open to add the amount and due date.') });
      out.push({ key: `c|${card.id}|${month}|s2`, at: atTime(addDays(date, 2), card.time), title: t('💳 {card}: still need your bill', { card: card.name }), body: t('Add the amount and due date, and I’ll remind you before it’s due.') });
    }
    for (const b of mine) {
      if (b.paid || b.none) continue;
      const amt = money(b.amount, card.currency);
      for (const d of [...new Set(card.remind)].filter((n) => n >= 0 && n <= 30)) {
        out.push({
          key: `c|${card.id}|${b.month}|d${d}`, at: atTime(addDays(b.due, -d), card.time),
          title: d === 0 ? t('💳 {card}: pay {amount} today', { card: card.name, amount: amt })
            : d === 1 ? t('💳 {card}: {amount} due tomorrow', { card: card.name, amount: amt }) : t('💳 {card}: {amount} due in {n} days', { card: card.name, amount: amt, n: d }),
          body: b.minDue ? t('Due {date} · Minimum {amount}', { date: dayName(b.due), amount: money(b.minDue, card.currency) }) : t('Due {date}', { date: dayName(b.due) }),
        });
      }
      out.push({ key: `c|${card.id}|${b.month}|od`, at: atTime(addDays(b.due, 1), card.time), title: t('⚠️ {card} bill is overdue', { card: card.name }), body: t('{amount} was due {date}. Pay it now to avoid late fees.', { amount: amt, date: dayName(b.due) }) });
    }
  }
  return out;
}

import { parseDay, validDay, today, type Expense } from './model';
import { blankExpense } from './blankExpense';

/** A bill another app sent to Split (the Calendar's credit card bills): checked, since it arrives as text. */
export interface Draft { desc: string; amount: number; cur: string; date: string; cat: string }

export function parseDraft(text: string | undefined): Draft | null {
  if (!text) return null;
  try {
    const d = JSON.parse(text);
    if (typeof d?.desc !== 'string' || !Number.isSafeInteger(d.amount) || d.amount <= 0 || d.amount > 1e12 || !/^[A-Z]{3}$/.test(d.cur)) return null;
    return { desc: d.desc.slice(0, 120), amount: d.amount, cur: d.cur, date: validDay(d.date) && d.date <= today() ? d.date : today(), cat: typeof d.cat === 'string' ? d.cat.slice(0, 40) : 'other' };
  } catch { return null; }
}

/** The expense to start the editor with: you paid, and it's all yours (nothing is split with anyone). */
export function expenseFromDraft(d: Draft, me: string): Expense {
  return { ...blankExpense(me), desc: d.desc, amount: d.amount, cat: d.cat, date: d.date, owed: { [me]: d.amount } };
}
export const dayLabel = (d: string) => parseDay(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

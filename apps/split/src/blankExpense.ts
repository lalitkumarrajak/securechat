import { KIND_CATS, today, type Expense, type GroupKind } from './model';
import { newId } from './store';

/** An empty expense to start the editor with (nothing is saved until the form is submitted). */
export const blankExpense = (me: string, kind: GroupKind = 'spending'): Expense => ({
  type: 'expense', id: newId(), desc: '', amount: 0, cat: KIND_CATS[kind][0] ?? 'food', date: today(), paidBy: me, mode: 'equal', values: {}, owed: {}, by: me, edited: 0,
});

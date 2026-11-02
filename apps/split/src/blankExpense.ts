import { today, type Expense } from './model';
import { newId } from './store';

/** An empty expense to start the editor with (nothing is saved until the form is submitted). */
export const blankExpense = (me: string): Expense => ({
  type: 'expense', id: newId(), desc: '', amount: 0, cat: 'food', date: today(), paidBy: me, mode: 'equal', values: {}, owed: {}, by: me, edited: 0,
});

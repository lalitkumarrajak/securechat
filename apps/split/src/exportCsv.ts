import { money, type Expense, type Meta } from './model';

// A cell that starts with = + - @ would run as a formula in a spreadsheet: a leading ' keeps it text.
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; // i18n-ok
};

/** The group's expenses as a spreadsheet file, one row per expense and a column per person's share. */
export function expensesCsv(meta: Meta, expenses: Expense[], nameOf: (id: string) => string): string {
  const cats = new Map(meta.cats.map((c) => [c.id, c.name]));
  const people = meta.people;
  const head = ['Date', 'Description', 'Category', `Amount (${meta.currency})`, 'Paid by', ...people.map((p) => `${nameOf(p.id)} owes`), 'Notes']; // i18n-ok: the file's columns stay in English
  const rows = [...expenses].sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => [
    e.date, e.desc, cats.get(e.cat) ?? e.cat, money(e.amount, meta.currency).replace(/[^\d.\-−]/g, '').replace('−', '-'), nameOf(e.paidBy),
    ...people.map((p) => money(e.owed[p.id] ?? 0, meta.currency).replace(/[^\d.\-−]/g, '')), e.notes ?? '',
  ]);
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

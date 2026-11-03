import { locale, t, tx } from '@sanga/i18n';
import { useMemo, useState } from 'react';
import { HandCoins, Search } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { catName, money, parseDay, type Expense } from './model';
import { useLedger, useMe, useNames } from './hooks';
import type { GroupData } from './store';
import { Empty } from './Empty';
import { ExpenseRow } from './ExpenseRow';

type Item = { kind: 'e'; e: Expense } | { kind: 's'; id: string; date: string; text: string };

/** The group's expenses and payments, newest first, by day; searchable and filterable by category. */
export function ExpensesTab({ g, onOpen }: { g: GroupData; onOpen: (e: Expense) => void }) {
  const me = useMe();
  const name = useNames();
  const { meta, expenses, settles, person, catOf } = useLedger(g);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const currency = meta?.currency ?? 'INR';

  const used = useMemo(() => [...new Set(expenses.map((e) => e.cat))], [expenses]);
  const days = useMemo(() => {
    const s = q.trim().toLowerCase();
    const items: Item[] = expenses
      .filter((e) => (!cat || e.cat === cat) && (!s || e.desc.toLowerCase().includes(s) || (e.notes ?? '').toLowerCase().includes(s) || catName(catOf(e.cat)).toLowerCase().includes(s)))
      .map((e) => ({ kind: 'e' as const, e }));
    if (!cat && !s) {
      for (const p of settles) {
        const v = { from: name(person(p.from)), to: name(person(p.to)), amount: money(p.amount, currency) };
        items.push({ kind: 's', id: p.id, date: p.date, text: p.pending ? t('{from} paid {to} {amount} · waiting for confirmation', v) : t('{from} paid {to} {amount}', v) });
      }
    }
    items.sort((a, b) => { const da = a.kind === 'e' ? a.e.date : a.date, db = b.kind === 'e' ? b.e.date : b.date; return da < db ? 1 : da > db ? -1 : 0; });
    const out: { day: string; items: Item[] }[] = [];
    for (const it of items) {
      const day = it.kind === 'e' ? it.e.date : it.date;
      (out.at(-1)?.day === day ? out.at(-1)! : out[out.push({ day, items: [] }) - 1]).items.push(it);
    }
    return out;
  }, [expenses, settles, q, cat, currency, name, person, catOf]);

  if (!expenses.length && !settles.length) return <Empty emoji="🧾" title={t('No expenses yet')}>{tx('Tap {plus} to add the first one.', { plus: <b>+</b> })}</Empty>;

  return (
    <div>
      <div className="space-y-2 px-4 pb-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search expenses')} aria-label={t('Search expenses')}
            className="h-10 w-full rounded-xl border border-line bg-panel-2 pr-3 pl-9 text-sm outline-none focus:border-accent" />
        </label>
        {used.length > 1 && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label={t('Filter by category')}>
            {used.map((id) => {
              const c = catOf(id);
              return (
                <button key={id} type="button" aria-pressed={cat === id} onClick={() => setCat(cat === id ? null : id)}
                  className={cn('shrink-0 rounded-full border px-3 py-1 text-sm transition', cat === id ? 'border-transparent font-semibold text-white' : 'border-line hover:bg-hover')}
                  style={cat === id ? { background: c.color } : undefined}>{c.emoji} {catName(c)}</button>
              );
            })}
          </div>
        )}
      </div>
      {days.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{t('Nothing matches.')}</p>}
      {days.map(({ day, items }) => (
        <section key={day} aria-label={day}>
          <h3 className="sticky top-0 z-[1] bg-bg/95 px-4 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase backdrop-blur">
            {parseDay(day).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: parseDay(day).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}
          </h3>
          <ul className="divide-y divide-line bg-panel">
            {items.map((it) => it.kind === 's' ? (
              <li key={it.id} className="flex items-center gap-3 px-4 py-3 text-sm text-muted">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600"><HandCoins className="size-5" /></span>{it.text}
              </li>
            ) : (
              <li key={it.e.id}>
                <ExpenseRow e={it.e} cat={catOf(it.e.cat)} payer={name(person(it.e.paidBy))} currency={currency} involved={it.e.paidBy === me || (it.e.owed[me] ?? 0) > 0} addedBy={(it.e.addedBy ?? it.e.by) !== me ? name(person(it.e.addedBy ?? it.e.by)) : undefined} onOpen={() => onOpen(it.e)}
                  mine={it.e.paidBy === me ? it.e.amount - (it.e.owed[me] ?? 0) : -(it.e.owed[me] ?? 0)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

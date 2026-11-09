// Where the money went, from imported statements: for one card or all of them, one month's statement or
// every month: spending day by day, by category, the places you spent most, month by month, and each
// purchase (change what it was for, and the charts follow). Cashback, from statements and added by hand,
// is counted on its own: what came back, and as a share of what was spent.
import { useMemo, useState } from 'react';
import { FileUp, Search } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Input } from '@sanga/ui/input';
import { cn } from '@sanga/ui/utils';
import { locale, t, tn } from '@sanga/i18n';
import { addDays, cashbackList, creditCards, money, save, useLedger, type CardStatement } from '@sanga/ledger';
import { CATS, CREDIT_CATS, savedCat, SPEND_CATS, type Cat } from '@sanga/ledger/statement';
import { Columns, Ranking, type Bar } from './charts';
import { monthTitle, SELECT, shortDay } from './util';

interface Line { st: CardStatement; i: number; d: string; t: string; a: number; c: Cat; card: string }
const isCat = (c: string): c is Cat => c in CATS;
const merchant = (s: string) => s.replace(/\b(pvt|private|ltd|limited|india|in|www|com|online|payments?|bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|kolkata|gurgaon|noida)\b/gi, '').replace(/[^a-z& ]/gi, ' ').trim().split(/\s+/).slice(0, 2).join(' ').toUpperCase() || s.slice(0, 16);

export function SpendView({ focus, onImport }: { focus?: string | null; onImport: () => void }) {
  const statementsMap = useLedger((s) => s.statements);
  const accounts = useLedger((s) => s.accounts);
  const entriesMap = useLedger((s) => s.entries);
  const cards = useMemo(() => creditCards(), [accounts]);
  const statements = useMemo(() => Object.values(statementsMap).filter((x) => !x.deleted && cards.some((c) => c.id === x.card)), [statementsMap, cards]);
  const focused = focus ? statementsMap[focus] : undefined;
  const [card, setCard] = useState<string>(focused?.card ?? 'all');
  const mine = useMemo(() => statements.filter((x) => card === 'all' || x.card === card), [statements, card]);
  const months = useMemo(() => [...new Set(mine.map((x) => x.month))].sort().reverse(), [mine]);
  const [month, setMonth] = useState<string>(focused?.month ?? 'latest');
  const m = month === 'latest' ? months[0] ?? 'all' : month;
  const [day, setDay] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const currency = (card === 'all' ? cards[0] : cards.find((c) => c.id === card))?.currency ?? 'INR';
  const fmt = (n: number) => money(n, currency);
  const compact = (n: number) => new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n / 100);

  const inScope = useMemo(() => mine.filter((x) => m === 'all' || x.month === m), [mine, m]);
  const lines: Line[] = useMemo(() => inScope.flatMap((st) => st.txns.map((x, i) => ({ st, i, d: x.d, t: x.t, a: x.a, c: ((c) => (isCat(c) ? c : 'other'))(savedCat(x.c, x.t)) as Cat, card: st.card }))), [inScope]);
  const spend = useMemo(() => lines.filter((l) => l.a > 0), [lines]);
  const refunds = useMemo(() => lines.filter((l) => l.a < 0 && l.c === 'refund').reduce((s, l) => s - l.a, 0), [lines]);
  const total = spend.reduce((s, l) => s + l.a, 0);
  // Cashback the cards in view earned in this month (or every month): statement lines and entries added by hand.
  const cashback = useMemo(() => cashbackList({ ...useLedger.getState(), statements: statementsMap, entries: entriesMap, accounts })
    .filter((x) => x.card && (card === 'all' ? cards.some((c) => c.id === x.card) : x.card === card) && (m === 'all' || x.month === m))
    .reduce((n, x) => n + x.amount, 0), [statementsMap, entriesMap, accounts, cards, card, m]);

  // Day by day over the statement period (or, for every month, month by month).
  const dayBars: Bar[] = useMemo(() => {
    if (m === 'all' || !inScope.length) return [];
    const to = inScope.reduce((x, s) => (s.date > x ? s.date : x), inScope[0].date);
    const from = inScope.reduce((x, s) => { const f = s.from ?? addDays(s.date, -30); return f < x ? f : x; }, to);
    const sums = new Map<string, number>();
    for (const l of spend) sums.set(l.d, (sums.get(l.d) ?? 0) + l.a);
    const out: Bar[] = [];
    for (let d = spend.reduce((x, l) => (l.d < x ? l.d : x), from); d <= to && out.length < 62; d = addDays(d, 1)) out.push({ key: d, label: String(Number(d.slice(8))), value: sums.get(d) ?? 0, title: shortDay(d) });
    return out;
  }, [inScope, spend, m]);
  const monthBars: Bar[] = useMemo(() => {
    const sums = new Map<string, number>();
    for (const st of mine) for (const x of st.txns) if (x.a > 0) sums.set(st.month, (sums.get(st.month) ?? 0) + x.a);
    return [...sums.keys()].sort().slice(-12).map((k) => ({ key: k, label: new Date(`${k}-01T12:00:00`).toLocaleDateString(locale(), { month: 'short' }), value: sums.get(k)!, title: monthTitle(k) }));
  }, [mine]);
  const byCat = useMemo(() => {
    const sums = new Map<Cat, number>();
    for (const l of spend) sums.set(l.c, (sums.get(l.c) ?? 0) + l.a);
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, name: t(CATS[k].label), emoji: CATS[k].emoji, value: v }));
  }, [spend]);
  const places = useMemo(() => {
    const sums = new Map<string, { v: number; n: number }>();
    for (const l of spend) { const k = merchant(l.t), x = sums.get(k) ?? { v: 0, n: 0 }; x.v += l.a; x.n++; sums.set(k, x); }
    return [...sums.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 6).map(([k, x]) => ({ key: k, name: k, value: x.v, note: tn(x.n, '{n} time', '{n} times') }));
  }, [spend]);
  const peak = dayBars.reduce<Bar | null>((x, b) => (!x || b.value > x.value ? b : x), null);
  const shown = useMemo(() => lines.filter((l) => (!day || l.d === day) && (!cat || l.c === cat) && (!q || l.t.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.d.localeCompare(a.d)), [lines, day, cat, q]);

  const recat = (l: Line, c: Cat) => {
    const txns = l.st.txns.map((x, j) => (j === l.i ? { ...x, c } : x));
    void save({ ...l.st, txns });
  };

  if (!statements.length) {
    return (
      <div className="grid place-items-center rounded-3xl border border-line/70 bg-panel px-6 py-12 text-center shadow-sm">
        <div className="max-w-sm">
          <span className="text-4xl" aria-hidden>📊</span>
          <h3 className="mt-2 text-lg font-bold">{t('See where your card money goes')}</h3>
          <p className="mt-1 text-sm text-muted">{t('Import a card statement: every purchase is sorted into food, shopping, fuel, bills and more, with a chart by date.')}</p>
          <Button className="mt-4" onClick={onImport}><FileUp className="size-4" />{t('Import a statement')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select aria-label={t('Card')} className={cn(SELECT, 'w-auto')} value={card} onChange={(e) => { setCard(e.target.value); setMonth('latest'); setDay(null); }}>
          <option value="all">{t('All cards')}</option>
          {cards.filter((c) => statements.some((s) => s.card === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label={t('Statement')} className={cn(SELECT, 'w-auto')} value={month === 'latest' ? m : month} onChange={(e) => { setMonth(e.target.value); setDay(null); }}>
          {months.map((x) => <option key={x} value={x}>{monthTitle(x)}</option>)}
          <option value="all">{t('Every month')}</option>
        </select>
        <Button variant="ghost" className="ml-auto" onClick={onImport}><FileUp className="size-4" />{t('Import')}</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t('Spent')} value={fmt(total - refunds)} note={refunds ? t('after {amount} refunds', { amount: fmt(refunds) }) : undefined} strong />
        {cashback > 0
          ? <Tile label={t('Cashback')} value={fmt(cashback)} note={total - refunds > 0 ? t('{p}% of what you spent', { p: (Math.round((cashback / (total - refunds)) * 1000) / 10).toLocaleString(locale()) }) : undefined} />
          : <Tile label={t('Purchases')} value={String(spend.length)} />}
        {peak && peak.value > 0 ? <Tile label={t('Biggest day')} value={fmt(peak.value)} note={peak.title} /> : <Tile label={t('Months')} value={String(months.length)} />}
        <Tile label={t('Top category')} value={byCat[0] ? `${byCat[0].emoji} ${byCat[0].name}` : '—'} note={byCat[0] ? fmt(byCat[0].value) : undefined} />
      </div>

      {dayBars.length > 0 && (
        <section className="rounded-3xl border border-line/70 bg-panel p-4 shadow-sm">
          <h3 className="font-semibold">{t('Spending by date')}</h3>
          <Columns bars={dayBars} active={day} onPick={setDay} fmt={fmt} compact={compact} every={dayBars.length > 20 ? 5 : 2}
            summary={t('Spending each day, highest {amount}', { amount: fmt(peak?.value ?? 0) })} />
        </section>
      )}
      {monthBars.length > 1 && (
        <section className="rounded-3xl border border-line/70 bg-panel p-4 shadow-sm">
          <h3 className="font-semibold">{t('Month by month')}</h3>
          <Columns bars={monthBars} active={m === 'all' ? null : m} onPick={(k) => { setMonth(k ?? 'all'); setDay(null); }} fmt={fmt} compact={compact} every={1}
            summary={t('Card spending each month')} />
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl border border-line/70 bg-panel p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">{t('By category')}</h3>
          <Ranking rows={byCat} active={cat} onPick={setCat} fmt={fmt} />
        </section>
        <section className="rounded-3xl border border-line/70 bg-panel p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">{t('Where you spent most')}</h3>
          <Ranking rows={places} fmt={fmt} />
        </section>
      </div>

      <section className="rounded-3xl border border-line/70 bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <h3 className="flex-1 font-semibold">{t('Transactions')}</h3>
          {(day || cat) && <button type="button" className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent-ink" onClick={() => { setDay(null); setCat(null); }}>
            {[day && shortDay(day), cat && isCat(cat) && t(CATS[cat].label)].filter(Boolean).join(' · ')} ✕</button>}
          <label className="relative w-full sm:w-56"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input aria-label={t('Search')} placeholder={t('Search')} value={q} onChange={(e) => setQ(e.target.value)} className="h-9 pl-9" /></label>
        </div>
        <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
          {shown.map((l) => (
            <li key={l.st.id + l.i} className="flex items-center gap-2 px-3 py-2">
              <span className="w-12 shrink-0 text-xs text-muted">{shortDay(l.d)}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{l.t}</span>
              {l.a > 0 ? (
                <select aria-label={t('Category')} value={l.c} onChange={(e) => recat(l, e.target.value as Cat)} className="h-8 max-w-32 shrink-0 rounded-lg sm:max-w-40 border border-line bg-panel-2 px-1 text-xs">
                  {SPEND_CATS.map((c) => <option key={c} value={c}>{CATS[c].emoji} {t(CATS[c].label)}</option>)}
                </select>
              ) : (
                <select aria-label={t('Category')} value={l.c} onChange={(e) => recat(l, e.target.value as Cat)} className="h-8 max-w-32 shrink-0 rounded-lg sm:max-w-40 border border-line bg-panel-2 px-1 text-xs">
                  {(CREDIT_CATS.includes(l.c) ? CREDIT_CATS : [l.c, ...CREDIT_CATS]).map((c) => <option key={c} value={c}>{CATS[c].emoji} {t(CATS[c].label)}</option>)}
                </select>
              )}
              <span className={cn('w-20 shrink-0 text-right text-sm tabular-nums', l.a < 0 && 'text-green-600 dark:text-green-400')}>{l.a < 0 ? '+' : ''}{fmt(Math.abs(l.a))}</span>
            </li>
          ))}
          {!shown.length && <li className="p-4 text-center text-sm text-muted">{t('Nothing here.')}</li>}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={cn('rounded-3xl p-4 shadow-sm', strong ? 'text-white' : 'border border-line/70 bg-panel')} style={strong ? { background: 'linear-gradient(135deg, #6366f1, #312e81)' } : undefined}>
      <p className={cn('text-sm', strong ? 'text-white/80' : 'text-muted')}>{label}</p>
      <p className="mt-0.5 truncate text-xl font-bold tabular-nums">{value}</p>
      {note && <p className={cn('truncate text-xs', strong ? 'text-white/75' : 'text-muted')}>{note}</p>}
    </div>
  );
}

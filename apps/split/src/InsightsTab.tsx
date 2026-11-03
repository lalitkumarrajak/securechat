import { locale, t, tn } from '@sanga/i18n';
import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import {
  addDays, BUILTIN_CATS, byCategory, catName, categoryMap, catOf, daysBetween, grainFor, inRange, linesOf, money, parseDay, rangeFor, series, sum, today,
  type Bucket, type Category, type Line, type Preset, type Range,
} from './model';
import { useMe, useNames } from './hooks';
import { useSplit } from './store';
import { BarChart } from './BarChart';
import { Donut } from './Donut';
import { Empty } from './Empty';
import { PeriodBar } from './PeriodBar';

type Scope = { kind: 'group'; gid: string } | { kind: 'all' };
const fmtDay = (d: string, o: Intl.DateTimeFormatOptions) => parseDay(d).toLocaleDateString(locale(), o);

/** Where the money went: by period, by category and over time. For one group, or for you across all of them. */
export function InsightsTab({ scope }: { scope: Scope }) {
  const me = useMe();
  const name = useNames();
  const groups = useSplit((s) => s.groups);
  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState<Range>(() => rangeFor('last30'));
  const [view, setView] = useState<'share' | 'total'>('share');
  const [cur, setCur] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [bucket, setBucket] = useState<string | null>(null);

  const all = useMemo(() => Object.values(groups).filter((g) => g.meta && (scope.kind === 'all' || g.gid === scope.gid)), [groups, scope]);
  const currencies = useMemo(() => {
    const n = new Map<string, number>();
    for (const g of all) n.set(g.meta!.currency, (n.get(g.meta!.currency) ?? 0) + Object.keys(g.expenses).length);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [all]);
  const currency = cur && currencies.includes(cur) ? cur : currencies[0] ?? 'INR';
  const effView = scope.kind === 'all' ? 'share' : view;

  const cats = useMemo(() => {
    const m = categoryMap();
    for (const g of all) for (const c of g.meta!.cats) m.set(c.id, c);
    return m;
  }, [all]);
  const lines = useMemo(() => all.filter((g) => g.meta!.currency === currency).flatMap((g) => linesOf(g.gid, Object.values(g.expenses), effView, me)), [all, currency, effView, me]);

  const first = useMemo(() => lines.reduce((m, l) => (l.date < m ? l.date : m), today()), [lines]);
  const range: Range = preset === 'custom' ? custom : preset === 'all' ? { from: first, to: today() } : rangeFor(preset);
  const days = daysBetween(range.from, range.to) + 1;
  const inside = useMemo(() => inRange(lines, range), [lines, range.from, range.to]);
  const prev = useMemo(() => inRange(lines, { from: addDays(range.from, -days), to: addDays(range.from, -1) }), [lines, range.from, days]);
  const total = sum(inside), before = sum(prev);
  const grain = grainFor(range);
  const buckets = useMemo(() => series(inside, range, grain), [inside, range.from, range.to, grain]);
  const picked = bucket ? buckets.find((b) => b.key === bucket) ?? null : null;
  const shown = inside.filter((l) => (!cat || l.cat === cat) && (!picked || (l.date >= picked.from && l.date <= picked.to)));
  const ranked = useMemo(() => byCategory(inside), [inside]);
  const bucketLabel = (b: Bucket) => grain === 'month' ? fmtDay(b.key, { month: 'short' }) : grain === 'week' ? fmtDay(b.key, { day: 'numeric', month: 'short' }) : fmtDay(b.key, { day: 'numeric', month: days > 10 ? undefined : 'short' });
  const bucketTitle = (b: Bucket) => grain === 'month' ? fmtDay(b.key, { month: 'long', year: 'numeric' }) : grain === 'week' ? `${fmtDay(b.from, { day: 'numeric', month: 'short' })} – ${fmtDay(b.to, { day: 'numeric', month: 'short' })}` : fmtDay(b.key, { weekday: 'long', day: 'numeric', month: 'long' });
  const delta = before > 0 ? Math.round(((total - before) / before) * 100) : null;
  const top = ranked[0];

  // Who paid (the whole bill, whoever it was for): one group only.
  const paid = useMemo(() => {
    if (scope.kind !== 'group') return [];
    const g = groups[scope.gid];
    const by = new Map<string, number>();
    for (const e of Object.values(g?.expenses ?? {})) if (!e.deleted && e.date >= range.from && e.date <= range.to) by.set(e.paidBy, (by.get(e.paidBy) ?? 0) + e.amount);
    return [...by.entries()].map(([id, v]) => ({ id, v, p: g?.meta?.people.find((p) => p.id === id) ?? { id, name: id } })).sort((a, b) => b.v - a.v);
  }, [groups, scope, range.from, range.to]);

  if (!lines.length) return <Empty emoji="📊" title={t('Nothing to chart yet')}>{t('Add some expenses and your spending shows up here.')}</Empty>;

  const catAt = (id: string): Category => catOf(cats, id) ?? BUILTIN_CATS[0];
  const reset = (fn: () => void) => { fn(); setCat(null); setBucket(null); };

  return (
    <div className="space-y-5 px-4 pb-8">
      <PeriodBar preset={preset} onPreset={(p) => reset(() => { setPreset(p); })} from={range.from} to={range.to} min={first} onDates={(from, to) => reset(() => setCustom({ from, to }))} />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {scope.kind === 'group' && (
          <div className="flex rounded-full bg-panel-2 p-1" role="group" aria-label={t('Whose spending')}>
            {([['share', t('My share')], ['total', t('Group total')]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn('rounded-full px-3 py-1 font-medium transition', view === v ? 'bg-panel shadow-sm' : 'text-muted')}>{label}</button>
            ))}
          </div>
        )}
        {currencies.length > 1 && (
          <select value={currency} onChange={(e) => reset(() => setCur(e.target.value))} aria-label={t('Currency')} className="h-8 rounded-full border border-line bg-panel px-3">
            {currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        <span className="text-muted">{fmtDay(range.from, { day: 'numeric', month: 'short', year: 'numeric' })}{range.from !== range.to && ` – ${fmtDay(range.to, { day: 'numeric', month: 'short', year: 'numeric' })}`}</span>
      </div>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label={t('Summary')}>
        <Tile label={effView === 'share' ? t('You spent') : t('Group spent')} value={money(total, currency)}>
          {delta !== null && (
            <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', delta > 0 ? 'text-danger' : 'text-emerald-600 dark:text-emerald-400')}>
              {delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{tn(days, '{pct}% vs previous day', '{pct}% vs previous {n} days', { pct: Math.abs(delta) })}
            </span>
          )}
        </Tile>
        <Tile label={t('Expenses')} value={String(inside.length)} />
        <Tile label={t('Per day')} value={money(Math.round(total / days), currency)} />
        <Tile label={t('Most spent on')} value={top ? `${catAt(top.cat).emoji} ${catName(catAt(top.cat))}` : '—'}>
          {top && total > 0 && <span className="text-xs text-muted">{Math.round((top.total / total) * 100)}% · {money(top.total, currency)}</span>}
        </Tile>
      </section>

      {inside.length === 0 ? <p className="rounded-2xl border border-line bg-panel p-6 text-center text-sm text-muted">{t('No spending in this period.')}</p> : (
        <>
          <section aria-label={t('Spending over time')} className="rounded-2xl border border-line bg-panel p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{grain === 'day' ? t('Day by day') : grain === 'week' ? t('Week by week') : t('Month by month')}</h3>
              <p className="text-sm text-muted tabular-nums" aria-live="polite">{picked ? `${bucketTitle(picked)}: ${money(picked.total, currency)}` : t('Tap a bar for details')}</p>
            </div>
            <BarChart buckets={buckets} currency={currency} active={bucket} onPick={setBucket} label={bucketLabel} />
          </section>

          <section aria-label={t('Spending by category')} className="rounded-2xl border border-line bg-panel p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('By category')}</h3>
            <div className="grid items-center gap-5 sm:grid-cols-[220px_1fr]">
              <Donut slices={ranked.map((r) => ({ key: r.cat, value: r.total, color: catAt(r.cat).color, label: `${catName(catAt(r.cat))}: ${money(r.total, currency)}` }))}
                active={cat} onPick={setCat} summary={t('Spending by category. {top}', { top: ranked.slice(0, 3).map((r) => `${catName(catAt(r.cat))} ${Math.round((r.total / total) * 100)}%`).join(', ') })}
                center={<span><span className="block text-xs text-muted">{t('Total')}</span><span className="block text-base font-bold tabular-nums">{money(total, currency, { compact: true })}</span></span>} />
              <ul className="space-y-1">
                {ranked.map((r) => {
                  const c = catAt(r.cat), pct = total ? (r.total / total) * 100 : 0;
                  return (
                    <li key={r.cat}>
                      <button type="button" aria-pressed={cat === r.cat} onClick={() => setCat(cat === r.cat ? null : r.cat)}
                        className={cn('w-full rounded-xl px-2 py-1.5 text-left transition hover:bg-hover', cat === r.cat && 'bg-hover')}>
                        <span className="flex items-center gap-2 text-sm">
                          <span aria-hidden>{c.emoji}</span><span className="min-w-0 flex-1 truncate font-medium">{catName(c)}</span>
                          <span className="tabular-nums text-muted">{r.count}×</span>
                          <span className="w-24 text-right font-semibold tabular-nums">{money(r.total, currency)}</span>
                          <span className="w-10 text-right text-xs tabular-nums text-muted">{pct < 1 ? '<1' : Math.round(pct)}%</span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-panel-2"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section aria-label={t('Expenses in this view')} className="rounded-2xl border border-line bg-panel">
            <h3 className="px-4 pt-4 pb-2 text-sm font-semibold">
              {cat || picked ? `${cat ? catName(catAt(cat)) : t('Expenses')}${picked ? ` · ${bucketTitle(picked)}` : ''}` : t('Biggest expenses')}
              <span className="ml-2 font-normal text-muted">{cat || picked ? `${shown.length} · ${money(sum(shown), currency)}` : ''}</span>
            </h3>
            <ul className="divide-y divide-line">
              {(cat || picked ? [...shown].sort((a, b) => (a.date < b.date ? 1 : -1)) : [...inside].sort((a, b) => b.amount - a.amount).slice(0, 5)).slice(0, 50).map((l: Line) => (
                <li key={l.group + l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: catAt(l.cat).color + '26' }} aria-hidden>{catAt(l.cat).emoji}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{l.desc}</span>
                    <span className="block text-xs text-muted">{fmtDay(l.date, { day: 'numeric', month: 'short', year: 'numeric' })}{scope.kind === 'all' && ` · ${groups[l.group]?.meta?.name}`}</span></span>
                  <span className="font-semibold tabular-nums">{money(l.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </section>

          {paid.length > 0 && (
            <section aria-label={t('Who paid')} className="rounded-2xl border border-line bg-panel p-4">
              <h3 className="mb-2 text-sm font-semibold">{t('Who paid')}</h3>
              <ul className="space-y-2">
                {paid.map(({ id, v, p }) => (
                  <li key={id}>
                    <span className="flex justify-between text-sm"><span>{name(p)}</span><span className="font-semibold tabular-nums">{money(v, currency)}</span></span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-panel-2"><span className="block h-full rounded-full bg-accent" style={{ width: `${(v / paid[0].v) * 100}%` }} /></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-panel p-3.5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 truncate text-lg font-bold tabular-nums">{value}</p>
      {children}
    </div>
  );
}

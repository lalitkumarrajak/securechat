import { locale, t, tn } from '@sanga/i18n';
import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import {
  addDays, BUILTIN_CATS, byCategory, catName, categoryMap, catOf, daysBetween, grainFor, inRange, isSpending, kindOf, linesOf, money, parseDay, rangeFor, series, sum, today,
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
  const [showMoved, setShowMoved] = useState(false);

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
  const every = useMemo(() => all.filter((g) => g.meta!.currency === currency).flatMap((g) => linesOf(g.gid, Object.values(g.expenses), effView, me)), [all, currency, effView, me]);
  // Spending only: paying card bills, lending and borrowing move money (in groups for them, or in those
  // categories); they're listed apart below. A card bills or lending group's own view shows all of it.
  const kindIn = (gid: string) => kindOf(groups[gid]?.meta);
  const ownKind = scope.kind === 'group' ? kindIn(scope.gid) : 'spending';
  const own = ownKind !== 'spending';
  const counts = (l: Line) => own || (kindIn(l.group) === 'spending' && isSpending(l.cat));
  const lines = useMemo(() => every.filter(counts), [every, own, groups]);

  const first = useMemo(() => every.reduce((m, l) => (l.date < m ? l.date : m), today()), [every]);
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
  // What was left out, under the heading it belongs to: a card bills group's payments are card bills, and so on.
  const movedLines = useMemo(() => inRange(every.filter((l) => !counts(l)).map((l) => {
    const k = kindIn(l.group);
    return k === 'cards' ? { ...l, cat: 'cards' } : k === 'lending' && isSpending(l.cat) ? { ...l, cat: 'lent' } : l;
  }), range).sort((a, b) => (a.date < b.date ? 1 : -1)), [every, range.from, range.to, own, groups]);
  const moved = useMemo(() => byCategory(movedLines), [movedLines]);
  const movedTotal = sum(movedLines);
  // A card bills group's own view: what each card's bills add up to. The Calendar names a bill after its
  // card ("HDFC Millennia card bill"), so bills with the same name are the same card.
  const byCard = useMemo(() => {
    if (ownKind !== 'cards') return [];
    const m = new Map<string, { name: string; total: number; count: number }>();
    for (const l of inside) {
      const key = l.desc.trim().toLowerCase();
      const row = m.get(key) ?? { name: l.desc.trim(), total: 0, count: 0 };
      row.total += l.amount; row.count++;
      m.set(key, row);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [inside, ownKind]);
  const biggest = inside.reduce<Line | null>((m, l) => (!m || l.amount > m.amount ? l : m), null);

  // Who paid (the whole bill, whoever it was for): one group only.
  const paid = useMemo(() => {
    if (scope.kind !== 'group') return [];
    const g = groups[scope.gid];
    const by = new Map<string, number>();
    for (const e of Object.values(g?.expenses ?? {})) if (!e.deleted && e.date >= range.from && e.date <= range.to) by.set(e.paidBy, (by.get(e.paidBy) ?? 0) + e.amount);
    return [...by.entries()].map(([id, v]) => ({ id, v, p: g?.meta?.people.find((p) => p.id === id) ?? { id, name: id } })).sort((a, b) => b.v - a.v);
  }, [groups, scope, range.from, range.to]);

  if (!every.length) return <Empty emoji="📊" title={t('Nothing to chart yet')}>{t('Add some expenses and your spending shows up here.')}</Empty>;

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
        <Tile label={own ? (ownKind === 'cards' ? t('Card bills paid') : t('Total')) : effView === 'share' ? t('You spent') : t('Group spent')} value={money(total, currency)}>
          {delta !== null && (
            <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', delta > 0 ? 'text-danger' : 'text-emerald-600 dark:text-emerald-400')}>
              {delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{tn(days, '{pct}% vs previous day', '{pct}% vs previous {n} days', { pct: Math.abs(delta) })}
            </span>
          )}
        </Tile>
        <Tile label={ownKind === 'cards' ? t('Bills') : t('Expenses')} value={String(inside.length)} />
        <Tile label={t('Per day')} value={money(Math.round(total / days), currency)} />
        {own ? (
          // In a card bills or lending group every entry is the same kind: the biggest one says more.
          <Tile label={ownKind === 'cards' ? t('Biggest bill') : t('Biggest')} value={biggest ? money(biggest.amount, currency) : '—'}>
            {biggest && <span className="block truncate text-xs text-muted">{biggest.desc}</span>}
          </Tile>
        ) : (
          <Tile label={t('Most spent on')} value={top ? `${catAt(top.cat).emoji} ${catName(catAt(top.cat))}` : '—'}>
            {top && total > 0 && <span className="text-xs text-muted">{Math.round((top.total / total) * 100)}% · {money(top.total, currency)}</span>}
          </Tile>
        )}
      </section>

      {own && (
        <p className="rounded-2xl bg-panel-2 px-4 py-3 text-sm text-muted">
          {ownKind === 'cards' ? t('A credit card bills group: it isn’t counted in My spending, since what you bought with the cards already is.')
            : t('A lending & borrowing group: it isn’t counted in My spending. Balances show who owes whom.')}
        </p>
      )}
      {moved.length > 0 && (
        <section aria-label={t('Not counted as spending')} className="rounded-2xl border border-line bg-panel p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">{t('Not counted as spending')}</h3>
            <span className="text-lg font-bold tabular-nums">{money(movedTotal, currency)}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted">{t('Paying a card bill only moves money: what you bought with the card is the spending. Lent and borrowed money stays in balances.')}</p>
          <ul className="mt-3 space-y-1.5">
            {moved.map((m) => (
              <li key={m.cat} className="flex items-center gap-2 text-sm">
                <span aria-hidden>{catAt(m.cat).emoji}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{m.cat === 'cards' ? t('Card bills') : catName(catAt(m.cat))}</span>
                <span className="text-muted tabular-nums">{m.count}×</span>
                <span className="w-28 text-right font-semibold tabular-nums">{money(m.total, currency)}</span>
              </li>
            ))}
          </ul>
          <button type="button" aria-expanded={showMoved} onClick={() => setShowMoved(!showMoved)} className="mt-2 text-sm font-medium text-accent hover:underline">
            {showMoved ? t('Hide them') : tn(movedLines.length, 'Show it', 'Show all {n}')}
          </button>
          {showMoved && (
            <ul className="mt-2 divide-y divide-line border-t border-line">
              {movedLines.map((l) => (
                <li key={l.group + l.id} className="flex items-center gap-3 py-2 text-sm">
                  <span aria-hidden>{catAt(l.cat).emoji}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{l.desc}</span>
                    <span className="block text-xs text-muted">{fmtDay(l.date, { day: 'numeric', month: 'short', year: 'numeric' })}{scope.kind === 'all' && ` · ${groups[l.group]?.meta?.name}`}</span></span>
                  <span className="font-semibold tabular-nums">{money(l.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {inside.length === 0 ? <p className="rounded-2xl border border-line bg-panel p-6 text-center text-sm text-muted">{t('No spending in this period.')}</p> : (
        <>
          <section aria-label={t('Spending over time')} className="rounded-2xl border border-line bg-panel p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{grain === 'day' ? t('Day by day') : grain === 'week' ? t('Week by week') : t('Month by month')}</h3>
              <p className="text-sm text-muted tabular-nums" aria-live="polite">{picked ? `${bucketTitle(picked)}: ${money(picked.total, currency)}` : t('Tap a bar for details')}</p>
            </div>
            <BarChart buckets={buckets} currency={currency} active={bucket} onPick={setBucket} label={bucketLabel} />
          </section>

          {byCard.length > 0 && (
            <section aria-label={t('By card')} className="rounded-2xl border border-line bg-panel p-4">
              <h3 className="mb-3 text-sm font-semibold">{t('By card')}</h3>
              <ul className="space-y-2">
                {byCard.map((c) => (
                  <li key={c.name}>
                    <span className="flex items-center gap-2 text-sm">
                      <span aria-hidden>💳</span><span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                      <span className="tabular-nums text-muted">{c.count}×</span>
                      <span className="w-28 text-right font-semibold tabular-nums">{money(c.total, currency)}</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-panel-2"><span className="block h-full rounded-full bg-indigo-500" style={{ width: `${total ? (c.total / total) * 100 : 0}%` }} /></span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ownKind !== 'cards' && <section aria-label={t('Spending by category')} className="rounded-2xl border border-line bg-panel p-4">
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
          </section>}

          <section aria-label={t('Expenses in this view')} className="rounded-2xl border border-line bg-panel">
            <h3 className="px-4 pt-4 pb-2 text-sm font-semibold">
              {cat || picked ? `${cat ? catName(catAt(cat)) : t('Expenses')}${picked ? ` · ${bucketTitle(picked)}` : ''}` : own ? (ownKind === 'cards' ? t('All card bills') : t('All entries')) : t('Biggest expenses')}
              <span className="ml-2 font-normal text-muted">{cat || picked || own ? `${shown.length} · ${money(sum(shown), currency)}` : ''}</span>
            </h3>
            <ul className="divide-y divide-line">
              {/* A card bills or lending group lists every entry; a spending view its five biggest. */}
              {(cat || picked || own ? [...shown].sort((a, b) => (a.date < b.date ? 1 : -1)) : [...inside].sort((a, b) => b.amount - a.amount).slice(0, 5)).slice(0, 300).map((l: Line) => (
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

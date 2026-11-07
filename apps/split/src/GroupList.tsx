import { t, tn } from '@sanga/i18n';
import { useMemo } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { balances, GROUP_KINDS, isSpending, kindOf, money, rangeFor, sum, inRange, linesOf } from './model';
import { useMe, usePendingForMe, useUnread } from './hooks';
import { useSplit, type GroupData } from './store';
import { Empty } from './Empty';
import { Overview } from './Overview';

function Card({ g, active, onOpen }: { g: GroupData; active: boolean; onOpen: () => void }) {
  const me = useMe();
  const meta = g.meta;
  const unread = useUnread(g.gid);
  const toConfirm = usePendingForMe(g).length;
  const stats = useMemo(() => {
    const ex = Object.values(g.expenses).filter((e) => !e.deleted), st = Object.values(g.settles).filter((s) => !s.deleted);
    return { net: balances(ex, st)[me] ?? 0, month: sum(inRange(linesOf(g.gid, ex, 'share', me).filter((l) => isSpending(l.cat)), rangeFor('month'))), count: ex.length };
  }, [g, me]);
  if (!meta) return <li className="px-4 py-3 text-sm text-muted">{t('Opening a group…')}</li>;
  const kind = kindOf(meta), kindInfo = GROUP_KINDS.find((k) => k.id === kind)!;
  return (
    <li>
      <button type="button" onClick={onOpen} aria-current={active} className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-hover', active && 'bg-hover')}>
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/12 text-2xl" aria-hidden>{meta.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 truncate font-semibold">{meta.name}{unread > 0 && <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white" aria-label={t('{n} new in activity', { n: unread })}>{t('{n} new', { n: unread })}</span>}{toConfirm > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{t('{n} to confirm', { n: toConfirm })}</span>}</span>
          <span className="flex items-center gap-1 truncate text-xs text-muted"><Users className="size-3.5" />{meta.people.filter((p) => !p.gone).length} · {tn(stats.count, '{n} expense', '{n} expenses')} · {kind === 'spending' ? t('you spent {amount} this month', { amount: money(stats.month, meta.currency, { compact: true }) }) : `${kindInfo.emoji} ${t('not in My spending')}`}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={cn('block text-sm font-semibold tabular-nums', stats.net > 0 ? 'text-emerald-600 dark:text-emerald-400' : stats.net < 0 ? 'text-danger' : 'text-muted')}>
            {stats.net === 0 ? t('settled') : money(stats.net, meta.currency, { sign: true })}
          </span>
          <span className="block text-xs text-muted">{stats.net > 0 ? t('you get back') : stats.net < 0 ? t('you owe') : ''}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );
}

/** The groups' shape while they're on their way, so the page doesn't jump when they arrive. */
function Placeholder() {
  return (
    <div aria-busy="true" aria-label={t('Loading your groups…')} className="animate-pulse">
      <div className="mx-3 mb-3 h-[74px] rounded-2xl bg-panel-2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <span className="size-12 shrink-0 rounded-2xl bg-panel-2" />
          <span className="flex-1 space-y-2"><span className="block h-3.5 w-2/5 rounded bg-panel-2" /><span className="block h-3 w-3/4 rounded bg-panel-2" /></span>
        </div>
      ))}
    </div>
  );
}

/** Your groups, each with what you're owed or owe and what you spent this month. */
export function GroupList({ active, onOpen, onNew }: { active: string | null; onOpen: (gid: string) => void; onNew: () => void }) {
  const groups = useSplit((s) => s.groups);
  const loaded = useSplit((s) => s.loaded);
  const list = useMemo(() => Object.values(groups).sort((a, b) => (a.meta?.name ?? '').localeCompare(b.meta?.name ?? '')), [groups]);
  if (!loaded) return <Placeholder />;
  if (!list.length) return (
    <Empty emoji="💸" title={t('Split costs with friends')}>
      {t('Make a group for a trip, your flat, the gym or office lunches, add people, and keep track of who owes whom.')}
      <button type="button" onClick={onNew} className="mx-auto mt-4 block rounded-xl bg-accent px-5 py-2.5 font-semibold text-white">{t('Create your first group')}</button>
    </Empty>
  );
  return (
    <>
      <Overview />
      <ul className="divide-y divide-line bg-panel">{list.map((g) => <Card key={g.gid} g={g} active={active === g.gid} onOpen={() => onOpen(g.gid)} />)}</ul>
    </>
  );
}

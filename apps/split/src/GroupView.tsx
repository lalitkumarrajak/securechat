import { t } from '@sanga/i18n';
import { useMemo, useState } from 'react';
import { ArrowLeft, Bell, PieChart, Plus, Receipt, Scale, Settings, Users } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { Tabs, TabsContent, TabsList } from '@sanga/ui/tabs';
import { balances, money, type Expense } from './model';
import { useGroup, useLedger, useMe, usePendingForMe, useUnread } from './hooks';
import { ActivityTab } from './ActivityTab';
import { blankExpense } from './blankExpense';
import { AddPeopleDialog } from './AddPeopleDialog';
import { BalancesTab } from './BalancesTab';
import { Empty } from './Empty';
import { ExpenseDetail } from './ExpenseDetail';
import { ExpenseEditor } from './ExpenseEditor';
import { ExpensesTab } from './ExpensesTab';
import { GroupSettings } from './GroupSettings';
import { InsightsTab } from './InsightsTab';
import { PeopleTab } from './PeopleTab';

/** A tab's name: on a phone the icon sits above a small label, so five of them fit and read at a glance. */
function TabLabel({ icon: Icon, badge = 0, confirm, children }: { icon: typeof Bell; badge?: number; confirm?: boolean; children: string }) {
  return (
    <span className="relative flex flex-col items-center gap-0.5 text-[11px] leading-tight sm:flex-row sm:gap-0 sm:text-sm">
      <Icon className="size-[18px] sm:hidden" aria-hidden />{children}
      {badge > 0 && <span className="absolute -top-1 left-1/2 ml-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white sm:-top-1.5 sm:-right-4 sm:left-auto sm:ml-0" aria-label={confirm ? t('{n} to confirm', { n: badge }) : t('{n} new', { n: badge })}>{badge}</span>}
    </span>
  );
}

/** One group: expenses, balances, insights and people, with a button to add an expense. */
export function GroupView({ gid, start, onBack, onGone }: { gid: string; start?: Expense | null; onBack?: () => void; onGone: () => void }) {
  const me = useMe();
  const g = useGroup(gid);
  const { meta, expenses, settles } = useLedger(g);
  const [tab, setTab] = useState('expenses');
  const [editing, setEditing] = useState<Expense | null>(start ?? null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [settings, setSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const unread = useUnread(gid);
  const toConfirm = usePendingForMe(g).length;
  const mine = useMemo(() => balances(expenses, settles)[me] ?? 0, [expenses, settles, me]);

  if (!g || !meta) return <Empty emoji="🔐" title={t('Opening the group…')}>{t('If this stays, check your connection.')}</Empty>;
  const alone = g.meta!.people.filter((p) => !p.gone).length < 2;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-bg">
      <header className="flex shrink-0 items-center gap-1 px-2 pt-2">
        {onBack && <IconButton label={t('Back to groups')} onClick={onBack}><ArrowLeft /></IconButton>}
        <span className="ml-2 text-2xl" aria-hidden>{meta.emoji}</span>
        <div className="min-w-0 flex-1 px-2">
          <h2 className="truncate text-lg font-bold tracking-tight">{meta.name}</h2>
          <p className={`truncate text-sm ${mine > 0 ? 'text-emerald-600 dark:text-emerald-400' : mine < 0 ? 'text-danger' : 'text-muted'}`}>
            {mine === 0 ? t('You’re settled up') : mine > 0 ? t('You get back {amount}', { amount: money(mine, meta.currency) }) : t('You owe {amount}', { amount: money(-mine, meta.currency) })}
          </p>
        </div>
        <IconButton label={t('Group settings')} onClick={() => setSettings(true)}><Settings /></IconButton>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="px-4 py-2">
          <TabsList tabs={[
            { value: 'expenses', label: <TabLabel icon={Receipt}>{t('Expenses')}</TabLabel> },
            { value: 'balances', label: <TabLabel icon={Scale} badge={toConfirm} confirm>{t('Balances')}</TabLabel> },
            { value: 'insights', label: <TabLabel icon={PieChart}>{t('Insights')}</TabLabel> },
            { value: 'people', label: <TabLabel icon={Users}>{t('People')}</TabLabel> },
            { value: 'activity', label: <TabLabel icon={Bell} badge={tab !== 'activity' ? unread : 0}>{t('Activity')}</TabLabel> },
          ]} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-24 md:pb-6">
          {alone && tab === 'expenses' && (
            <button type="button" onClick={() => setAdding(true)} className="mx-4 mb-3 block w-[calc(100%-2rem)] rounded-2xl border border-dashed border-accent/50 bg-accent/10 p-3 text-sm font-medium text-accent">
              {t('Just you here. Add people to split with →')}
            </button>
          )}
          <TabsContent value="expenses"><ExpensesTab g={g} onOpen={setViewing} /></TabsContent>
          <TabsContent value="balances"><BalancesTab g={g} /></TabsContent>
          <TabsContent value="insights"><InsightsTab scope={{ kind: 'group', gid }} /></TabsContent>
          <TabsContent value="people"><PeopleTab g={g} /></TabsContent>
          <TabsContent value="activity"><ActivityTab g={g} onOpenExpense={(id) => setViewing(g.expenses[id] ?? null)} /></TabsContent>
        </div>
      </Tabs>

      <button type="button" onClick={() => setEditing(blankExpense(me))} aria-label={t('Add expense')}
        className="absolute right-4 bottom-4 z-10 flex h-14 items-center gap-2 rounded-2xl bg-accent px-5 font-semibold text-white shadow-lg active:scale-95">
        <Plus className="size-5" />{t('Add expense')}
      </button>

      <ExpenseEditor g={g} expense={editing} onClose={() => setEditing(null)} />
      <ExpenseDetail g={g} expense={viewing} onClose={() => setViewing(null)} onEdit={setEditing} />
      <GroupSettings g={g} open={settings} onClose={() => setSettings(false)} onLeft={onGone} />
      <AddPeopleDialog g={g} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

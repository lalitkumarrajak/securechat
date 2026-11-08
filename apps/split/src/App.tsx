// Split: shared expenses in groups of friends. Add expenses with a category, split them equally, by
// amount, percentage or shares, attach the bill, see who owes whom and settle up, and look at where
// the money went by day, month or any period, with charts. Groups are end-to-end encrypted (store.ts).
// A separate Sanga app: the shell loads it when the Split tab is opened, and it also runs on its own
// at /apps/split/.
import { t, tx, useI18n } from '@sanga/i18n';
import { UI_DICTS } from '@sanga/ui/locale';
import { SPLIT_DICTS } from './locale';
import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, Plus, WifiOff } from 'lucide-react';
import { sdk, type AppProps } from '@sanga/sdk';
import { Button, IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { useSplit, startSplit } from './store';
import { startLedger, useLedger as useMoney } from '@sanga/ledger';
import { reconcile } from './PaidFrom';
import { Empty } from './Empty';
import { GroupList } from './GroupList';
import { GroupView } from './GroupView';
import { InsightsTab } from './InsightsTab';
import { NewGroupDialog } from './NewGroupDialog';
import { DraftDialog } from './DraftDialog';
import { expenseFromDraft, parseDraft, type Draft } from './draft';
import { kindOf, type Expense } from './model';

type Pane = { kind: 'none' } | { kind: 'group'; gid: string; start?: Expense } | { kind: 'insights' };

function SplitAppInner({ onClose, tab, params }: AppProps) {
  const [pane, setPane] = useState<Pane>({ kind: 'none' });
  const [creating, setCreating] = useState(false);
  const me = sdk().identity().me;
  const [draft, setDraft] = useState<Draft | null>(() => parseDraft(params.draft)); // a bill sent from the Calendar
  const online = sdk().useOnline();
  const error = useSplit((s) => s.error);
  useEffect(() => { startSplit(); void startLedger(); }, []);
  // Your accounts follow the groups: an expense you paid that was changed or deleted (by anyone) updates
  // what it took from your account.
  const allGroups = useSplit((s) => s.groups), ledgerLoaded = useMoney((s) => s.loaded);
  useEffect(() => { if (ledgerLoaded) reconcile(allGroups, me); }, [allGroups, ledgerLoaded, me]);
  // A card bill from the Calendar, and you have one Credit card bills group in its currency: straight there.
  const groups = useSplit((s) => s.groups);
  const loaded = useSplit((s) => s.loaded);
  useEffect(() => {
    if (!draft || draft.cat !== 'cards' || !loaded) return;
    const cardGroups = Object.values(groups).filter((g) => g.meta && g.meta.currency === draft.cur && kindOf(g.meta) === 'cards');
    if (cardGroups.length !== 1) return;
    setPane({ kind: 'group', gid: cardGroups[0].gid, start: expenseFromDraft(draft, me) });
    setDraft(null);
  }, [draft, groups, loaded, me]);

  const open = pane.kind !== 'none';
  const back = () => setPane({ kind: 'none' });

  return (
    <div className="flex min-h-0 flex-1 bg-bg">
      <aside className={cn('min-h-0 w-full flex-col border-line md:flex md:w-[380px] md:shrink-0 md:border-r', open ? 'hidden' : 'flex')}>
        <header className="flex h-16 shrink-0 items-center gap-1 px-3">
          {!tab && <IconButton label={t('Back')} onClick={onClose}><ArrowLeft /></IconButton>}
          <h1 className={cn('min-w-0 flex-1 truncate text-xl font-bold tracking-tight', tab && 'pl-2')}>{t('Split')}</h1>
          <Button variant="ghost" size="sm" onClick={() => setPane({ kind: 'insights' })}><BarChart3 className="size-4" />{t('My spending')}</Button>
          <IconButton label={t('New group')} variant="primary" onClick={() => setCreating(true)} className="ml-1 text-white"><Plus /></IconButton>
        </header>
        {!online && <p className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm"><WifiOff className="size-4" />{t('Offline. Changes are saved and sent when you’re back.')}</p>}
        {error && <p className="mx-3 mb-2 rounded-xl bg-warn-bg px-3 py-2 text-sm" role="status">{t(error)}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          <GroupList active={pane.kind === 'group' ? pane.gid : null} onOpen={(gid) => setPane({ kind: 'group', gid })} onNew={() => setCreating(true)} />
        </div>
      </aside>

      <main className={cn('min-h-0 min-w-0 flex-1 flex-col', open ? 'flex' : 'hidden md:flex')}>
        {pane.kind === 'group' && <GroupView key={pane.gid} gid={pane.gid} start={pane.start} onBack={back} onGone={back} />}
        {pane.kind === 'insights' && (
          <>
            <header className="flex h-16 shrink-0 items-center gap-1 px-2">
              <IconButton label={t('Back to groups')} onClick={back} className="md:hidden"><ArrowLeft /></IconButton>
              <h2 className="px-2 text-lg font-bold tracking-tight">{t('My spending')}</h2>
              <span className="text-sm text-muted">{t('your share, spending groups')}</span>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto"><InsightsTab scope={{ kind: 'all' }} /></div>
          </>
        )}
        {pane.kind === 'none' && <Empty emoji="🧾" title={t('Pick a group')}>{tx('Or tap {link} to see where your money goes across all of them.', { link: <b>{t('My spending')}</b> })}</Empty>}
      </main>

      <DraftDialog draft={creating ? null : draft} onClose={() => setDraft(null)} onNew={() => setCreating(true)}
        onPick={(gid) => { if (draft) setPane({ kind: 'group', gid, start: expenseFromDraft(draft, me) }); setDraft(null); }} />
      <NewGroupDialog key={`${draft?.cur}:${draft?.cat}`} open={creating} currency={draft?.cur} kind={draft?.cat === 'cards' ? 'cards' : 'spending'} onClose={() => setCreating(false)}
        onCreated={(gid) => { setCreating(false); setPane({ kind: 'group', gid, ...(draft && { start: expenseFromDraft(draft, me) }) }); setDraft(null); }} />
    </div>
  );
}

/** Its words (and the UI kit's) for the language now on come first: until then the shell shows its placeholder. */
export default function SplitApp(props: AppProps) {
  useI18n({ ...SPLIT_DICTS, ...UI_DICTS });
  return <SplitAppInner {...props} />;
}

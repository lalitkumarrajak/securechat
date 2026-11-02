// Split: shared expenses in groups of friends. Add expenses with a category, split them equally, by
// amount, percentage or shares, attach the bill, see who owes whom and settle up, and look at where
// the money went by day, month or any period, with charts. Groups are end-to-end encrypted (store.ts).
// A separate Sanga app: the shell loads it when the Split tab is opened, and it also runs on its own
// at /apps/split/.
import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, Plus, WifiOff } from 'lucide-react';
import { sdk, type AppProps } from '@sanga/sdk';
import { Button, IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { useSplit, startSplit } from './store';
import { Empty } from './Empty';
import { GroupList } from './GroupList';
import { GroupView } from './GroupView';
import { InsightsTab } from './InsightsTab';
import { NewGroupDialog } from './NewGroupDialog';

type Pane = { kind: 'none' } | { kind: 'group'; gid: string } | { kind: 'insights' };

export default function SplitApp({ onClose, tab }: AppProps) {
  const [pane, setPane] = useState<Pane>({ kind: 'none' });
  const [creating, setCreating] = useState(false);
  const online = sdk().useOnline();
  const error = useSplit((s) => s.error);
  useEffect(() => { startSplit(); }, []);

  const open = pane.kind !== 'none';
  const back = () => setPane({ kind: 'none' });

  return (
    <div className="flex min-h-0 flex-1 bg-bg">
      <aside className={cn('min-h-0 w-full flex-col border-line md:flex md:w-[380px] md:shrink-0 md:border-r', open ? 'hidden' : 'flex')}>
        <header className="flex h-16 shrink-0 items-center gap-1 px-3">
          {!tab && <IconButton label="Back" onClick={onClose}><ArrowLeft /></IconButton>}
          <h1 className={cn('min-w-0 flex-1 truncate text-xl font-bold tracking-tight', tab && 'pl-2')}>Split</h1>
          <Button variant="ghost" size="sm" onClick={() => setPane({ kind: 'insights' })}><BarChart3 className="size-4" />My spending</Button>
          <IconButton label="New group" variant="primary" onClick={() => setCreating(true)} className="ml-1 text-white"><Plus /></IconButton>
        </header>
        {!online && <p className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm"><WifiOff className="size-4" />Offline. Changes are saved and sent when you’re back.</p>}
        {error && <p className="mx-3 mb-2 rounded-xl bg-warn-bg px-3 py-2 text-sm" role="status">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          <GroupList active={pane.kind === 'group' ? pane.gid : null} onOpen={(gid) => setPane({ kind: 'group', gid })} onNew={() => setCreating(true)} />
        </div>
      </aside>

      <main className={cn('min-h-0 min-w-0 flex-1 flex-col', open ? 'flex' : 'hidden md:flex')}>
        {pane.kind === 'group' && <GroupView key={pane.gid} gid={pane.gid} onBack={back} onGone={back} />}
        {pane.kind === 'insights' && (
          <>
            <header className="flex h-16 shrink-0 items-center gap-1 px-2">
              <IconButton label="Back to groups" onClick={back} className="md:hidden"><ArrowLeft /></IconButton>
              <h2 className="px-2 text-lg font-bold tracking-tight">My spending</h2>
              <span className="text-sm text-muted">your share, all groups</span>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto"><InsightsTab scope={{ kind: 'all' }} /></div>
          </>
        )}
        {pane.kind === 'none' && <Empty emoji="🧾" title="Pick a group">Or tap <b>My spending</b> to see where your money goes across all of them.</Empty>}
      </main>

      <NewGroupDialog open={creating} onClose={() => setCreating(false)} onCreated={(gid) => { setCreating(false); setPane({ kind: 'group', gid }); }} />
    </div>
  );
}

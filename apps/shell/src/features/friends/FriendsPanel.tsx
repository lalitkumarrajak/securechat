import { ArrowLeft } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { Panel } from '@sanga/ui/dialog';
import { Tabs, TabsContent, TabsList } from '@sanga/ui/tabs';
import { setApp, useApp } from '../../state/app';
import { AddFriend } from './friends-panel/AddFriend';
import { FriendsList } from './friends-panel/FriendsList';
import { Requests } from './friends-panel/Requests';

export function FriendsPanel() {
  const open = useApp((s) => s.panel === 'friends');
  const tab = useApp((s) => s.friendsTab);
  const incoming = useApp((s) => s.incoming.length);
  const close = () => setApp({ panel: null });

  return (
    <Panel open={open} onOpenChange={(o) => !o && close()} title="Friends">
      <header className="flex h-16 shrink-0 items-center gap-2 bg-panel px-3">
        <IconButton label="Back" onClick={close}><ArrowLeft /></IconButton>
        <h2 className="text-lg font-semibold">Friends</h2>
      </header>
      <Tabs value={tab} onValueChange={(v) => setApp({ friendsTab: v as typeof tab })} className="flex min-h-0 flex-1 flex-col">
        <div className="bg-panel px-4 pb-3">
          <TabsList tabs={[
            { value: 'friends', label: 'Friends' },
            { value: 'requests', label: <>Requests{incoming > 0 && <span className="rounded-full bg-danger px-1.5 text-[11px] leading-[18px] font-bold text-white">{incoming}</span>}</> },
            { value: 'add', label: 'Add' },
          ]} />
        </div>
        <TabsContent value="friends" className="min-h-0 flex-1 overflow-y-auto"><FriendsList /></TabsContent>
        <TabsContent value="requests" className="min-h-0 flex-1 overflow-y-auto"><Requests /></TabsContent>
        <TabsContent value="add" className="min-h-0 flex-1 overflow-y-auto"><AddFriend /></TabsContent>
      </Tabs>
    </Panel>
  );
}

import { useMemo, useState } from 'react';
import { MessageCircle, UserPlus } from 'lucide-react';
import { Button, IconButton } from '@sanga/ui/button';
import { openChat } from '../../../lib/engine';
import { displayName } from '../../../lib/types';
import { ChatListSkeleton } from '../../../components/skeleton/ChatListSkeleton';
import { setApp, useApp } from '../../../state/app';
import { Row } from './Row';
import { SearchBox } from './SearchBox';

export function FriendsList() {
  const friends = useApp((s) => s.friends);
  const loaded = useApp((s) => s.friendsLoaded);
  const [q, setQ] = useState('');
  const list = useMemo(() => Object.values(friends)
    .filter((f) => !q || f.u.includes(q.toLowerCase()) || f.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => displayName(a, a.u).localeCompare(displayName(b, b.u))), [friends, q]);

  if (!Object.keys(friends).length && !loaded) return <ChatListSkeleton rows={4} />;
  if (!Object.keys(friends).length) {
    return (
      <div className="px-8 py-12 text-center">
        <p className="font-medium">No friends yet</p>
        <p className="mt-1 text-sm text-muted">Send a request to someone by their username.</p>
        <Button className="mt-4" onClick={() => setApp({ friendsTab: 'add' })}><UserPlus className="size-4" /> Add a friend</Button>
      </div>
    );
  }
  return (
    <>
      <div className="px-4 pt-3"><SearchBox value={q} onChange={setQ} placeholder="Search friends" /></div>
      <ul className="py-2">
        {list.map((f) => (
          <Row key={f.u} p={f} onClick={() => openChat(f.u)}>
            <IconButton label={`Message ${displayName(f, f.u)}`} onClick={() => openChat(f.u)}><MessageCircle /></IconButton>
          </Row>
        ))}
      </ul>
    </>
  );
}

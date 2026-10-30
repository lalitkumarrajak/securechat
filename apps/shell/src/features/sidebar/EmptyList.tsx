import { MessageSquarePlus, UserPlus } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { openChat } from '../../lib/engine';
import { displayName } from '../../lib/types';
import { setApp, useApp } from '../../state/app';
import { ChatListSkeleton } from '../../components/skeleton/ChatListSkeleton';

export function EmptyList({ archived, searching }: { archived: boolean; searching: boolean }) {
  const friends = useApp((s) => s.friends);
  const loaded = useApp((s) => s.friendsLoaded);
  if (searching) return <p className="px-6 py-10 text-center text-sm text-muted">No chats found.</p>;
  if (archived) return <p className="px-6 py-10 text-center text-sm text-muted">No archived chats.</p>;
  const list = Object.values(friends).sort((a, b) => displayName(a, a.u).localeCompare(displayName(b, b.u)));
  if (!list.length && !loaded) return <ChatListSkeleton rows={4} />;
  if (list.length) {
    return (
      <div className="py-4">
        <p className="px-5 pb-2 text-sm text-muted">No chats yet. Say hi to {list.length === 1 ? 'your friend' : `your ${list.length} friends`}:</p>
        <ul>
          {list.slice(0, 8).map((f) => (
            <li key={f.u}>
              <button onClick={() => openChat(f.u)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover">
                <Avatar u={f.u} name={f.name} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{displayName(f, f.u)}</span>
                  <span className="block truncate text-sm text-muted">@{f.u}</span>
                </span>
                <MessageSquarePlus className="size-5 text-accent-ink" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="px-8 py-12 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent/12 text-accent-ink"><MessageSquarePlus className="size-8" /></div>
      <h2 className="mt-4 font-semibold">No chats yet</h2>
      <p className="mt-1 text-sm text-muted">Add friends by their username. Once they accept, you can start chatting.</p>
      <button onClick={() => setApp({ panel: 'friends', friendsTab: 'add' })}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-white hover:brightness-110">
        <UserPlus className="size-4" /> Add a friend
      </button>
    </div>
  );
}

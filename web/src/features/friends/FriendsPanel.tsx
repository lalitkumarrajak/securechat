import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, Clock, Copy, MessageCircle, Search, UserPlus, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { Button, IconButton, Spinner } from '../../components/ui/button';
import { Panel } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList } from '../../components/ui/tabs';
import { acceptRequest, declineRequest, openChat, searchUsers, sendRequest, unblockUser } from '../../lib/engine';
import { displayName, type Person, type SearchHit } from '../../lib/types';
import { LinkBox } from '../../components/LinkBox';
import { inviteLink } from '../../lib/invite';
import { ChatListSkeleton } from '../../components/Skeleton';
import { setApp, useApp } from '../../state/app';

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

function Row({ p, sub, children, onClick }: { p: Person; sub?: string; children?: React.ReactNode; onClick?: () => void }) {
  const online = useApp((s) => s.presence[p.u]?.on);
  const body = (
    <>
      <Avatar u={p.u} name={p.name} size={46} online={online} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{displayName(p, p.u)}</span>
        <span className="block truncate text-sm text-muted">{sub ?? (p.name ? '@' + p.u : p.about || '@' + p.u)}</span>
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      {onClick ? <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">{body}</button> : body}
      {children}
    </li>
  );
}

function FriendsList() {
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

function Requests() {
  const incoming = useApp((s) => s.incoming);
  const outgoing = useApp((s) => s.outgoing);
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (u: string, fn: (u: string) => Promise<unknown>, done?: string) => {
    setBusy(u);
    try { await fn(u); if (done) toast.success(done); } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };
  if (!incoming.length && !outgoing.length) {
    return <p className="px-8 py-12 text-center text-sm text-muted">No pending requests.</p>;
  }
  return (
    <div className="py-2">
      {incoming.length > 0 && <h3 className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">Received</h3>}
      <ul>
        {incoming.map((r) => (
          <Row key={r.u} p={r}>
            <Button size="sm" loading={busy === r.u} onClick={() => act(r.u, acceptRequest, `You and ${displayName(r, r.u)} are now friends`)}>
              <Check className="size-4" /> Accept
            </Button>
            <IconButton label="Decline" size="icon-sm" onClick={() => act(r.u, declineRequest)}><X /></IconButton>
          </Row>
        ))}
      </ul>
      {outgoing.length > 0 && <h3 className="px-4 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">Sent</h3>}
      <ul>
        {outgoing.map((r) => (
          <Row key={r.u} p={r} sub="Waiting for them to accept">
            <Button size="sm" variant="secondary" loading={busy === r.u} onClick={() => act(r.u, declineRequest, 'Request cancelled')}>Cancel</Button>
          </Row>
        ))}
      </ul>
    </div>
  );
}

function AddFriend() {
  const me = useApp((s) => s.me)!;
  // Re-run the search when friendships change (e.g. they accept while you're looking).
  const version = useApp((s) => [Object.keys(s.friends).join(), s.outgoing.map((r) => r.u).join(), s.incoming.map((r) => r.u).join(), s.blocked.join()].join('|'));
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) { setHits(null); return; }
    setLoading(true);
    const t = setTimeout(() => {
      searchUsers(term).then(setHits).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, version]);

  const act = async (u: string, fn: (u: string) => Promise<any>) => {
    setBusy(u);
    try {
      const r = await fn(u);
      if (r?.rel === 'out') toast.success('Friend request sent');
      if (r?.rel === 'friends') toast.success('You’re now friends');
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };

  return (
    <div className="px-4 py-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search by username" autoFocus />
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2.5 text-sm">
        <span className="flex-1">Your username: <b>@{me.u}</b></span>
        <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(me.u).then(() => toast.success('Username copied'))}>
          <Copy className="size-4" /> Copy
        </Button>
      </div>
      {loading && <div className="grid place-items-center py-8 text-accent"><Spinner className="size-6" /></div>}
      {!loading && hits && !hits.length && <p className="py-8 text-center text-sm text-muted">No one found with that username.</p>}
      {!loading && hits && hits.length > 0 && (
        <ul className="-mx-4 mt-2">
          {hits.map((h) => (
            <Row key={h.u} p={h} sub={'@' + h.u}>
              {h.rel === 'none' && <Button size="sm" loading={busy === h.u} onClick={() => act(h.u, sendRequest)}><UserPlus className="size-4" /> Add</Button>}
              {h.rel === 'out' && <Button size="sm" variant="secondary" loading={busy === h.u} onClick={() => act(h.u, declineRequest)}><Clock className="size-4" /> Requested</Button>}
              {h.rel === 'in' && <Button size="sm" loading={busy === h.u} onClick={() => act(h.u, acceptRequest)}><Check className="size-4" /> Accept</Button>}
              {h.rel === 'friends' && <Button size="sm" variant="secondary" onClick={() => openChat(h.u)}><MessageCircle className="size-4" /> Message</Button>}
              {h.rel === 'blocked' && <Button size="sm" variant="outline" loading={busy === h.u} onClick={() => act(h.u, unblockUser)}>Unblock</Button>}
            </Row>
          ))}
        </ul>
      )}
      {!hits && !loading && (
        <>
          <p className="mt-4 text-center text-sm text-muted">Type at least 2 letters of a username. They’ll get your request and can accept or decline it.</p>
          <div className="mt-6 rounded-2xl border border-line p-4">
            <p className="font-semibold">Invite someone to Chattrix</p>
            <p className="mt-1 mb-3 text-sm text-muted">Send this link anywhere. They can sign up, and you’ll get their friend request.</p>
            <LinkBox url={inviteLink(me.u)} title="Chattrix" text={`Chat with me on Chattrix, I’m @${me.u}`} />
          </div>
        </>
      )}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
        autoCapitalize="none" spellCheck={false}
        className="h-10 w-full rounded-xl bg-panel-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Clock, Copy, MessageCircle, UserPlus } from 'lucide-react';
import { Button, Spinner } from '@sanga/ui/button';
import { acceptRequest, declineRequest, openChat, searchUsers, sendRequest, unblockUser } from '../../../lib/engine';
import { type SearchHit } from '../../../lib/types';
import { LinkBox } from '../../../components/LinkBox';
import { inviteLink } from '../../../lib/invite';
import { useApp } from '../../../state/app';
import { Row } from './Row';
import { SearchBox } from './SearchBox';

export function AddFriend() {
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
            <p className="font-semibold">Invite someone to Sanga</p>
            <p className="mt-1 mb-3 text-sm text-muted">Send this link anywhere. They can sign up, and you’ll get their friend request.</p>
            <LinkBox url={inviteLink(me.u)} title="Sanga" text={`Chat with me on Sanga, I’m @${me.u}`} />
          </div>
        </>
      )}
    </div>
  );
}

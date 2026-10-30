import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { Button, IconButton } from '@sanga/ui/button';
import { acceptRequest, declineRequest } from '../../../lib/engine';
import { displayName } from '../../../lib/types';
import { useApp } from '../../../state/app';
import { Row } from './Row';

export function Requests() {
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

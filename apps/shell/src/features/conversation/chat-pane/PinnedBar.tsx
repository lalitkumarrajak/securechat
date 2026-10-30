import { useEffect, useMemo, useState } from 'react';
import { Pin, X } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { findMessage, preview, togglePin } from '../../../lib/engine';
import { type Msg } from '../../../lib/types';
import { setApp, useApp } from '../../../state/app';

export function PinnedBar({ peer }: { peer: string }) {
  const pins = useApp((s) => s.chats.find((c) => c.peer === peer)?.pins);
  const messages = useApp((s) => s.messages);
  const [i, setI] = useState(0);
  // Pinned messages further up than what's loaded come from this device's storage.
  const [far, setFar] = useState<Record<string, Msg>>({});
  useEffect(() => {
    for (const p of pins || []) if (!messages.some((m) => m.k === p.k) && !far[p.k]) findMessage(p.k).then((m) => m?.peer === peer && setFar((f) => ({ ...f, [m.k]: m }))); // only this chat's messages
  }, [pins, messages]);
  const list = useMemo(() => (pins || []).map((p) => messages.find((m) => m.k === p.k) || far[p.k]).filter((m) => !!m && m.type !== 'deleted'), [pins, messages, far]);
  if (!list.length) return null;
  const cur = list[i % list.length]!;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel px-3 py-1.5">
      <div className="flex flex-col gap-0.5 self-stretch py-1" aria-hidden>
        {list.map((_, j) => <span key={j} className={`w-0.5 flex-1 rounded-full ${j === i % list.length ? 'bg-accent' : 'bg-line'}`} />)}
      </div>
      <button className="priv-scope min-w-0 flex-1 text-left" onClick={() => { setApp({ highlight: cur.k }); setI((n) => n + 1); }}>
        <span className="flex items-center gap-1 text-xs font-semibold text-accent-ink"><Pin className="size-3" /> Pinned message{list.length > 1 ? ` ${(i % list.length) + 1} of ${list.length}` : ''}</span>
        <span className="priv block truncate text-sm text-muted">{preview(cur)}</span>
      </button>
      <IconButton label="Unpin" size="icon-sm" onClick={() => togglePin(cur)}><X /></IconButton>
    </div>
  );
}

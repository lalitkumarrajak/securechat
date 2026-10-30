import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react';
import { fmtDuration } from '@sanga/ui/format';
import { callText } from '../../../lib/engine';
import { startCall } from '../../../lib/calls';
import { isGroup, type Msg } from '../../../lib/types';
import { cn } from '@sanga/ui/utils';

/** A call in the chat: "Missed voice call", "Outgoing video call · 3:24", with a button to call back. */
export function CallCard({ m }: { m: Msg }) {
  const c = m.call!;
  const missed = !m.out && c.st !== 'ok';
  const Icon = c.v ? Video : m.out ? PhoneOutgoing : missed ? PhoneMissed : PhoneIncoming;
  return (
    <span className="flex items-center gap-3 pr-12">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', missed ? 'bg-danger/12 text-danger' : 'bg-accent/12 text-accent-ink')}><Icon className="size-[18px]" /></span>
      <span className="min-w-0">
        <span className="block font-medium">{callText(c, m.out)}</span>
        <span className="block text-xs text-muted">{c.st === 'ok' ? fmtDuration(c.dur) : missed ? 'Tap to call back' : ' '}</span>
      </span>
      {!isGroup(m.peer) && (
        <button onClick={(e) => { e.stopPropagation(); void startCall(m.peer, c.v); }} aria-label={`Call back${c.v ? ' (video)' : ''}`}
          className="ml-1 grid size-9 shrink-0 place-items-center rounded-full text-accent-ink hover:bg-hover">
          {c.v ? <Video className="size-5" /> : <Phone className="size-5" />}
        </button>
      )}
    </span>
  );
}

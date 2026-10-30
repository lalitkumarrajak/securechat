import { Pin } from 'lucide-react';
import { Ticks } from '../../../components/Ticks';
import { fmtClock } from '@sanga/ui/format';
import { type Msg } from '../../../lib/types';
import { cn } from '@sanga/ui/utils';

export function Meta({ m, pinned, bare, onPhoto = (m.type === 'img' && !m.text) || m.type === 'gif' }: { m: Msg; pinned: boolean; bare: boolean; onPhoto?: boolean }) {
  return (
    <span className={cn('float-right ml-2 flex translate-y-1 items-center gap-1 text-[11px] text-muted select-none',
      onPhoto && 'absolute right-2 bottom-2 translate-y-0 rounded-full bg-black/45 px-1.5 py-0.5 text-white',
      (m.type === 'voice' || m.type === 'file' || m.type === 'location') && 'float-none mt-1 justify-end translate-y-0',
      bare && 'float-none mt-1 justify-end rounded-full bg-bubble-in px-2 py-0.5 shadow-bubble')}>
      {pinned && <Pin className="size-3" aria-label="Pinned" />}
      {m.edited && m.type === 'text' && <span>edited</span>}
      <time dateTime={new Date(m.ts).toISOString()}>{fmtClock(m.ts)}</time>
      {m.out && m.type !== 'deleted' && <Ticks s={m.s} className="size-[15px]" />}
    </span>
  );
}

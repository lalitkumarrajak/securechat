import { type Msg } from '../../../lib/types';
import { setApp } from '../../../state/app';

export function Quote({ re, me, peerName }: { re: NonNullable<Msg['re']>; me: string; peerName: string }) {
  const jump = (e: React.MouseEvent) => { e.stopPropagation(); setApp({ highlight: re.f + '/' + re.c }); };
  return (
    <button onClick={jump} className="mb-1 block w-full min-w-40 rounded-lg border-l-4 border-accent bg-ink/5 px-2 py-1 text-left text-sm">
      <span className="block text-xs font-semibold text-accent-ink">{re.f === me ? 'You' : peerName}</span>
      <span className="line-clamp-2 text-muted [overflow-wrap:anywhere]">{re.p}</span>
    </button>
  );
}

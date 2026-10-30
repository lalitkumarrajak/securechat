import { reactionSummary } from '../../../lib/controls';
import { type Msg } from '../../../lib/types';
import { cn } from '@sanga/ui/utils';
import { reactTo } from '../chatUi';

export function Reactions({ m, me }: { m: Msg; me: string }) {
  const summary = reactionSummary(m.reacts, me);
  return (
    <div className={cn('-mt-1.5 z-10 flex gap-1', m.out ? 'mr-2' : 'ml-2')}>
      {summary.map(({ e, n, mine }) => (
        <button key={e} onClick={(ev) => { ev.stopPropagation(); reactTo(m, e); }}
          title={mine ? 'Tap to remove your reaction' : 'React with ' + e}
          className={cn('flex h-6 items-center gap-0.5 rounded-full border bg-panel px-1.5 text-sm shadow-bubble',
            mine ? 'border-accent/60' : 'border-line')}>
          <span>{e}</span>{n > 1 && <span className="text-xs text-muted">{n}</span>}
        </button>
      ))}
    </div>
  );
}

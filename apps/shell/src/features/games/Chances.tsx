import { Heart } from 'lucide-react';
import { MISSES_OUT } from '@sanga/game-rules/core.js';
import { cn } from '@sanga/ui/utils';

/** Five hearts: missed turns a player has left before they're removed. */
export function Chances({ missed, right }: { missed: number; right?: boolean }) {
  return (
    <div className={cn('mt-0.5 flex gap-0.5', right && 'justify-end')} role="img" aria-label={`${MISSES_OUT - missed} of ${MISSES_OUT} chances left`}
      title={`Missed turns: ${missed} of ${MISSES_OUT}. At ${MISSES_OUT} they're removed.`}>
      {Array.from({ length: MISSES_OUT }, (_, k) => (
        <Heart key={k} className={cn('size-2.5', k < MISSES_OUT - missed ? 'fill-red-500 text-red-500' : 'text-white/35')} />
      ))}
    </div>
  );
}

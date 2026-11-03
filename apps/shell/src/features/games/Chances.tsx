import { Heart } from 'lucide-react';
import { MISSES_OUT } from '@sanga/game-rules/core.js';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';

/** Five hearts: missed turns a player has left before they're removed. */
export function Chances({ missed, right }: { missed: number; right?: boolean }) {
  return (
    <div className={cn('mt-0.5 flex gap-0.5', right && 'justify-end')} role="img" aria-label={t('{left} of {total} chances left', { left: MISSES_OUT - missed, total: MISSES_OUT })}
      title={t('Missed turns: {missed} of {total}. At {total} they\'re removed.', { missed, total: MISSES_OUT })}>
      {Array.from({ length: MISSES_OUT }, (_, k) => (
        <Heart key={k} className={cn('size-2.5', k < MISSES_OUT - missed ? 'fill-red-500 text-red-500' : 'text-white/35')} />
      ))}
    </div>
  );
}

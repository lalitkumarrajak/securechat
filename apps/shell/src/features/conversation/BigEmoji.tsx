import { cn } from '@sanga/ui/utils';
import { Emoji } from './Emoji';

export function BigEmoji({ parts, className }: { parts: string[]; className?: string }) {
  const size = parts.length === 1 ? 64 : 44;
  return (
    <span className={cn('flex gap-0.5', className)}>
      {parts.map((e, i) => <Emoji key={i + e} e={e} size={size} />)}
    </span>
  );
}

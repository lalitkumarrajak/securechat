import { Ban, Repeat2 } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { card } from '@sanga/game-rules/uno.js';
import { HEX, SIZES } from './helpers';

/** A card face, drawn with plain HTML so it's crisp at any size. */
export function UnoCard({ id, size }: { id: number; size: 'md' | 'lg' }) {
  const k = card(id);
  const big = size === 'lg' ? 'text-5xl' : 'text-4xl';
  const sym = (cls: string) => k.v === 'skip' ? <Ban className={cls} strokeWidth={3} />
    : k.v === 'rev' ? <Repeat2 className={cls} strokeWidth={3} />
    : k.v === 'd2' ? '+2' : k.v === 'w4' ? '+4' : k.v === 'wild' ? '' : k.v;
  return (
    <span className={cn('relative block overflow-hidden border-white shadow-[0_4px_10px_rgba(0,0,0,0.45)]', SIZES[size])} style={{ background: HEX[k.c] }}>
      <span className="absolute inset-[12%_6%] -rotate-[28deg] rounded-[50%] bg-white"
        style={k.c === 'w' ? { background: `conic-gradient(${HEX.r} 0 90deg, ${HEX.y} 0 180deg, ${HEX.g} 0 270deg, ${HEX.b} 0)` } : undefined} />
      <span className={cn('absolute inset-0 grid place-items-center font-black italic', big, k.c === 'w' ? 'text-white [text-shadow:0_2px_0_#000]' : '')}
        style={k.c === 'w' ? undefined : { color: HEX[k.c], WebkitTextStroke: '1px rgba(0,0,0,0.25)' }}>
        {typeof sym('') === 'string' ? sym('') : sym(size === 'lg' ? 'size-12' : 'size-9')}
      </span>
      <span className="absolute top-0.5 left-1 text-xs font-black text-white italic [text-shadow:0_1px_0_#0006]">{typeof sym('') === 'string' ? sym('') : sym('size-3')}</span>
    </span>
  );
}

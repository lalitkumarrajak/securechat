import { cn } from '@sanga/ui/utils';
import { SIZES } from './helpers';

export function CardBack({ size }: { size: 'xs' | 'md' | 'lg' }) {
  return (
    <span className={cn('relative block overflow-hidden border-white bg-[#1c1c1c] shadow-[0_3px_8px_rgba(0,0,0,0.45)]', SIZES[size])} aria-hidden>
      <span className="absolute inset-[14%_8%] -rotate-[28deg] rounded-[50%] bg-[#e5322d]" />
      {size !== 'xs' && (
        <span className={cn('absolute inset-0 grid -rotate-[20deg] place-items-center font-black text-[#f7c300] italic [text-shadow:2px_2px_0_#000]', size === 'lg' ? 'text-2xl' : 'text-lg')}>UNO</span>
      )}
    </span>
  );
}

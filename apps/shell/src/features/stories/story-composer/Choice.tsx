import { Check } from 'lucide-react';
import { cn } from '@sanga/ui/utils';

export function Choice({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button role="radio" aria-checked={on} onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-hover [&>svg]:size-5">
      <span className="grid size-10 place-items-center rounded-full bg-accent/12 text-accent-ink [&_svg]:size-5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted">{sub}</span>
      </span>
      <span className={cn('grid size-6 place-items-center rounded-full border-2', on ? 'border-accent bg-accent text-white' : 'border-muted')}>
        {on && <Check className="size-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

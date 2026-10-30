import { cn } from '@sanga/ui/utils';

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition',
        on ? 'border-accent bg-accent text-white' : 'border-line bg-panel text-ink hover:bg-hover')}>
      {children}
    </button>
  );
}

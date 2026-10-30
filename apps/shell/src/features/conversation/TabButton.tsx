import { cn } from '@sanga/ui/utils';

export function TabButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={active}
      className={cn('grid h-9 min-w-12 place-items-center rounded-full px-3 transition', active ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:bg-hover')}>
      {children}
    </button>
  );
}

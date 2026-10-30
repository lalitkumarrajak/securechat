import { cn } from '@sanga/ui/utils';

export function Tab({ selected, count, onClick, label, children }: { selected: boolean; count: number; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button role="tab" aria-selected={selected} onClick={onClick}
      className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition',
        selected ? 'bg-accent/15 text-accent-ink' : 'bg-panel-2 text-muted hover:text-ink')}>
      {children}<span className="max-w-32 truncate">{label}</span>
      {count > 0 && !selected && (
        <span className="grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] leading-[18px] font-bold text-white" aria-label={`${count} unread`}>{count}</span>
      )}
    </button>
  );
}

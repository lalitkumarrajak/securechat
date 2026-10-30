import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export function NavRow({ icon, label, sub, onClick }: { icon: ReactNode; label: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-hover [&>svg:first-child]:size-5 [&>svg:first-child]:text-muted">
      {icon}
      <span className="min-w-0 flex-1"><span className="block">{label}</span>{sub && <span className="block truncate text-sm text-muted">{sub}</span>}</span>
      <ChevronRight className="size-4 text-muted" />
    </button>
  );
}

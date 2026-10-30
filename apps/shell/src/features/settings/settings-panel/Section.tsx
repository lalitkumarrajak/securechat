import type { ReactNode } from 'react';
import { cn } from '@sanga/ui/utils';

export function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-3 bg-panel', className)}>
      {title && <h3 className="px-5 pt-4 pb-1 text-xs font-semibold tracking-wide text-accent-ink uppercase">{title}</h3>}
      {children}
    </section>
  );
}

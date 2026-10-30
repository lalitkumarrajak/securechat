import * as D from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '../utils';

/** A full-height side panel (settings, friends, contact info). Slides in over the sidebar. */
export function Panel({ open, onOpenChange, title, children, side = 'left' }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; side?: 'left' | 'right';
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade-in md:bg-overlay/40" />
        <D.Content className={cn(
          'fixed inset-y-0 z-50 flex w-full flex-col bg-bg text-ink shadow-2xl outline-none md:w-[420px] animate-slide-in',
          side === 'left' ? 'left-0' : 'right-0',
        )}>
          <D.Title className="sr-only">{title}</D.Title>
          <D.Description className="sr-only">{title}</D.Description>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

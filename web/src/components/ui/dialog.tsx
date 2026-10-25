import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** A centred dialog on desktop that becomes a bottom sheet on phones. */
export function Dialog({ open, onOpenChange, title, description, children, className, hideTitle, keepFocus }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string;
  children: ReactNode; className?: string; hideTitle?: boolean;
  keepFocus?: boolean; // don't move focus back to what was focused before (e.g. after "Reply")
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade-in" />
        <D.Content
          onCloseAutoFocus={keepFocus ? (e) => e.preventDefault() : undefined}
          className={cn(
            'fixed z-50 bg-panel text-ink shadow-2xl outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-slide-up',
            'md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:p-6 md:animate-fade-in',
            className,
          )}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line md:hidden" aria-hidden />
          <div className={cn('mb-4 flex items-start gap-3', hideTitle && 'sr-only')}>
            <div className="min-w-0 flex-1">
              <D.Title className="text-lg font-semibold">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
                : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="-m-1 rounded-full p-1.5 text-muted hover:bg-hover hover:text-ink" aria-label="Close">
              <X className="size-5" />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

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
export const PanelClose = D.Close;

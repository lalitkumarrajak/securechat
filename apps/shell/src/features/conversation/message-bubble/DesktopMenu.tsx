import * as M from '@radix-ui/react-dropdown-menu';
import { ChevronDown, SmilePlus } from 'lucide-react';
import { QUICK_REACTIONS } from '../../../lib/emoji';
import { type Msg } from '../../../lib/types';
import { cn } from '@sanga/ui/utils';
import { actionsFor, canReact, myReaction, reactTo, setChatUi } from '../chatUi';
import { ActionItem } from './ActionItem';

/** Hover chevron (and right-click) menu on desktop, with quick reactions on top. */
export function DesktopMenu({ m, album, open, onOpenChange, bare }: { m: Msg; album?: Msg[]; open: boolean; onOpenChange: (o: boolean) => void; bare: boolean }) {
  const actions = actionsFor(m, album);
  return (
    <M.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <M.Trigger asChild>
        <button aria-label="Message options" onClick={(e) => e.stopPropagation()}
          className={cn('absolute top-1 right-1 z-10 grid size-6 place-items-center rounded-full text-muted opacity-0 transition group-hover:opacity-100 data-[state=open]:opacity-100',
            bare ? 'bg-panel shadow-bubble' : m.out ? 'bg-bubble-out' : 'bg-bubble-in')}>
          <ChevronDown className="size-4" />
        </button>
      </M.Trigger>
      <M.Portal>
        <M.Content align={m.out ? 'end' : 'start'} sideOffset={4} collisionPadding={8}
          onCloseAutoFocus={(e) => e.preventDefault()} // keep focus in the message box after Reply/Edit
          className="z-50 w-56 rounded-xl border border-line bg-panel p-1 text-ink shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
          {canReact(m) && (
            <div className="flex items-center justify-between gap-0.5 border-b border-line px-1 pt-1 pb-2">
              {QUICK_REACTIONS.map((e) => (
                <M.Item key={e} onSelect={() => reactTo(m, e)} aria-label={'React ' + e}
                  className={cn('grid size-8 cursor-pointer place-items-center rounded-full text-xl outline-none transition data-[highlighted]:scale-125 data-[highlighted]:bg-hover',
                    myReaction(m) === e && 'bg-accent/15')}>
                  {e}
                </M.Item>
              ))}
              <M.Item onSelect={() => setChatUi({ picker: m })} aria-label="More reactions"
                className="grid size-8 cursor-pointer place-items-center rounded-full text-muted outline-none data-[highlighted]:bg-hover">
                <SmilePlus className="size-5" />
              </M.Item>
            </div>
          )}
          <div className="pt-1">
            {actions.map((a) => <ActionItem key={a.key} a={a} />)}
          </div>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

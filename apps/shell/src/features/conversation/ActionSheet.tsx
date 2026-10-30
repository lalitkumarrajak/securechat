import { flushSync } from 'react-dom';
import { SmilePlus } from 'lucide-react';
import { Dialog } from '@sanga/ui/dialog';
import { QUICK_REACTIONS } from '../../lib/emoji';
import { preview } from '../../lib/engine';
import { cn } from '@sanga/ui/utils';
import { ICONS } from './message-bubble/icons';
import { actionsFor, canReact, myReaction, reactTo, setChatUi, useChatUi } from './chatUi';

/** Long-press on a phone: reactions on top, then the actions. */
export function ActionSheet() {
  const m = useChatUi((s) => s.sheet);
  const album = useChatUi((s) => s.sheetAlbum);
  const close = () => setChatUi({ sheet: null, sheetAlbum: null });
  return (
    <Dialog open={!!m} onOpenChange={(o) => !o && close()} title="Message options" hideTitle keepFocus className="md:max-w-sm">
      {m && (
        <>
          <p className="mb-3 line-clamp-2 rounded-xl bg-panel-2 px-3 py-2 text-sm text-muted">{album ? `📷 ${album.length} photos` : preview(m)}</p>
          {canReact(m) && (
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-panel-2 px-2 py-1.5">
              {QUICK_REACTIONS.map((e) => (
                <button key={e} onClick={() => { reactTo(m, e); close(); }} aria-label={'React ' + e}
                  className={cn('grid size-11 place-items-center rounded-full text-2xl transition active:scale-125', myReaction(m) === e && 'bg-accent/20')}>
                  {e}
                </button>
              ))}
              <button onClick={() => setChatUi({ sheet: null, picker: m })} aria-label="More reactions" className="grid size-11 place-items-center rounded-full text-muted">
                <SmilePlus className="size-6" />
              </button>
            </div>
          )}
          <ul className="-mx-2">
            {actionsFor(m, album).map((a) => (
              <li key={a.key}>
                {/* Close the sheet right now (it traps focus while open), then run the action in the
                    same tap, so "Reply" can focus the message box and open the keyboard. */}
                <button onClick={() => { flushSync(close); a.run(); }} disabled={a.disabled}
                  className={cn('flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left hover:bg-hover disabled:opacity-45 disabled:hover:bg-transparent [&_svg]:size-5',
                    a.danger ? 'text-danger' : '[&_svg]:text-muted')}>
                  {ICONS[a.key]}
                  <span>{a.label}{a.hint && <span className="block text-xs text-muted">{a.hint}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}

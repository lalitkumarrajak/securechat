import { Dialog } from '@sanga/ui/dialog';
import { EMOJI_PICKER } from '../../lib/emoji';
import { cn } from '@sanga/ui/utils';
import { myReaction, reactTo, setChatUi, useChatUi } from './chatUi';

export function ReactionPicker() {
  const m = useChatUi((s) => s.picker);
  return (
    <Dialog open={!!m} onOpenChange={(o) => !o && setChatUi({ picker: null })} title="React with an emoji">
      <div className="grid max-h-80 grid-cols-8 gap-1 overflow-y-auto">
        {EMOJI_PICKER.map((e) => (
          <button key={e} onClick={() => { if (m) reactTo(m, e); setChatUi({ picker: null }); }}
            className={cn('grid aspect-square place-items-center rounded-lg text-2xl hover:bg-hover', m && myReaction(m) === e && 'bg-accent/20')}>
            {e}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

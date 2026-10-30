import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { cn } from '@sanga/ui/utils';
import { openTopic, saveTopic } from '../../lib/engine';
import { useApp } from '../../state/app';
import { NO_TOPICS, useTabDialog } from './chatTabs';

const SUGGESTIONS = [['🏠', 'House'], ['💰', 'Expenses'], ['✈️', 'Trips'], ['🛒', 'Shopping'], ['📅', 'Plans'], ['💼', 'Work']];
const EMOJI = ['🏠', '💰', '✈️', '🛒', '📅', '💼', '🎉', '❤️', '🍽️', '🚗', '💊', '📚', '🧸', '🐾', '⭐', '📌'];

/** Add a tab, or rename one. */
export function ChatTabDialog({ peer }: { peer: string }) {
  const edit = useTabDialog((s) => s.edit);
  const taken = useApp((s) => s.chats.find((c) => c.peer === peer)?.topics || NO_TOPICS);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (edit === 'new') { setName(''); setEmoji('🏠'); }
    else if (edit) { setName(edit.name); setEmoji(edit.emoji); }
  }, [edit]);
  const close = () => useTabDialog.setState({ edit: null });
  const renaming = edit && edit !== 'new' ? edit : null;
  const unused = SUGGESTIONS.filter(([, n]) => !taken.some((t) => t.name.toLowerCase() === n.toLowerCase()));

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const id = await saveTopic(peer, name, emoji, renaming?.id);
      close();
      if (!renaming) { await openTopic(peer, id); toast.success(`“${name.trim()}” tab added`); }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!edit} onOpenChange={(o) => !o && close()} title={renaming ? 'Rename tab' : 'Add a tab'}
      description={renaming ? undefined : 'Keep one subject together, like house things or expenses. Everyone in this chat sees the tab.'}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {!renaming && unused.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {unused.map(([e, n]) => (
              <button key={n} type="button" onClick={() => { setEmoji(e); setName(n); }}
                className={cn('h-8 rounded-full px-3 text-sm transition', name === n ? 'bg-accent/15 text-accent-ink' : 'bg-panel-2 text-muted hover:text-ink')}>
                {e} {n}
              </button>
            ))}
          </div>
        )}
        <Label htmlFor="tab-name">Name</Label>
        <Input id="tab-name" autoFocus value={name} maxLength={30} placeholder="e.g. House" onChange={(e) => setName(e.target.value)} />
        <p className="mt-4 mb-1.5 text-sm font-medium">Icon</p>
        <div role="radiogroup" aria-label="Icon" className="grid grid-cols-8 gap-1">
          {EMOJI.map((e) => (
            <button key={e} type="button" role="radio" aria-checked={emoji === e} aria-label={e} onClick={() => setEmoji(e)}
              className={cn('grid aspect-square place-items-center rounded-xl text-xl transition', emoji === e ? 'bg-accent/15 ring-2 ring-accent' : 'hover:bg-hover')}>
              {e}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>{renaming ? 'Save' : 'Add tab'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

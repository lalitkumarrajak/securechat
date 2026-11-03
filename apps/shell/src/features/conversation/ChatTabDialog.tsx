import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { cn } from '@sanga/ui/utils';
import { openTopic, saveTopic } from '../../lib/engine';
import { useApp } from '../../state/app';
import { NO_TOPICS, useTabDialog } from './chatTabs';
import { t, tk } from '@sanga/i18n';

const SUGGESTIONS = [['🏠', tk('House')], ['💰', tk('Expenses')], ['✈️', tk('Trips')], ['🛒', tk('Shopping')], ['📅', tk('Plans')], ['💼', tk('Work')]];
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
  const unused = SUGGESTIONS.filter(([, n]) => !taken.some((tp) => tp.name.toLowerCase() === n.toLowerCase() || tp.name.toLowerCase() === t(n).toLowerCase()));

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const id = await saveTopic(peer, name, emoji, renaming?.id);
      close();
      if (!renaming) { await openTopic(peer, id); toast.success(t('“{name}” tab added', { name: name.trim() })); }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!edit} onOpenChange={(o) => !o && close()} title={renaming ? t('Rename tab') : t('Add a tab')}
      description={renaming ? undefined : t('Keep one subject together, like house things or expenses. Everyone in this chat sees the tab.')}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {!renaming && unused.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {unused.map(([e, n]) => (
              <button key={n} type="button" onClick={() => { setEmoji(e); setName(t(n)); }}
                className={cn('h-8 rounded-full px-3 text-sm transition', name === t(n) ? 'bg-accent/15 text-accent-ink' : 'bg-panel-2 text-muted hover:text-ink')}>
                {e} {t(n)}
              </button>
            ))}
          </div>
        )}
        <Label htmlFor="tab-name">{t('Name')}</Label>
        <Input id="tab-name" autoFocus value={name} maxLength={30} placeholder={t('e.g. House')} onChange={(e) => setName(e.target.value)} />
        <p className="mt-4 mb-1.5 text-sm font-medium">{t('Icon')}</p>
        <div role="radiogroup" aria-label={t('Icon')} className="grid grid-cols-8 gap-1">
          {EMOJI.map((e) => (
            <button key={e} type="button" role="radio" aria-checked={emoji === e} aria-label={e} onClick={() => setEmoji(e)}
              className={cn('grid aspect-square place-items-center rounded-xl text-xl transition', emoji === e ? 'bg-accent/15 ring-2 ring-accent' : 'hover:bg-hover')}>
              {e}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>{t('Cancel')}</Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>{renaming ? t('Save') : t('Add tab')}</Button>
        </div>
      </form>
    </Dialog>
  );
}

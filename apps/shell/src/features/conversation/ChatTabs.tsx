// Tabs inside a chat: the main chat, then threads you make for one subject ("🏠 House",
// "💰 Expenses"). Everyone in the chat sees the same tabs; each keeps its own messages.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { confirm } from '@sanga/ui/confirm';
import { Dialog } from '@sanga/ui/dialog';
import { Input, Label } from '@sanga/ui/input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@sanga/ui/menu';
import { cn } from '@sanga/ui/utils';
import { deleteTopic, openTopic, saveTopic } from '../../lib/engine';
import type { Topic } from '../../lib/types';
import { useApp } from '../../state/app';
import { create } from 'zustand';

/** The add / rename dialog: 'new', a tab to rename, or closed. */
const useTabDialog = create<{ edit: Topic | 'new' | null }>(() => ({ edit: null }));
export const addChatTab = () => useTabDialog.setState({ edit: 'new' });

const NO_TOPICS: Topic[] = [];
const SUGGESTIONS = [['🏠', 'House'], ['💰', 'Expenses'], ['✈️', 'Trips'], ['🛒', 'Shopping'], ['📅', 'Plans'], ['💼', 'Work']];
const EMOJI = ['🏠', '💰', '✈️', '🛒', '📅', '💼', '🎉', '❤️', '🍽️', '🚗', '💊', '📚', '🧸', '🐾', '⭐', '📌'];

export function ChatTabs({ peer }: { peer: string }) {
  const topics = useApp((s) => s.chats.find((c) => c.peer === peer)?.topics || NO_TOPICS);
  const unread = useApp((s) => s.chats.find((c) => c.peer === peer)?.tunread);
  const topic = useApp((s) => s.topic);
  // A tab removed by the other person while you're in it: back to the main chat.
  useEffect(() => { if (topic && !topics.some((t) => t.id === topic)) void openTopic(peer, ''); }, [topic, topics, peer]);
  if (!topics.length) return null;

  const remove = async (t: Topic) => {
    if (await confirm({ title: `Remove the “${t.name}” tab?`, description: 'The tab and its messages are removed for everyone in this chat. This can’t be undone.', confirmText: 'Remove tab', destructive: true })) {
      deleteTopic(peer, t.id).then(() => toast(`“${t.name}” removed`)).catch((e) => toast.error(e.message));
    }
  };

  return (
    <nav role="tablist" aria-label="Chat tabs" className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-panel px-2 py-1.5 [scrollbar-width:none]">
      <Tab selected={!topic} count={unread?.[''] || 0} onClick={() => openTopic(peer, '')} label="Main">
        <MessageCircle className="size-4" />
      </Tab>
      {topics.map((t) => (
        <span key={t.id} className="flex shrink-0 items-center">
          <Tab selected={topic === t.id} count={unread?.[t.id] || 0} onClick={() => openTopic(peer, t.id)} label={t.name}>
            {t.emoji && <span aria-hidden>{t.emoji}</span>}
          </Tab>
          {topic === t.id && (
            <Menu>
              <MenuTrigger asChild>
                <button aria-label={`${t.name} tab options`} className="-ml-1 grid size-7 place-items-center rounded-full text-accent-ink hover:bg-hover"><ChevronDown className="size-4" /></button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Pencil />} onSelect={() => useTabDialog.setState({ edit: t })}>Rename tab</MenuItem>
                <MenuItem icon={<Trash2 />} danger onSelect={() => remove(t)}>Remove tab</MenuItem>
              </MenuContent>
            </Menu>
          )}
        </span>
      ))}
      <button onClick={addChatTab} aria-label="Add a tab" title="Add a tab"
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"><Plus className="size-4" /></button>
    </nav>
  );
}

function Tab({ selected, count, onClick, label, children }: { selected: boolean; count: number; onClick: () => void; label: string; children: React.ReactNode }) {
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

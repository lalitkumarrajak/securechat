// Tabs inside a chat: the main chat, then threads you make for one subject ("🏠 House",
// "💰 Expenses"). Everyone in the chat sees the same tabs; each keeps its own messages.
import { useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronDown, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { confirm } from '@sanga/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@sanga/ui/menu';
import { deleteTopic, openTopic } from '../../lib/engine';
import type { Topic } from '../../lib/types';
import { useApp } from '../../state/app';
import { NO_TOPICS, addChatTab, useTabDialog } from './chatTabs';
import { Tab } from './Tab';

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

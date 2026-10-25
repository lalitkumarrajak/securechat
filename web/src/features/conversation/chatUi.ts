// Dialogs and sheets opened from inside a conversation.
import { create } from 'zustand';
import { toast } from 'sonner';
import { choose } from '../../components/ui/confirm';
import { canDeleteForEveryone, canEdit } from '../../lib/controls';
import { copyMessages, deleteForEveryone, deleteForMe, me, react, retry, togglePin } from '../../lib/engine';
import type { Msg } from '../../lib/types';
import { getApp, setApp } from '../../state/app';

interface ChatUi {
  forward: Msg[] | null;   // forward dialog
  info: Msg | null;        // message info
  picker: Msg | null;      // full emoji picker for a reaction
  sheet: Msg | null;       // phone action sheet (long-press)
  verify: boolean;         // security code dialog
  viewer: string | null;   // full-screen photo
}
export const useChatUi = create<ChatUi>(() => ({ forward: null, info: null, picker: null, sheet: null, verify: false, viewer: null }));
export const setChatUi = useChatUi.setState;

/** Focus the message box. Must run during the tap itself: phones only open the keyboard then. */
export function focusComposer() {
  document.querySelector<HTMLTextAreaElement>('#composer-input')?.focus();
}

export function startReply(m: Msg) {
  setApp({ replyTo: m, editing: null });
  focusComposer();
}

export async function deleteFlow(msgs: Msg[]) {
  if (!msgs.length) return;
  const everyone = canDeleteForEveryone(msgs);
  const n = msgs.length;
  const someMine = msgs.some((m) => m.out && m.type !== 'deleted');
  const v = await choose({
    title: n > 1 ? `Delete ${n} messages?` : 'Delete message?',
    description: everyone ? undefined : someMine ? 'Messages can be deleted for everyone only within 5 minutes of sending.' : undefined,
    actions: [
      ...(everyone ? [{ label: 'Delete for everyone', value: 'all', variant: 'danger' as const }] : []),
      { label: 'Delete for me', value: 'me', variant: everyone ? 'secondary' as const : 'danger' as const },
    ],
  });
  if (v === 'all') {
    try { deleteForEveryone(msgs); } catch (e) { toast.error((e as Error).message); return; }
  } else if (v === 'me') await deleteForMe(msgs);
  else return;
  setApp({ selection: null });
}

export interface Action { key: string; label: string; danger?: boolean; run: () => void }

/** Everything you can do with one message, in menu order. */
export function actionsFor(m: Msg): Action[] {
  const live = m.type !== 'deleted' && m.type !== 'err';
  const pinned = !!getApp().chats.find((c) => c.peer === m.peer)?.pins?.some((p) => p.k === m.k);
  const list: Action[] = [];
  if (m.s === -2) list.push({ key: 'retry', label: 'Send again', run: () => retry(m) });
  if (live && m.s !== -2) list.push({ key: 'reply', label: 'Reply', run: () => startReply(m) });
  if (live && m.text) list.push({ key: 'copy', label: 'Copy', run: () => copyMessages([m]).then(() => toast.success('Copied')) });
  if (live && m.s !== -2) list.push({ key: 'forward', label: 'Forward', run: () => setChatUi({ forward: [m] }) });
  if (live && m.id != null) list.push({ key: 'pin', label: pinned ? 'Unpin' : 'Pin', run: () => togglePin(m) });
  if (canEdit(m)) list.push({ key: 'edit', label: 'Edit', run: () => { setApp({ editing: m, replyTo: null }); focusComposer(); } });
  list.push({ key: 'select', label: 'Select', run: () => setApp({ selection: [m.k] }) });
  if (m.out && live) list.push({ key: 'info', label: 'Info', run: () => setChatUi({ info: m }) });
  list.push({ key: 'delete', label: 'Delete', danger: true, run: () => deleteFlow([m]) });
  return list;
}

export const canReact = (m: Msg) => m.type !== 'deleted' && m.type !== 'err' && m.id != null;
export const myReaction = (m: Msg) => m.reacts?.[me()];
export const reactTo = (m: Msg, e: string) => react(m, e).catch((err) => toast.error(err.message));

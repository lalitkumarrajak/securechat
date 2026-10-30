import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Lock, NotebookPen, Trash2 } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { sdk } from '@sanga/sdk';
import { deleteNote, isEmpty, MAX_TEXT, MAX_TITLE, MOODS, saveNote, useNotes, type Note } from '../notes';
import { Avatar } from './Avatar';
import { dayLabel } from './dayLabel';
import { useChatName } from './useChatName';

/** Write or change a note. Everything saves as you type; an emptied note is removed when you leave. */
export function Editor({ note, onDone }: { note: Note; onDone: (day?: string) => void }) {
  const [n, setN] = useState(note);
  const stored = useNotes((s) => s.notes[note.id]);
  const online = sdk().useOnline();
  const chats = sdk().useChats();
  const chatName = useChatName();
  const saved = useRef(note);
  const latest = useRef(n);
  latest.current = n;

  const flush = (x: Note) => {
    if (x === saved.current) return;
    if (isEmpty(x) && !useNotes.getState().notes[x.id]) return; // nothing written yet
    saved.current = x;
    saveNote(x);
  };
  useEffect(() => {
    const t = setTimeout(() => flush(n), 400);
    return () => clearTimeout(t);
  }, [n]);
  useEffect(() => () => { // leaving: save the last keystrokes, or remove a note that was emptied
    const x = latest.current;
    if (isEmpty(x)) { if (useNotes.getState().notes[x.id]) deleteNote(x.id); }
    else flush(x);
  }, []);

  const set = (p: Partial<Note>) => setN((x) => ({ ...x, ...p }));
  const remove = async () => {
    if (!(await sdk().confirm({ title: 'Delete this note?', description: 'It’s removed from all your devices.', confirmText: 'Delete', destructive: true }))) return;
    saved.current = latest.current = { ...n, title: '', text: '', mood: '' }; // nothing left to save on the way out
    deleteNote(n.id);
    onDone();
  };
  const options = useMemo(() => {
    const list = chats.map((c) => c.peer);
    if (n.chat && !list.includes(n.chat)) list.push(n.chat);
    return list.sort((a, b) => chatName(a).localeCompare(chatName(b)));
  }, [chats, n.chat, chatName]);

  const status = !stored ? '' : !stored.dirty ? 'Saved' : online ? 'Saving…' : 'Saved on this device. It syncs when you’re online.';
  const words = n.text.trim() ? n.text.trim().split(/\s+/).length : 0;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-panel md:border-l md:border-line">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line/60 px-3">
        <IconButton label="Back to diary" onClick={() => onDone(n.day)}><ArrowLeft /></IconButton>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{dayLabel(n.day)}</h2>
        <span className="flex items-center gap-1 text-xs text-muted" role="status">{status === 'Saved' && <Check className="size-3.5" />}{status}</span>
        {stored && <IconButton label="Delete note" onClick={remove}><Trash2 /></IconButton>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-full border border-line bg-panel-2/60 px-3 py-1.5 text-sm">
              <CalendarDays className="size-4 text-muted" />
              <input type="date" aria-label="Day" value={n.day} required onChange={(e) => e.target.value && set({ day: e.target.value })} className="bg-transparent outline-none" />
            </label>
            <label className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-panel-2/60 px-3 py-1.5 text-sm">
              {n.chat ? <Avatar u={n.chat} name={chatName(n.chat)} size={18} /> : <NotebookPen className="size-4 text-muted" />}
              <select aria-label="About" value={n.chat} onChange={(e) => set({ chat: e.target.value })} className="min-w-0 bg-transparent outline-none">
                <option value="">Personal (just me)</option>
                {options.map((p) => <option key={p} value={p}>{chatName(p)}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">How are you feeling?</p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1.5 py-1.5" role="group" aria-label="Mood">
            {MOODS.map((e) => (
              <button key={e} onClick={() => set({ mood: n.mood === e ? '' : e })} aria-label={`Mood ${e}`} aria-pressed={n.mood === e}
                className={cn('grid size-11 shrink-0 place-items-center rounded-2xl text-2xl transition',
                  n.mood === e ? 'scale-110 bg-amber-500/15 ring-2 ring-amber-500' : 'bg-panel-2/60 opacity-70 hover:opacity-100')}>
                {e}
              </button>
            ))}
          </div>
          <input value={n.title} onChange={(e) => set({ title: e.target.value })} maxLength={MAX_TITLE} placeholder="Title" aria-label="Title"
            className="mt-6 bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted/60 md:text-3xl" />
          <textarea value={n.text} onChange={(e) => set({ text: e.target.value })} maxLength={MAX_TEXT} autoFocus={!stored}
            placeholder={n.chat ? `Notes about ${chatName(n.chat)}…` : 'Write about your day…'} aria-label="Note"
            className="mt-3 min-h-[45vh] flex-1 resize-none bg-transparent text-[1.05rem] leading-relaxed outline-none placeholder:text-muted/70" />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" />{words} word{words === 1 ? '' : 's'} · Only you can read this</p>
        </div>
      </div>
    </div>
  );
}

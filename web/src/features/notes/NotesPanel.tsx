// Diary and notes: write about a day, for yourself or about one chat. A month calendar marks the
// days you wrote something; pick one to see (and add to) that day, or browse everything by day.
// Opened from the chat list (everything) or from a chat's menu (that chat's notes).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CloudOff, NotebookPen, Plus, Search, Trash2, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { IconButton } from '../../components/ui/button';
import { confirm } from '../../components/ui/confirm';
import { Panel } from '../../components/ui/dialog';
import { fmtClock, fmtDay } from '../../lib/format';
import { dayDate, dayKey, deleteNote, isEmpty, MAX_TEXT, MAX_TITLE, MOODS, newNote, saveNote, today, useNotes, type Note } from '../../lib/notes';
import { displayName, groupIdOf, isGroup } from '../../lib/types';
import { cn } from '../../lib/utils';
import { setApp, useApp } from '../../state/app';

function useChatName() {
  const friends = useApp((s) => s.friends);
  const groups = useApp((s) => s.groups);
  return (peer: string) => (!peer ? 'Personal' : isGroup(peer) ? groups[groupIdOf(peer)]?.name || 'Group' : displayName(friends[peer], peer));
}

const dayLabel = (day: string) => fmtDay(dayDate(day).getTime());

export function NotesPanel() {
  const open = useApp((s) => s.panel === 'notes');
  const [editing, setEditing] = useState<Note | null>(null);
  const [day, setDay] = useState<string | null>(null); // null: every day
  const [month, setMonth] = useState(() => today().slice(0, 7));
  useEffect(() => { if (!open) { setEditing(null); setDay(null); setMonth(today().slice(0, 7)); } }, [open]);
  const close = () => setApp({ panel: null });

  return (
    <Panel open={open} onOpenChange={(o) => !o && close()} title="Diary and notes">
      {open && (editing
        ? <Editor key={editing.id} note={editing} onDone={(d) => { setEditing(null); if (d && day) { setDay(d); setMonth(d.slice(0, 7)); } }} /> /* looking at one day: follow a note moved to another */
        : <Browse day={day} setDay={setDay} month={month} setMonth={setMonth} onOpen={setEditing} onClose={close} />)}
    </Panel>
  );
}

function Browse({ day, setDay, month, setMonth, onOpen, onClose }: {
  day: string | null; setDay: (d: string | null) => void; month: string; setMonth: (m: string) => void;
  onOpen: (n: Note) => void; onClose: () => void;
}) {
  const all = useNotes((s) => s.notes);
  const loaded = useNotes((s) => s.loaded);
  const filter = useNotes((s) => s.filter);
  const chatName = useChatName();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const notes = useMemo(() => Object.values(all).filter((n) => !n.deleted && (filter === null || n.chat === filter)), [all, filter]);
  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) m.set(n.day, (m.get(n.day) || 0) + 1);
    return m;
  }, [notes]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => (!day || n.day === day) && (!q || n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q)))
      .sort((a, b) => b.day.localeCompare(a.day) || b.created - a.created);
  }, [notes, day, query]);
  // Chats you have notes about, for the filter chips (and the open one, even with none yet).
  const chats = useMemo(() => {
    const set = new Set(Object.values(all).filter((n) => !n.deleted && n.chat).map((n) => n.chat));
    if (filter) set.add(filter);
    return [...set].sort((a, b) => chatName(a).localeCompare(chatName(b)));
  }, [all, filter, chatName]);

  const create = () => onOpen(newNote(day || today(), filter ?? ''));
  const title = filter === null ? 'Diary' : filter === '' ? 'Personal diary' : `Notes · ${chatName(filter)}`;

  let lastDay = '';
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 bg-panel px-3">
        <IconButton label="Back" onClick={onClose}><ArrowLeft /></IconButton>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
        <IconButton label={searching ? 'Close search' : 'Search notes'} onClick={() => { setSearching(!searching); setQuery(''); }}>{searching ? <X /> : <Search />}</IconButton>
      </header>
      {searching && (
        <div className="bg-panel px-3 pb-2">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes"
            className="h-10 w-full rounded-xl bg-panel-2 px-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        <div className="flex gap-2 overflow-x-auto bg-panel px-3 pb-3" role="group" aria-label="Show notes for">
          <Chip on={filter === null} onClick={() => useNotes.setState({ filter: null })}>All</Chip>
          <Chip on={filter === ''} onClick={() => useNotes.setState({ filter: '' })}><NotebookPen className="size-3.5" />Personal</Chip>
          {chats.map((c) => (
            <Chip key={c} on={filter === c} onClick={() => useNotes.setState({ filter: c })}>
              <Avatar u={c} name={chatName(c)} size={18} />{chatName(c)}
            </Chip>
          ))}
        </div>

        <Calendar month={month} setMonth={setMonth} day={day} setDay={setDay} perDay={perDay} />

        <div className="px-3">
          {day && (
            <div className="flex items-center gap-2 pt-3 pb-1">
              <h3 className="flex-1 font-semibold">{dayLabel(day)}</h3>
              <button onClick={() => setDay(null)} className="rounded-full px-3 py-1 text-sm text-accent-ink hover:bg-hover">Show all days</button>
            </div>
          )}
          {!loaded ? null : shown.length === 0 ? (
            <div className="mx-auto max-w-xs py-10 text-center text-sm text-muted">
              {query ? 'No notes match your search.'
                : day ? 'Nothing written on this day yet.'
                : 'Write about your day, or keep notes about a chat. Only you can read them: they’re end-to-end encrypted like your messages.'}
              {!query && <button onClick={create} className="mt-3 block w-full rounded-xl bg-accent px-4 py-2.5 font-medium text-white">Write a note</button>}
            </div>
          ) : (
            <ul className="space-y-2 pt-2">
              {shown.map((n) => {
                const head = !day && n.day !== lastDay;
                lastDay = n.day;
                return (
                  <li key={n.id}>
                    {head && <h3 className="px-1 pt-3 pb-1.5 text-sm font-semibold text-muted">{dayLabel(n.day)}</h3>}
                    <NoteCard n={n} showChat={filter === null} chatName={chatName} onOpen={() => onOpen(n)} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <button onClick={create} aria-label="New note"
        className="absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-lg active:scale-95">
        <Plus className="size-6" />
      </button>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap',
        on ? 'bg-accent text-white' : 'bg-panel-2 text-ink hover:bg-hover')}>
      {children}
    </button>
  );
}

function NoteCard({ n, showChat, chatName, onOpen }: { n: Note; showChat: boolean; chatName: (p: string) => string; onOpen: () => void }) {
  const lines = n.text.trim().split('\n');
  const head = n.title.trim() || lines[0] || (n.mood ? 'Mood' : 'Untitled');
  const rest = n.title.trim() ? n.text.trim() : lines.slice(1).join('\n').trim();
  return (
    <button onClick={onOpen} className="priv-scope flex w-full items-start gap-3 rounded-2xl bg-panel p-3 text-left shadow-bubble hover:bg-hover">
      {n.mood && <span className="text-2xl leading-none" aria-label={`Mood ${n.mood}`}>{n.mood}</span>}
      <span className="min-w-0 flex-1">
        <span className="priv block truncate font-semibold">{head}</span>
        {rest && <span className="priv mt-0.5 line-clamp-2 block text-sm whitespace-pre-wrap text-muted">{rest}</span>}
        <span className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          {showChat && (
            <span className="flex min-w-0 items-center gap-1 rounded-full bg-panel-2 py-0.5 pr-2 pl-0.5">
              {n.chat ? <Avatar u={n.chat} name={chatName(n.chat)} size={16} /> : <NotebookPen className="ml-1 size-3" />}
              <span className="priv truncate">{chatName(n.chat)}</span>
            </span>
          )}
          <span>{fmtClock(n.edited)}</span>
          {n.dirty && <CloudOff className="size-3.5" aria-label="Not synced yet" />}
        </span>
      </span>
    </button>
  );
}

function Calendar({ month, setMonth, day, setDay, perDay }: {
  month: string; setMonth: (m: string) => void; day: string | null; setDay: (d: string | null) => void; perDay: Map<string, number>;
}) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => dayKey(new Date(y, m - 1, i + 1)))];
  const shift = (by: number) => setMonth(dayKey(new Date(y, m - 1 + by, 1)).slice(0, 7));
  const now = today();
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString([], { weekday: 'narrow' })); // 1 Jan 2023 was a Sunday

  return (
    <div className="mx-3 mt-3 rounded-2xl bg-panel p-3 shadow-bubble">
      <div className="mb-2 flex items-center gap-1">
        <IconButton label="Previous month" onClick={() => shift(-1)}><ChevronLeft /></IconButton>
        <h3 className="flex-1 text-center font-semibold" aria-live="polite">{first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h3>
        <IconButton label="Next month" onClick={() => shift(1)}><ChevronRight /></IconButton>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm" role="group" aria-label="Calendar">
        {weekdays.map((w, i) => <span key={i} className="pb-1 text-xs font-medium text-muted" aria-hidden>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={'x' + i} />;
          const count = perDay.get(d) || 0;
          const label = dayDate(d).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) + (count ? `, ${count} note${count > 1 ? 's' : ''}` : '');
          return (
            <button key={d} onClick={() => setDay(day === d ? null : d)} aria-label={label} aria-pressed={day === d}
              className={cn('relative mx-auto grid size-9 place-items-center rounded-full',
                day === d ? 'bg-accent font-semibold text-white' : d === now ? 'font-bold text-accent-ink ring-1 ring-accent' : 'hover:bg-hover')}>
              {Number(d.slice(8))}
              {count > 0 && <span className={cn('absolute bottom-1 size-1 rounded-full', day === d ? 'bg-white' : 'bg-accent')} />}
            </button>
          );
        })}
      </div>
      {month !== now.slice(0, 7) && (
        <button onClick={() => { setMonth(now.slice(0, 7)); setDay(now); }} className="mt-2 w-full rounded-lg py-1.5 text-sm text-accent-ink hover:bg-hover">Today</button>
      )}
    </div>
  );
}

/** Write or change a note. Everything saves as you type; an emptied note is removed when you leave. */
function Editor({ note, onDone }: { note: Note; onDone: (day?: string) => void }) {
  const [n, setN] = useState(note);
  const stored = useNotes((s) => s.notes[note.id]);
  const conn = useApp((s) => s.conn);
  const friends = useApp((s) => s.friends);
  const groups = useApp((s) => s.groups);
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
    if (!(await confirm({ title: 'Delete this note?', description: 'It’s removed from all your devices.', confirmText: 'Delete', destructive: true }))) return;
    saved.current = latest.current = { ...n, title: '', text: '', mood: '' }; // nothing left to save on the way out
    deleteNote(n.id);
    onDone();
  };
  const options = useMemo(() => {
    const list = [...Object.keys(friends), ...Object.keys(groups).map((id) => 'g:' + id)];
    if (n.chat && !list.includes(n.chat)) list.push(n.chat);
    return list.sort((a, b) => chatName(a).localeCompare(chatName(b)));
  }, [friends, groups, n.chat]);

  const status = !stored ? '' : !stored.dirty ? 'Saved' : conn === 'online' ? 'Saving…' : 'Saved on this device. It syncs when you’re online.';
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-panel">
      <header className="flex h-16 shrink-0 items-center gap-2 px-3">
        <IconButton label="Back to diary" onClick={() => onDone(n.day)}><ArrowLeft /></IconButton>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{dayLabel(n.day)}</h2>
        <span className="text-xs text-muted" role="status">{status}</span>
        {stored && <IconButton label="Delete note" onClick={remove}><Trash2 /></IconButton>}
      </header>
      <div className="flex flex-wrap gap-2 px-4 pb-2">
        <label className="flex items-center gap-2 rounded-xl bg-panel-2 px-3 py-1.5 text-sm">
          <span className="text-muted">Day</span>
          <input type="date" aria-label="Day" value={n.day} required onChange={(e) => e.target.value && set({ day: e.target.value })} className="bg-transparent outline-none" />
        </label>
        <label className="flex min-w-0 items-center gap-2 rounded-xl bg-panel-2 px-3 py-1.5 text-sm">
          <span className="text-muted">About</span>
          <select aria-label="About" value={n.chat} onChange={(e) => set({ chat: e.target.value })} className="min-w-0 bg-transparent outline-none">
            <option value="">Personal (just me)</option>
            {options.map((p) => <option key={p} value={p}>{chatName(p)}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 py-1" role="group" aria-label="Mood">
        {MOODS.map((e) => (
          <button key={e} onClick={() => set({ mood: n.mood === e ? '' : e })} aria-label={`Mood ${e}`} aria-pressed={n.mood === e}
            className={cn('grid size-10 shrink-0 place-items-center rounded-full text-2xl', n.mood === e ? 'bg-accent/20 ring-2 ring-accent' : 'opacity-60 hover:bg-hover hover:opacity-100')}>
            {e}
          </button>
        ))}
      </div>
      <input value={n.title} onChange={(e) => set({ title: e.target.value })} maxLength={MAX_TITLE} placeholder="Title" aria-label="Title"
        className="mx-4 mt-2 border-b border-line bg-transparent pb-2 text-xl font-semibold outline-none placeholder:text-muted" />
      <textarea value={n.text} onChange={(e) => set({ text: e.target.value })} maxLength={MAX_TEXT} autoFocus={!stored}
        placeholder={n.chat ? `Notes about ${chatName(n.chat)}…` : 'Write about your day…'} aria-label="Note"
        className="min-h-0 flex-1 resize-none bg-transparent px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-[1rem] leading-relaxed outline-none placeholder:text-muted" />
    </div>
  );
}

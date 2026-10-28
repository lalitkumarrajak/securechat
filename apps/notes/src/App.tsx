// Diary and notes: write about a day, for yourself or about one chat. A month calendar marks the
// days you wrote something; pick one to see (and add to) that day, or browse everything by day.
// A separate Sanga app: the shell loads it only when the diary is opened (the Diary tab, or
// "Notes about this chat"), and it also runs on its own at /apps/notes/.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, CloudOff, Flame, Lock, NotebookPen, PenLine, Plus, Search, Trash2, X } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { fmtClock, fmtDay } from '@sanga/ui/format';
import { cn } from '@sanga/ui/utils';
import { sdk, type AppProps } from '@sanga/sdk';
import { dayDate, dayKey, deleteNote, isEmpty, MAX_TEXT, MAX_TITLE, MOODS, newNote, saveNote, startNotes, today, useNotes, type Note } from './notes';

function useChatName() {
  const chats = sdk().useChats();
  return useMemo(() => {
    const names = new Map(chats.map((c) => [c.peer, c.name]));
    return (peer: string) => (!peer ? 'Personal' : names.get(peer) || (peer.startsWith('g:') ? 'Group' : peer));
  }, [chats]);
}

const Avatar = (p: { u: string; name?: string; size?: number }) => { const A = sdk().Avatar; return <A {...p} />; };

const dayLabel = (day: string) => fmtDay(dayDate(day).getTime());

/** The diary. `params.chat` opens one chat's notes ('' for the personal diary). On a wide screen the
 *  list and the open note sit side by side; on a phone the note takes the screen. */
export default function NotesApp({ onClose, params, tab }: AppProps) {
  const [editing, setEditing] = useState<Note | null>(null);
  const [day, setDay] = useState<string | null>(null); // null: every day
  const [month, setMonth] = useState(() => today().slice(0, 7));
  // Before the first render: show the chat it was opened for, and start syncing (once per session).
  useState(() => { useNotes.setState({ filter: params.chat ?? null }); startNotes(); });
  const done = (d?: string) => { setEditing(null); if (d && day) { setDay(d); setMonth(d.slice(0, 7)); } }; // looking at one day: follow a note moved to another

  return (
    <div className="flex min-h-0 flex-1 bg-bg">
      <Browse day={day} setDay={setDay} month={month} setMonth={setMonth} onOpen={setEditing} onClose={tab ? undefined : onClose}
        open={editing?.id} className={editing ? 'hidden md:flex' : 'flex'} />
      {editing
        ? <Editor key={editing.id} note={editing} onDone={done} />
        : <Blank onNew={() => setEditing(newNote(day || today(), useNotes.getState().filter ?? ''))} />}
    </div>
  );
}

/** The right-hand side on a wide screen, before a note is opened. */
function Blank({ onNew }: { onNew: () => void }) {
  return (
    <div className="hidden flex-1 place-items-center border-l border-line bg-panel-2/40 p-10 text-center md:grid">
      <div className="max-w-sm">
        <div className="mx-auto grid size-20 place-items-center rounded-3xl text-white shadow-lg" style={{ background: DIARY_GRADIENT }}>
          <BookOpen className="size-10" />
        </div>
        <h3 className="mt-5 text-xl font-semibold">Your private diary</h3>
        <p className="mt-2 text-sm text-muted">Pick a note on the left, or start a new one. Everything you write is end-to-end encrypted and synced to your devices.</p>
        <button onClick={onNew} className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110">
          <PenLine className="size-4" /> Start writing
        </button>
      </div>
    </div>
  );
}

const DIARY_GRADIENT = 'linear-gradient(135deg, #f59e0b, #d97706 55%, #b45309)';

/** Days in a row, up to today (or yesterday, if today is still blank), with something written. */
function streak(days: Set<string>) {
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function Browse({ day, setDay, month, setMonth, onOpen, onClose, open, className }: {
  day: string | null; setDay: (d: string | null) => void; month: string; setMonth: (m: string) => void;
  onOpen: (n: Note) => void; onClose?: () => void; open?: string; className?: string;
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
  const thisMonth = useMemo(() => notes.filter((n) => n.day.startsWith(today().slice(0, 7))).length, [notes]);
  const inARow = useMemo(() => streak(new Set(perDay.keys())), [perDay]);
  const wroteToday = perDay.has(today());

  const create = () => onOpen(newNote(day || today(), filter ?? ''));
  const title = filter === null ? 'Diary' : filter === '' ? 'Personal diary' : `Notes · ${chatName(filter)}`;

  let lastDay = '';
  return (
    <div className={cn('relative min-h-0 w-full flex-col bg-bg md:w-[420px] md:shrink-0 lg:w-[460px]', className)}>
      <header className="flex h-16 shrink-0 items-center gap-1 px-3">
        {onClose && <IconButton label="Back" onClick={onClose}><ArrowLeft /></IconButton>}
        <h2 className={cn('min-w-0 flex-1 truncate text-xl font-bold tracking-tight', !onClose && 'pl-2')}>{title}</h2>
        <IconButton label={searching ? 'Close search' : 'Search notes'} onClick={() => { setSearching(!searching); setQuery(''); }}>{searching ? <X /> : <Search />}</IconButton>
        <button onClick={create} className="ml-1 hidden h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:brightness-110 md:inline-flex">
          <Plus className="size-4" /> New note
        </button>
      </header>
      {searching && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes"
              className="h-10 w-full rounded-xl bg-panel-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 md:pb-6">
        {!searching && filter === null && (
          <section className="relative overflow-hidden rounded-3xl p-5 text-white shadow-md" style={{ background: DIARY_GRADIENT }}>
            <span aria-hidden className="absolute -top-8 -right-8 size-32 rounded-full bg-white/10" />
            <span aria-hidden className="absolute right-10 -bottom-12 size-24 rounded-full bg-white/10" />
            <p className="text-sm font-medium text-white/80">{dayDate(today()).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h3 className="mt-1 text-2xl font-bold">{wroteToday ? 'Anything else today?' : 'How was your day?'}</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1"><Flame className="size-3.5" />{inARow} day{inARow === 1 ? '' : 's'} in a row</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1"><NotebookPen className="size-3.5" />{thisMonth} this month</span>
            </div>
            <button onClick={() => onOpen(newNote(today(), ''))}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm hover:bg-amber-50">
              <PenLine className="size-4" /> Write about today
            </button>
          </section>
        )}

        <div className={cn('flex gap-2 overflow-x-auto pb-1', !searching && filter === null ? 'mt-4' : 'mt-1')} role="group" aria-label="Show notes for">
          <Chip on={filter === null} onClick={() => useNotes.setState({ filter: null })}>All</Chip>
          <Chip on={filter === ''} onClick={() => useNotes.setState({ filter: '' })}><NotebookPen className="size-3.5" />Personal</Chip>
          {chats.map((c) => (
            <Chip key={c} on={filter === c} onClick={() => useNotes.setState({ filter: c })}>
              <Avatar u={c} name={chatName(c)} size={18} />{chatName(c)}
            </Chip>
          ))}
        </div>

        {!searching && <Calendar month={month} setMonth={setMonth} day={day} setDay={setDay} perDay={perDay} />}

        {day && (
          <div className="flex items-center gap-2 pt-4 pb-1">
            <h3 className="flex-1 font-semibold">{dayLabel(day)}</h3>
            <button onClick={() => setDay(null)} className="rounded-full px-3 py-1 text-sm font-medium text-accent-ink hover:bg-hover">Show all days</button>
          </div>
        )}
        {!loaded ? null : shown.length === 0 ? (
          <div className="mx-auto max-w-xs py-10 text-center">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-amber-500/12 text-amber-600"><BookOpen className="size-7" /></div>
            <p className="text-sm text-muted">
              {query ? 'No notes match your search.'
                : day ? 'Nothing written on this day yet.'
                : 'Write about your day, or keep notes about a chat. Only you can read them: they’re end-to-end encrypted like your messages.'}
            </p>
            {!query && <button onClick={create} className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white"><PenLine className="size-4" />Write a note</button>}
          </div>
        ) : (
          <ul className="pt-1">
            {shown.map((n) => {
              const head = !day && n.day !== lastDay;
              lastDay = n.day;
              return (
                <li key={n.id}>
                  {head && <DayHeading day={n.day} />}
                  <NoteCard n={n} active={open === n.id} showChat={filter === null} chatName={chatName} onOpen={() => onOpen(n)} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button onClick={create} aria-label="New note"
        className="absolute right-4 bottom-4 grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-lg active:scale-95 md:hidden">
        <Plus className="size-6" />
      </button>
    </div>
  );
}

function DayHeading({ day }: { day: string }) {
  const d = dayDate(day);
  return (
    <h3 className="flex items-baseline gap-2 px-1 pt-5 pb-2">
      <span className="text-2xl font-bold tabular-nums">{d.getDate()}</span>
      <span className="text-sm font-semibold text-muted">{dayLabel(day)}</span>
    </h3>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition',
        on ? 'border-accent bg-accent text-white' : 'border-line bg-panel text-ink hover:bg-hover')}>
      {children}
    </button>
  );
}

function NoteCard({ n, active, showChat, chatName, onOpen }: { n: Note; active: boolean; showChat: boolean; chatName: (p: string) => string; onOpen: () => void }) {
  const lines = n.text.trim().split('\n');
  const head = n.title.trim() || lines[0] || (n.mood ? 'Mood' : 'Untitled');
  const rest = n.title.trim() ? n.text.trim() : lines.slice(1).join('\n').trim();
  return (
    <button onClick={onOpen} aria-current={active || undefined}
      className={cn('priv-scope mb-2 flex w-full items-start gap-3 rounded-2xl border bg-panel p-3.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md',
        active ? 'border-accent ring-2 ring-accent/25' : 'border-line/70')}>
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl text-2xl', n.mood ? 'bg-amber-500/12' : 'bg-panel-2 text-muted')} aria-label={n.mood ? `Mood ${n.mood}` : undefined}>
        {n.mood || <NotebookPen className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="priv block truncate font-semibold">{head}</span>
        {rest && <span className="priv mt-0.5 line-clamp-2 block text-sm whitespace-pre-wrap text-muted">{rest}</span>}
        <span className="mt-2 flex items-center gap-2 text-xs text-muted">
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
    <div className="mt-3 rounded-3xl border border-line/70 bg-panel p-3 shadow-sm">
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
                day === d ? 'bg-accent font-semibold text-white shadow-sm' : d === now ? 'font-bold text-accent-ink ring-1 ring-accent' : count ? 'bg-amber-500/10 font-medium hover:bg-amber-500/20' : 'hover:bg-hover')}>
              {Number(d.slice(8))}
              {count > 0 && <span className={cn('absolute bottom-1 size-1 rounded-full', day === d ? 'bg-white' : 'bg-amber-500')} />}
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

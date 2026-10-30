import { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Flame, NotebookPen, PenLine, Plus, Search, X } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { dayDate, dayKey, newNote, today, useNotes, type Note } from '../notes';
import { Avatar } from './Avatar';
import { Calendar } from './Calendar';
import { Chip } from './Chip';
import { DIARY_GRADIENT } from './constants';
import { dayLabel } from './dayLabel';
import { DayHeading } from './DayHeading';
import { NoteCard } from './NoteCard';
import { useChatName } from './useChatName';

/** Days in a row, up to today (or yesterday, if today is still blank), with something written. */
function streak(days: Set<string>) {
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function Browse({ day, setDay, month, setMonth, onOpen, onClose, open, className }: {
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

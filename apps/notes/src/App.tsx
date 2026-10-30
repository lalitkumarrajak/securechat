// Diary and notes: write about a day, for yourself or about one chat. A month calendar marks the
// days you wrote something; pick one to see (and add to) that day, or browse everything by day.
// A separate Sanga app: the shell loads it only when the diary is opened (the Diary tab, or
// "Notes about this chat"), and it also runs on its own at /apps/notes/.
import { useState } from 'react';
import type { AppProps } from '@sanga/sdk';
import { newNote, startNotes, today, useNotes, type Note } from './notes';
import { Blank } from './app/Blank';
import { Browse } from './app/Browse';
import { Editor } from './app/Editor';

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

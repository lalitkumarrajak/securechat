// The diary is its own app (apps/notes); the shell just opens it.
import { setApp } from '../state/app';

/** Open the diary: everything (null), the personal diary (''), or one chat's notes. */
export function openNotes(chat: string | null = null) {
  setApp({ panel: 'notes', notesChat: chat });
}

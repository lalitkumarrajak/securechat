// The diary is its own app (apps/notes); the shell shows it as the Diary tab.
import { go } from './nav';
import { setApp } from '../state/app';

/** Open the diary: everything (null), the personal diary (''), or one chat's notes. */
export function openNotes(chat: string | null = null) {
  setApp({ notesChat: chat });
  go('diary');
}

// The diary on its own page (/apps/notes/), without the rest of Sanga.
import { bootStandalone } from '@sanga/sdk/standalone';
import NotesApp from './App';
// Its own styles only here: inside Sanga, the shell's stylesheet covers the diary's classes too. A
// second copy of the same utilities, loaded later, would override the shell's (its plain "w-full"
// beating the shell's "md:w-[360px]", say), so Chat went full width once the diary had been opened.
import './notes.css';

void bootStandalone(NotesApp);

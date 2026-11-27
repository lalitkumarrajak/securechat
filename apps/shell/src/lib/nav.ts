// Which tab you're on once signed in: Chats (with stories at its top), Calendar, Account (#profile), Split or More,
// and the apps on the More page (Games, the Diary, Money, Passwords, Drive). Kept in the address (#calendar, #profile, #split,
// #more, #games, #diary, #accounts, #passwords, #drive) so a reload stays put; an old #stories link opens Chats. Switching tabs doesn't add to the history.
import { getApp, setApp, type Section } from '../state/app';

export const sectionFromHash = (): Section => {
  const h = location.hash.slice(1);
  return h === 'profile' || h === 'games' || h === 'diary' || h === 'calendar' || h === 'split' || h === 'accounts' || h === 'passwords' || h === 'drive' || h === 'more' ? h : 'chat';
};

const base = () => location.pathname + location.search;

export function go(section: Section) {
  if (section === getApp().section) return;
  history.replaceState(history.state, '', section === 'chat' ? base() : `${base()}#${section}`);
  setApp({ section });
}

/** The Diary's "Shared with me" (its filter value: apps/notes SHARED_WITH_ME). */
export const SHARED_NOTES = '@in';
/** Open the Diary at the notes friends shared with you (from their notification). */
export function openSharedNotes() {
  setApp({ notesChat: SHARED_NOTES });
  history.replaceState(history.state, '', `${base()}#diary`);
  setApp({ section: 'diary' });
}

// The phone's Back (or a link) changed the address to another tab or app: show it, so the screen never
// stays on a page the address has left. Entries an open chat, game or app adds keep the same address.
window.addEventListener('popstate', () => {
  if (getApp().status !== 'app') return;
  const s = sectionFromHash();
  if (s !== getApp().section) setApp({ section: s });
});

/** Back from an app on the More page (Games, the Diary, Money, Passwords, Drive): to the More page. */
export const back = () => go('more');

/** Signed out, or just signed in: start from Chats. */
export function resetSection() {
  if (location.hash) history.replaceState(null, '', base());
  setApp({ section: 'chat' });
}

// Which tab you're on once signed in: Chats (with stories at its top), Calendar, Account (#profile), Split or More,
// and the apps on the More page (Games, the Diary, Money). Kept in the address (#calendar, #profile, #split,
// #more, #games, #diary, #accounts) so a reload stays put; an old #stories link opens Chats. Switching tabs doesn't add to the history.
import { getApp, setApp, type Section } from '../state/app';

export const sectionFromHash = (): Section => {
  const h = location.hash.slice(1);
  return h === 'profile' || h === 'games' || h === 'diary' || h === 'calendar' || h === 'split' || h === 'accounts' || h === 'more' ? h : 'chat';
};

const base = () => location.pathname + location.search;

export function go(section: Section) {
  if (section === getApp().section) return;
  history.replaceState(history.state, '', section === 'chat' ? base() : `${base()}#${section}`);
  setApp({ section });
}

/** Back from an app on the More page (Games, the Diary, Money): to the More page. */
export const back = () => go('more');

/** Signed out, or just signed in: start from Chats. */
export function resetSection() {
  if (location.hash) history.replaceState(null, '', base());
  setApp({ section: 'chat' });
}

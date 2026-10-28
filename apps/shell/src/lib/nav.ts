// Which tab you're on once signed in: Chats, Stories, Games, Diary or Calendar. Kept in the address
// (#stories, #games, #diary, #calendar) so a reload stays put. Switching tabs doesn't add to the history.
import { getApp, setApp, type Section } from '../state/app';

export const sectionFromHash = (): Section => {
  const h = location.hash.slice(1);
  return h === 'stories' || h === 'games' || h === 'diary' || h === 'calendar' ? h : 'chat';
};

const base = () => location.pathname + location.search;

export function go(section: Section) {
  if (section === getApp().section) return;
  history.replaceState(history.state, '', section === 'chat' ? base() : `${base()}#${section}`);
  setApp({ section });
}

/** Signed out, or just signed in: start from Chats. */
export function resetSection() {
  if (location.hash) history.replaceState(null, '', base());
  setApp({ section: 'chat' });
}

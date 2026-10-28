// Where you are once signed in: the home screen, Chat or Games. Kept in the address (#chat, #games)
// so a reload stays put, and in the history, so the phone's back button returns home.
import { getApp, setApp, type Section } from '../state/app';

export const sectionFromHash = (): Section => {
  const h = location.hash.slice(1);
  return h === 'chat' || h === 'games' ? h : 'home';
};

const base = () => location.pathname + location.search;

export function go(section: Section) {
  const cur = getApp().section;
  if (section === cur) return;
  if (section === 'home') return goHome();
  // From home: a new history entry (back returns home). Between sections: swap this one.
  if (cur === 'home') history.pushState({ sec: true }, '', `${base()}#${section}`);
  else history.replaceState(history.state, '', `${base()}#${section}`);
  setApp({ section });
}

export function goHome() {
  const st = history.state;
  // Opened from home: go back to that entry (and past an open chat's entry); popstate does the rest.
  if (st?.sec) return history.go(st.chat ? -2 : -1);
  history.replaceState(null, '', base());
  setApp({ section: 'home', active: null, messages: [] });
}

/** Signed out, or just signed in: start from home. */
export function resetSection() {
  if (location.hash) history.replaceState(null, '', base());
  setApp({ section: 'home' });
}

window.addEventListener('popstate', () => {
  const section = sectionFromHash();
  if (section !== getApp().section) setApp({ section });
});

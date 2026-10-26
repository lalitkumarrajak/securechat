// Privacy screen (Settings → Privacy): blurs names, previews and messages so people nearby can't
// read them. The CSS in index.css does the blurring; this file handles "show everything for a
// moment" (the eye button) and blurring the whole app when you switch away.
import { create } from 'zustand';
import { useSettings } from '../state/settings';

const SHOW_FOR = 30_000;
let timer = 0;

export const usePeek = create<boolean>(() => false);

/** The eye button: show everything for 30 seconds, or hide it again straight away. */
export function togglePeek(on = !usePeek.getState()) {
  clearTimeout(timer);
  usePeek.setState(on, true);
  document.documentElement.toggleAttribute('data-peek-all', on);
  if (on) timer = window.setTimeout(() => togglePeek(false), SHOW_FOR);
}

export function initPrivacy() {
  const away = (on: boolean) => {
    const s = useSettings.getState();
    document.documentElement.toggleAttribute('data-away', on && s.privacyScreen && s.privacyBlurAway);
    if (on) togglePeek(false);
  };
  document.addEventListener('visibilitychange', () => away(document.hidden));
  window.addEventListener('blur', () => away(true));
  window.addEventListener('focus', () => away(false));
  window.addEventListener('pagehide', () => away(true));
}

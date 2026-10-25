// App lock (Settings → Privacy, this device only). While locked the app shows only the PIN
// screen: chats aren't on the page at all. It locks when the app opens, when you tap Lock, and
// after you've been away (tab hidden, phone locked, switched apps) for the time you chose.
// 5 wrong PINs in a row mean a 30-second wait; 10 sign this device out and erase its data.
import { create } from 'zustand';
import { setSettings, useSettings } from '../state/settings';
import { logout } from './engine';
import { checkPin, hashPin } from './pin';

export const LOCK_AFTER = [
  { ms: 0, label: 'Immediately' }, { ms: 60e3, label: 'After 1 minute' }, { ms: 5 * 60e3, label: 'After 5 minutes' },
  { ms: 15 * 60e3, label: 'After 15 minutes' }, { ms: 60 * 60e3, label: 'After 1 hour' },
];
export const MAX_TRIES = 10;
const WAIT_EVERY = 5, WAIT_MS = 30e3;

export const useLock = create(() => ({ locked: !!useSettings.getState().appLock }));
export const lockEnabled = () => !!useSettings.getState().appLock;
export const lockNow = () => { if (lockEnabled()) useLock.setState({ locked: true }); };

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (!lockEnabled()) return;
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    if (useSettings.getState().lockAfterMs === 0) lockNow(); // before the app switcher takes its snapshot
  } else if (hiddenAt && Date.now() - hiddenAt >= useSettings.getState().lockAfterMs) {
    lockNow();
  }
});

// Wrong attempts survive a reload, so reloading doesn't reset the limit.
const FAILS = 'chattrix-lock-fails', UNTIL = 'chattrix-lock-until';
const get = (k: string) => { try { return Number(localStorage.getItem(k) || 0); } catch { return 0; } };
const put = (k: string, v: number) => { try { if (v) localStorage.setItem(k, String(v)); else localStorage.removeItem(k); } catch { /* storage blocked */ } };
export const failedTries = () => get(FAILS);
export const waitLeft = () => Math.max(0, get(UNTIL) - Date.now());
const resetTries = () => { put(FAILS, 0); put(UNTIL, 0); };

export async function unlock(pin: string): Promise<'ok' | 'wrong' | 'wait' | 'wiped'> {
  if (waitLeft()) return 'wait';
  const h = useSettings.getState().appLock;
  if (!h || await checkPin(pin, h)) {
    resetTries();
    useLock.setState({ locked: false });
    return 'ok';
  }
  const n = failedTries() + 1;
  put(FAILS, n);
  if (n >= MAX_TRIES) { await forgetAndSignOut(); return 'wiped'; }
  if (n % WAIT_EVERY === 0) put(UNTIL, Date.now() + WAIT_MS);
  return 'wrong';
}

export async function setPin(pin: string) {
  setSettings({ appLock: await hashPin(pin) });
  resetTries();
}

export function removeLock() {
  setSettings({ appLock: null });
  resetTries();
  useLock.setState({ locked: false });
}

/** Forgot the PIN, or too many wrong tries: sign out and erase this device (password needed to come back). */
export async function forgetAndSignOut() {
  removeLock();
  await logout();
}

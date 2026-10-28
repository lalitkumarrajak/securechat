// Reminders that come due while Sanga is open (the calendar's): the server sends them over the live
// connection, sealed so only this account's devices can read them. Shown here, whichever tab is open,
// with a chime. When Sanga is closed the push brings them instead (sw.js).
import { toast } from 'sonner';
import * as C from '@sanga/crypto';
import { frameHooks, ownIdentity } from './engine';
import { go } from './nav';
import { useSettings } from '../state/settings';

let cached: { me: string; key: Promise<CryptoKey> } | null = null;
function key() {
  const { me, priv, pub } = ownIdentity();
  if (!priv) return null;
  if (cached?.me !== me) cached = { me, key: C.reminderKey(priv, pub) };
  return cached;
}

frameHooks.remind = async (m: { id: string; b: string }) => {
  const k = key();
  if (!k || typeof m.id !== 'string' || typeof m.b !== 'string') return;
  let r: { title?: string; body?: string };
  try { r = await C.openReminder(await k.key, m.b, k.me, m.id); } catch { return; }
  const title = String(r?.title || 'Reminder').slice(0, 200), body = String(r?.body || '').slice(0, 300);
  if (useSettings.getState().sound) chime();
  toast(title, { id: 'remind-' + m.id, description: body, duration: 20_000, action: { label: 'Open', onClick: () => go('calendar') } });
  // In another tab or window with push off, the system notification is the only way to see it.
  if (document.visibilityState !== 'visible' && !useSettings.getState().push && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, { body, icon: '/icon-192.png', tag: 'remind-' + m.id, data: { calendar: true } })).catch(() => {});
  }
};

function chime() {
  try {
    const a = new AudioContext();
    [660, 880, 990].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, a.currentTime + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.08, a.currentTime + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + i * 0.14 + 0.35);
      o.connect(g).connect(a.destination);
      o.start(a.currentTime + i * 0.14);
      o.stop(a.currentTime + i * 0.14 + 0.4);
    });
    setTimeout(() => void a.close(), 1500);
  } catch { /* no sound */ }
}

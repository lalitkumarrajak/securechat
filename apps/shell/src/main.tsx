import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initSettings } from './state/settings';
import { initPrivacy } from './lib/privacy';
import { toast } from 'sonner';
import { App } from './App';
import { useCall } from './lib/calls';
import './lib/reminders'; // reminders that come due while Sanga is open

initSettings();
initPrivacy();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// The app opens from the copy saved on the device (sw.js). After an update, a part of the old copy
// that was never loaded before (a game, say) may be gone from the server: reload once to get the
// new copy, which the service worker has fetched by then.
// A newer Sanga came in the background (sw.js): switch to it. Just opened: reload straight away (once).
// Later, or on a call: ask, so nothing in progress is lost.
// Which build this page is: the first build file its head names, read the same way sw.js reads it.
const myBuild = document.head.innerHTML.match(/\/assets\/index-[\w-]+\.js/)?.[0] || ''; // none in development
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.t !== 'update' || !myBuild || e.data.build === myBuild) return;
  let again = false;
  try { again = Date.now() - Number(sessionStorage.getItem('sanga-updated') || 0) < 60_000; sessionStorage.setItem('sanga-updated', String(Date.now())); } catch { /* no storage */ }
  if (!again && performance.now() < 10_000 && !useCall.getState().call) { location.reload(); return; }
  toast('A new version of Sanga is ready', { id: 'update', duration: Infinity, action: { label: 'Reload', onClick: () => location.reload() } });
});
if (myBuild) navigator.serviceWorker?.ready.then((r) => r.active?.postMessage({ t: 'build', build: myBuild })).catch(() => {});

window.addEventListener('vite:preloadError', (e) => {
  // The other apps (/apps/<name>/) show their own "Couldn't open … Try again" instead.
  if (/\/apps\//.test(String((e as Event & { payload?: unknown }).payload))) return;
  try {
    if (Date.now() - Number(sessionStorage.getItem('chattrix-reloaded') || 0) < 30_000) return;
    sessionStorage.setItem('chattrix-reloaded', String(Date.now()));
  } catch { return; }
  e.preventDefault();
  location.reload();
});

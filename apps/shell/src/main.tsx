import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initSettings } from './state/settings';
import { initPrivacy } from './lib/privacy';
import { toast } from 'sonner';
import { App } from './App';
import { register, t } from '@sanga/i18n';
import { SHELL_DICTS } from './locale';
import { UI_DICTS } from '@sanga/ui/locale';
import { SDK_DICTS } from '@sanga/sdk/locale';
import { useCall } from './lib/calls';
import './lib/reminders'; // reminders that come due while Sanga is open

initSettings();
initPrivacy();
// In another language, its words come first (English needs none): the first screen is already in it.
const dicts = { ...SHELL_DICTS, ...UI_DICTS, ...SDK_DICTS };
void Promise.all(Object.entries(dicts).map(([ns, l]) => register(ns, l)))
  .finally(() => createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>));

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
  toast(t('A new version of Sanga is ready'), { id: 'update', duration: Infinity, action: { label: t('Reload'), onClick: () => location.reload() } });
});
if (myBuild) navigator.serviceWorker?.ready.then((r) => r.active?.postMessage({ t: 'build', build: myBuild })).catch(() => {});

// An installed app on a phone is mostly brought back from the background, not opened anew, so the
// page above never loads again and never hears of a new build. Each time it comes back (at most once
// a minute): look for a new sw.js, and fetch the page, which sw.js compares with the saved one and,
// if the server has a newer build, answers with the 'update' message above. Without a service worker
// yet (the first visit), compare here.
let lastCheck = Date.now();
function checkForUpdate() {
  if (!myBuild || document.visibilityState !== 'visible' || Date.now() - lastCheck < 60_000) return;
  lastCheck = Date.now();
  navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
  fetch('/', { cache: 'no-store' }).then((r) => r.text()).then((html) => {
    const build = html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
    if (build && build !== myBuild && !navigator.serviceWorker?.controller) {
      toast(t('A new version of Sanga is ready'), { id: 'update', duration: Infinity, action: { label: t('Reload'), onClick: () => location.reload() } });
    }
  }).catch(() => {});
}
document.addEventListener('visibilitychange', checkForUpdate);
window.addEventListener('focus', checkForUpdate);
setInterval(checkForUpdate, 30 * 60_000); // left open on a laptop

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

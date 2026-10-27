import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initSettings } from './state/settings';
import { initPrivacy } from './lib/privacy';
import { App } from './App';

initSettings();
initPrivacy();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// The app opens from the copy saved on the device (sw.js). After an update, a part of the old copy
// that was never loaded before (a game, say) may be gone from the server: reload once to get the
// new copy, which the service worker has fetched by then.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (Date.now() - Number(sessionStorage.getItem('chattrix-reloaded') || 0) < 30_000) return;
    sessionStorage.setItem('chattrix-reloaded', String(Date.now()));
  } catch { return; }
  e.preventDefault();
  location.reload();
});

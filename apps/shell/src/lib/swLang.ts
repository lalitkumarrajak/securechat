// The service worker words push notifications itself (public/sw.js), but can't read the language
// picked in Settings (it lives in localStorage). Tell it now, when a new worker takes over, and on
// every switch: setLang() sets <html lang>, so watching that attribute catches it.
import { lang } from '@sanga/i18n';

function tell() {
  navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ t: 'lang', lang: lang() })).catch(() => {});
}

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof MutationObserver !== 'undefined') {
  tell();
  navigator.serviceWorker.addEventListener('controllerchange', tell);
  new MutationObserver(tell).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}

// Runs before the app loads: applies the saved appearance settings to <html>.
(function () {
  var s = {};
  try { s = JSON.parse(localStorage.getItem('chattrix-settings') || '{}').state || {}; } catch (e) {}
  var r = document.documentElement;
  var dark = s.theme === 'dark' || (s.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  r.dataset.theme = dark ? 'dark' : 'light';
  r.dataset.accent = s.accent || 'teal';
  r.dataset.font = s.fontSize || 'md';
  var meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = dark ? '#0f1419' : '#f7f8fa';
})();

// A start file that won't load (a page saved before an update, whose files the server no longer has)
// would leave a blank screen: drop the saved page and load again, once. main.tsx says when it's up.
(function () {
  var done = false;
  function recover() {
    if (done || window.__sangaUp) return;
    done = true;
    try {
      if (Date.now() - Number(sessionStorage.getItem('sanga-recover') || 0) < 30000) return;
      sessionStorage.setItem('sanga-recover', String(Date.now()));
    } catch (e) { return; }
    var go = function () { location.reload(); };
    if (!window.caches) return go();
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('chattrix-') === 0; })
        .map(function (k) { return caches.open(k).then(function (c) { return c.delete('/'); }); }));
    }).then(go, go);
  }
  addEventListener('error', function (e) {
    var el = e.target, u = el && (el.src || el.href);
    if (typeof u === 'string' && /\/(assets\/|remoteEntry-)/.test(u)) recover();
  }, true);
  addEventListener('unhandledrejection', function (e) {
    var r = e.reason, m = String((r && r.message) || r);
    if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(m)) recover();
  });
})();

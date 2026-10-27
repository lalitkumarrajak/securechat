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

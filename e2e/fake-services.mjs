// Stand-ins for outside services during end-to-end tests: the KLIPY API, a web page with
// Open Graph tags for link previews, and an IP location lookup.
import http from 'node:http';

const PORT = Number(process.env.FAKE_PORT || 4322);
const gif = (id, w, h) => ({
  id, slug: 'g' + id, title: 'Test GIF ' + id,
  file: {
    sm: { webp: { url: `https://static.klipy.com/ii/test/${id}-sm.webp`, width: w / 2, height: h / 2 } },
    md: { webp: { url: `https://static.klipy.com/ii/test/${id}-md.webp`, width: w, height: h } },
  },
});

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/v1/')) {
    const items = [1, 2, 3, 4, 5, 6].map((i) => gif((url.pathname.includes('stickers') ? 100 : 0) + i, 300, 200 + i * 10));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ result: true, data: { data: items, current_page: 1, has_next: false } }));
  } else if (url.pathname.startsWith('/geo/')) { // ipwho.is-style location lookup
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      success: true, city: 'Mumbai', region: 'Maharashtra', country: 'India', country_code: 'IN', connection: { isp: 'Reliance Jio' },
    }));
  } else if (url.pathname === '/article') {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(`<html><head><title>x</title>
      <meta property="og:title" content="Sanga launches link previews">
      <meta property="og:description" content="Titles and pictures for the links you share.">
      <meta property="og:site_name" content="Sanga Blog"></head><body></body></html>`);
  } else res.writeHead(404).end();
}).listen(PORT, () => console.log('fake services on ' + PORT));

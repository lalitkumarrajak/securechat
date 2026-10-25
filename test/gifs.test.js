// GIF and sticker search through the server, against a fake KLIPY API.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { name, register, startServer } from './helpers.js';

let srv, klipy;
const calls = [];
const media = (id) => ({
  sm: { webp: { url: `https://static.klipy.com/ii/${id}/sm.webp`, width: 220, height: 160 } },
  md: { webp: { url: `https://static.klipy.com/ii/${id}/md.webp`, width: 440, height: 320 } },
});

before(async () => {
  klipy = http.createServer((req, res) => {
    calls.push(req.url);
    const data = [
      { id: 1, title: 'cat', file: media('a') },
      { id: 2, title: 'evil', file: { sm: { gif: { url: 'https://evil.example/x.gif' } }, md: { gif: { url: 'https://evil.example/y.gif' } } } },
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ result: true, data: { data, current_page: 1, has_next: true } }));
  });
  await new Promise((r) => klipy.listen(0, r));
  srv = await startServer({ KLIPY_API_KEY: 'test-key', KLIPY_BASE_URL: `http://localhost:${klipy.address().port}` });
});
after(async () => { await srv.stop(); klipy.close(); });

describe('gifs', () => {
  it('is advertised in /api/config', async () => {
    assert.equal((await srv.api('/api/config')).data.gifs, true);
  });

  it('searches GIFs and stickers with a private customer id, keeping only KLIPY media', async () => {
    const a = await register(srv, name('gif'));
    const r = await srv.api('/api/gifs?kind=gifs&q=cat', undefined, a.token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.items, [{ id: '1', thumb: 'https://static.klipy.com/ii/a/sm.webp', src: 'https://static.klipy.com/ii/a/md.webp', w: 440, h: 320, title: 'cat' }]);
    assert.equal(r.data.next, 2);
    const url = new URL(calls.at(-1), 'http://x');
    assert.equal(url.pathname, '/api/v1/test-key/gifs/search');
    assert.equal(url.searchParams.get('q'), 'cat');
    assert.doesNotMatch(url.searchParams.get('customer_id'), new RegExp(a.u)); // username isn't shared

    await srv.api('/api/gifs?kind=stickers', undefined, a.token);
    assert.equal(new URL(calls.at(-1), 'http://x').pathname, '/api/v1/test-key/stickers/trending');
    assert.equal((await srv.api('/api/gifs?q=x')).status, 401);
  });

  it('allows KLIPY images in the security policy', async () => {
    const page = await fetch(srv.base + '/');
    assert.match(page.headers.get('content-security-policy'), /img-src [^;]*https:\/\/static\.klipy\.com/);
  });

  it('is off without a key', async () => {
    const off = await startServer();
    try {
      assert.equal((await off.api('/api/config')).data.gifs, false);
      const a = await register(off, name('nogif'));
      assert.equal((await off.api('/api/gifs?q=x', undefined, a.token)).status, 404);
    } finally { await off.stop(); }
  });
});

// Link previews: metadata parsing, image embedding, and refusing private network addresses.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { name, register, startServer } from './helpers.js';
import { parseMeta } from '../server/preview.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
let site, base;

before(async () => {
  site = http.createServer((req, res) => {
    if (req.url === '/article') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<!doctype html><html><head>
        <title>Fallback title</title>
        <meta property="og:title" content="Chattrix &amp; friends">
        <meta property="og:description" content="Private chats, made simple.">
        <meta property="og:site_name" content="Example News">
        <meta property="og:image" content="/cover.png"></head><body>hi</body></html>`);
    } else if (req.url === '/moved') res.writeHead(302, { Location: '/article' }).end();
    else if (req.url === '/cover.png') res.writeHead(200, { 'Content-Type': 'image/png' }).end(PNG);
    else if (req.url === '/file.zip') res.writeHead(200, { 'Content-Type': 'application/zip' }).end('PK');
    else res.writeHead(404).end();
  });
  await new Promise((r) => site.listen(0, r));
  base = `http://localhost:${site.address().port}`;
});
after(() => site.close());

describe('link previews', () => {
  it('parses Open Graph tags with a <title> fallback', () => {
    assert.deepEqual(parseMeta('<title>Only &quot;title&quot;</title>'), { title: 'Only "title"', desc: '', site: '', image: '' });
    assert.equal(parseMeta(`<meta content='Single quotes' property='og:title'>`).title, 'Single quotes');
  });

  it('fetches title, description, site and the image (following redirects)', async () => {
    const srv = await startServer({ PREVIEW_ALLOW_PRIVATE: '1' });
    try {
      const a = await register(srv, name('lp'));
      const r = await srv.api('/api/preview?url=' + encodeURIComponent(base + '/moved'), undefined, a.token);
      assert.equal(r.status, 200);
      assert.equal(r.data.title, 'Chattrix & friends');
      assert.equal(r.data.desc, 'Private chats, made simple.');
      assert.equal(r.data.site, 'Example News');
      assert.equal(r.data.url, base + '/article');
      assert.equal(r.data.image, 'data:image/png;base64,' + PNG.toString('base64'));
      assert.equal((await srv.api('/api/preview?url=' + encodeURIComponent(base + '/file.zip'), undefined, a.token)).status, 404);
      assert.equal((await srv.api('/api/preview?url=' + encodeURIComponent(base + '/article'))).status, 401);
    } finally { await srv.stop(); }
  });

  it('refuses private and local addresses (SSRF protection)', async () => {
    const srv = await startServer();
    try {
      const a = await register(srv, name('ssrf'));
      for (const u of [base + '/article', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://10.0.0.5/', 'file:///etc/passwd', 'ftp://example.com/']) {
        const r = await srv.api('/api/preview?url=' + encodeURIComponent(u), undefined, a.token);
        assert.equal(r.status, 404, u);
      }
    } finally { await srv.stop(); }
  });
});

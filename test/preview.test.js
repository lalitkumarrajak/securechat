// Link previews: metadata parsing, image embedding, and refusing private network addresses.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import http from 'node:http';
import { name, register, startServer } from './helpers.js';
import { isPrivate, parseMeta, publicLookup, routes } from '../server/preview.js';

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

  it('refuses IPv6 forms that embed a private IPv4 address', async () => {
    const srv = await startServer();
    try {
      const a = await register(srv, name('ssrf6'));
      // WHATWG URL rewrites [::ffff:127.0.0.1] to [::ffff:7f00:1]; every one of these reaches 127.0.0.1 or the metadata service.
      for (const u of ['http://[::ffff:127.0.0.1]/', 'http://[::127.0.0.1]/', 'http://[::ffff:169.254.169.254]/', 'http://[64:ff9b::a9fe:a9fe]/',
        'http://[64:ff9b:1::7f00:1]/', 'http://[2002:7f00:1::]/', 'http://[2001:0:4136:e378:8000:63bf:80ff:fffe]/', 'http://[fd00::1]/', 'http://[fe80::1]/', 'http://[::]/']) {
        const r = await srv.api('/api/preview?url=' + encodeURIComponent(u), undefined, a.token);
        assert.equal(r.status, 404, u);
        assert.equal(r.data.error, 'That link can’t be previewed', u);
      }
    } finally { await srv.stop(); }
  });

  it('classifies addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '100.64.0.1', '169.254.169.254', '172.31.255.255', '192.168.1.1', '198.18.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
      '::', '::1', '::ffff:7f00:1', '::ffff:8.8.8.8', '::7f00:1', '64:ff9b::a9fe:a9fe', '2002:a9fe:a9fe::', '2001::1', 'fc00::1', 'fe80::1', 'fe80::1%eth0', 'ff02::1', 'not an ip']) {
      assert.equal(isPrivate(ip), true, ip);
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '104.20.23.154', '2606:4700::1111', '2001:4860:4860::8888']) assert.equal(isPrivate(ip), false, ip);
  });

  it('vets the address it connects to, not an earlier lookup (DNS rebinding)', async (t) => {
    const lookup = (host, opts) => new Promise((resolve) => publicLookup(host, opts, (err, ...rest) => resolve(err ? err.message : rest)));
    t.mock.method(dns, 'lookup', (host, opts, cb) => cb(null, [{ address: '93.184.215.14', family: 4 }, { address: '127.0.0.1', family: 4 }]));
    assert.equal(await lookup('rebind.example', { all: true }), 'blocked');
    t.mock.method(dns, 'lookup', (host, opts, cb) => cb(null, [{ address: '93.184.215.14', family: 4 }]));
    assert.deepEqual(await lookup('rebind.example', { all: true }), [[{ address: '93.184.215.14', family: 4 }]]);
    assert.deepEqual(await lookup('rebind.example', {}), ['93.184.215.14', 4]);

    // The connection itself resolves through the check: a name that only now resolves privately is refused.
    t.mock.method(dns, 'lookup', (host, opts, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]));
    let reply;
    const res = { writeHead: () => res, end: (body) => { reply = JSON.parse(body); } };
    await routes['GET /api/preview'](null, res, 'rebind-test', null, new URL('http://x/api/preview?url=' + encodeURIComponent('http://rebind.example/')));
    assert.equal(reply.error, 'That link can’t be previewed');
    assert.ok(dns.lookup.mock.calls.length >= 1);
  });
});

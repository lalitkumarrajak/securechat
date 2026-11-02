// Song search for stories through the server, against a fake iTunes Search API.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { name, register, startServer } from './helpers.js';

let srv, itunes;
const calls = [];

before(async () => {
  itunes = http.createServer((req, res) => {
    calls.push(req.url);
    const results = [
      { trackId: 1, trackName: 'Kesariya', artistName: 'Arijit Singh', previewUrl: 'https://audio-ssl.itunes.apple.com/p/1.m4a', artworkUrl100: 'https://is1-ssl.mzstatic.com/i/1/100x100bb.jpg' },
      { trackId: 2, trackName: 'Evil', artistName: 'Nobody', previewUrl: 'https://evil.example/p.m4a', artworkUrl100: 'https://evil.example/a.jpg' },
      { trackId: 3, trackName: 'Bad art', artistName: 'Someone', previewUrl: 'https://a1.mzstatic.com/p/3.m4a', artworkUrl100: 'http://evil.example/a.jpg' },
      { trackId: 4, trackName: 'No preview', artistName: 'Someone' },
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ resultCount: results.length, results }));
  });
  await new Promise((r) => itunes.listen(0, r));
  srv = await startServer({ ITUNES_BASE_URL: `http://localhost:${itunes.address().port}` });
});
after(async () => { await srv.stop(); itunes.close(); });

describe('songs', () => {
  it('searches and keeps only Apple media, with the cover only when it is Apple’s too', async () => {
    const a = await register(srv, name('song'));
    const r = await srv.api('/api/songs?q=kesariya', undefined, a.token);
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.songs, [
      { id: '1', title: 'Kesariya', artist: 'Arijit Singh', src: 'https://audio-ssl.itunes.apple.com/p/1.m4a', art: 'https://is1-ssl.mzstatic.com/i/1/100x100bb.jpg' },
      { id: '3', title: 'Bad art', artist: 'Someone', src: 'https://a1.mzstatic.com/p/3.m4a' },
    ]);
    const url = new URL(calls.at(-1), 'http://x');
    assert.equal(url.pathname, '/search');
    assert.equal(url.searchParams.get('term'), 'kesariya');
    assert.equal(url.searchParams.get('entity'), 'song');
  });

  it('needs a sign-in, and an empty search asks Apple nothing', async () => {
    const a = await register(srv, name('song2'));
    const before = calls.length;
    assert.deepEqual((await srv.api('/api/songs?q=', undefined, a.token)).data, { songs: [] });
    assert.equal(calls.length, before);
    assert.equal((await srv.api('/api/songs?q=x')).status, 401);
  });

  it('lets Apple’s previews and covers through the security policy', async () => {
    const csp = (await fetch(srv.base + '/')).headers.get('content-security-policy');
    assert.match(csp, /media-src [^;]*https:\/\/audio-ssl\.itunes\.apple\.com/);
    assert.match(csp, /img-src [^;]*https:\/\/\*\.mzstatic\.com/);
  });
});

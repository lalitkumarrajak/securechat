// Drive's server side: sealed pieces of files, private to their owner, within a space limit; kept in
// the database, or in R2 (here a fake S3 store) when that's set up.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { C, name, register, sleep, startServer } from './helpers.js';
import { sign } from '../server/r2.js';

const piece = (n) => C.b64(crypto.getRandomValues(new Uint8Array(n)));

describe('request signing for R2', () => {
  it('matches AWS’s published Signature Version 4 examples', () => {
    const keys = { accessKey: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z') };
    const get = sign({ method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', headers: { Range: 'bytes=0-9' }, ...keys });
    assert.match(get.authorization, /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/);
    const put = sign({ method: 'PUT', url: 'https://examplebucket.s3.amazonaws.com/test%24file.text', body: 'Welcome to Amazon S3.',
      headers: { 'x-amz-storage-class': 'REDUCED_REDUNDANCY', Date: 'Fri, 24 May 2013 00:00:00 GMT' }, ...keys });
    assert.match(put.authorization, /Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd$/);
  });
});

describe('drive pieces in the database', () => {
  let srv;
  before(async () => { srv = await startServer({ DRIVE_MAX_BYTES: '3000', DRIVE_TOTAL_MAX_BYTES: '4000' }); });
  after(() => srv.stop());

  it('are kept per owner, counted against their space, and deleted with the file', async () => {
    const [a, b] = await Promise.all(['dra', 'drb'].map((n) => register(srv, name(n))));
    const file = C.randomId(12);
    const body = piece(900); // 1200 characters stored

    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=0`, { body }, a.token)).status, 200);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=1`, { body }, a.token)).status, 200);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=0`, undefined, a.token)).data.body, body);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=0`, undefined, b.token)).status, 404); // not b's
    assert.deepEqual((await srv.api('/api/drive/usage', undefined, a.token)).data, { used: 1800, max: 2250 }); // in bytes of the files
    assert.equal((await srv.api('/api/drive/usage', undefined, b.token)).data.used, 0);

    // Sending a piece again replaces it rather than counting twice; going over the limit is refused.
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=1`, { body }, a.token)).status, 200);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=2`, { body }, a.token)).status, 400);

    // Everyone together: b may use only what's left of the total (4000 - 2400 stored).
    assert.equal((await srv.api('/api/drive/usage', undefined, b.token)).data.max, 1200);
    const fb = C.randomId(12);
    assert.equal((await srv.api(`/api/drive/chunk?file=${fb}&i=0`, { body }, b.token)).status, 200);
    const full = await srv.api(`/api/drive/chunk?file=${fb}&i=1`, { body }, b.token);
    assert.equal(full.status, 400);
    assert.match(full.data.error, /full for now/);

    assert.equal((await srv.api(`/api/drive/chunk?file=bad&i=0`, { body }, a.token)).status, 400);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=-1`, { body }, a.token)).status, 400);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=0`, { body: 'not base64!' }, a.token)).status, 400);

    assert.equal((await srv.api('/api/drive/delete', { file }, a.token)).status, 200);
    assert.equal((await srv.api('/api/drive/usage', undefined, a.token)).data.used, 0);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=0`, undefined, a.token)).status, 404);
  });

  it('keeps file records as sealed items of app drive', async () => {
    const a = await register(srv, name('drc'));
    const id = C.randomId(12);
    const key = await C.appKey(a.priv, a.pub, 'drive');
    const rec = await C.encryptItem(key, { type: 'folder', name: 'Photos', parent: '' }, a.u, 'drive', id);
    assert.equal((await srv.api('/api/items?app=drive', { id, body: rec }, a.token)).status, 200);
    assert.equal((await srv.api('/api/items?app=drive&since=0', undefined, a.token)).data.items.length, 1);
  });
});

/** A stand-in for R2: keeps objects in memory and insists every request is signed. */
function fakeR2() {
  const objects = new Map();
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (!/^AWS4-HMAC-SHA256 Credential=test-key\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/.test(req.headers.authorization ?? '')) {
        res.writeHead(403); return res.end('unsigned');
      }
      const key = decodeURIComponent(req.url);
      if (req.method === 'PUT') { objects.set(key, Buffer.concat(chunks)); res.writeHead(200); return res.end(); }
      if (req.method === 'GET') { const o = objects.get(key); res.writeHead(o ? 200 : 404); return res.end(o); }
      if (req.method === 'DELETE') { objects.delete(key); res.writeHead(204); return res.end(); }
      res.writeHead(405); res.end();
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ objects, url: `http://localhost:${server.address().port}`, close: () => server.close() })));
}

describe('drive pieces in R2', () => {
  let store, dataDir;
  before(async () => { store = await fakeR2(); dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-r2-')); });
  after(() => { store.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const r2env = () => ({ DATA_DIR: dataDir, R2_ENDPOINT: store.url, R2_BUCKET: 'sanga', R2_ACCESS_KEY_ID: 'test-key', R2_SECRET_ACCESS_KEY: 'test-secret' });

  it('moves what was in the database to R2, then keeps new pieces there as bytes', async () => {
    // Before R2: a file in the database.
    let srv = await startServer({ DATA_DIR: dataDir });
    const a = await register(srv, name('drr'));
    const old = C.randomId(12), oldBody = piece(600);
    assert.equal((await srv.api(`/api/drive/chunk?file=${old}&i=0`, { body: oldBody }, a.token)).status, 200);
    await srv.stop();

    // R2 set up: it moves over by itself, and still opens.
    srv = await startServer(r2env());
    for (let i = 0; i < 50 && !store.objects.size; i++) await sleep(100);
    assert.deepEqual(store.objects.get(`/sanga/drive/${a.u}/${old}/0`), Buffer.from(oldBody, 'base64'));
    assert.equal((await srv.api(`/api/drive/chunk?file=${old}&i=0`, undefined, a.token)).data.body, oldBody);

    // New pieces go straight to R2, stored as their bytes; usage counts those.
    const f = C.randomId(12), body = piece(1000);
    assert.equal((await srv.api(`/api/drive/chunk?file=${f}&i=0`, { body }, a.token)).status, 200);
    assert.equal(store.objects.get(`/sanga/drive/${a.u}/${f}/0`).length, 1000);
    assert.equal((await srv.api(`/api/drive/chunk?file=${f}&i=0`, undefined, a.token)).data.body, body);
    assert.equal((await srv.api('/api/drive/usage', undefined, a.token)).data.used, 1600);

    // Deleting a file deletes its objects too.
    assert.equal((await srv.api('/api/drive/delete', { file: f }, a.token)).status, 200);
    assert.equal(store.objects.has(`/sanga/drive/${a.u}/${f}/0`), false);
    assert.equal((await srv.api('/api/drive/usage', undefined, a.token)).data.used, 600);
    await srv.stop();
  });
});

/** A stand-in for Google: the token endpoint and the few Drive calls Sanga makes. The first upload fails
 *  once (Google busy), to check Sanga tries again. */
function fakeGoogle() {
  const files = new Map(); // id -> { name, parents, data }
  let tokens = 0, nextId = 0, busyOnce = true;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const u = new URL(req.url, 'http://x');
      const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (u.pathname === '/token') {
        const f = new URLSearchParams(body.toString());
        if (f.get('refresh_token') !== 'test-refresh' || f.get('grant_type') !== 'refresh_token') return json(400, { error: 'invalid_grant' });
        tokens++;
        return json(200, { access_token: 'test-access', expires_in: 3600 });
      }
      if (req.headers.authorization !== 'Bearer test-access') return json(401, { error: 'unauthorized' });
      if (u.pathname === '/drive/v3/files' && req.method === 'GET') {
        const name = /name = '([^']+)'/.exec(u.searchParams.get('q'))?.[1];
        return json(200, { files: [...files].filter(([, f]) => f.folder && f.name === name).map(([id]) => ({ id })) });
      }
      if (u.pathname === '/drive/v3/files' && req.method === 'POST') {
        const id = 'folder' + ++nextId;
        files.set(id, { ...JSON.parse(body), folder: true });
        return json(200, { id });
      }
      if (u.pathname === '/upload/drive/v3/files' && req.method === 'POST') {
        if (busyOnce) { busyOnce = false; return json(503, { error: 'backendError' }); }
        const boundary = /boundary=(\S+)/.exec(req.headers['content-type'])[1];
        const metaStart = body.indexOf('\r\n\r\n') + 4;
        const meta = JSON.parse(body.subarray(metaStart, body.indexOf(`\r\n--${boundary}`, metaStart)).toString());
        const dataStart = body.indexOf('\r\n\r\n', body.indexOf('application/octet-stream')) + 4;
        const data = body.subarray(dataStart, body.lastIndexOf(`\r\n--${boundary}--`));
        const id = 'f' + ++nextId;
        files.set(id, { name: meta.name, parents: meta.parents, data: Buffer.from(data) });
        return json(200, { id });
      }
      const m = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
      if (m && req.method === 'GET' && u.searchParams.get('alt') === 'media') {
        const f = files.get(m[1]);
        if (!f) return json(404, { error: 'notFound' });
        res.writeHead(200); return res.end(f.data);
      }
      if (m && req.method === 'DELETE') { const had = files.delete(m[1]); res.writeHead(had ? 204 : 404); return res.end(); }
      json(404, { error: 'unknown call' });
    });
  });
  return new Promise((resolve) => server.listen(0, () => {
    const url = `http://localhost:${server.address().port}`;
    resolve({ files, url, get tokens() { return tokens; }, close: () => server.close() });
  }));
}

describe('drive pieces in Google Drive', () => {
  let google, dataDir;
  before(async () => { google = await fakeGoogle(); dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-gd-')); });
  after(() => { google.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const gdEnv = () => ({
    DATA_DIR: dataDir, GDRIVE_CLIENT_ID: 'id', GDRIVE_CLIENT_SECRET: 'secret', GDRIVE_REFRESH_TOKEN: 'test-refresh',
    GDRIVE_TOKEN_URL: google.url + '/token', GDRIVE_API_URL: google.url + '/drive/v3', GDRIVE_UPLOAD_URL: google.url + '/upload/drive/v3',
  });
  const pieces = () => [...google.files.values()].filter((f) => !f.folder);

  it('keeps pieces as files in a "Sanga Drive" folder, moves old ones over, replaces and deletes them', async () => {
    let srv = await startServer({ DATA_DIR: dataDir });
    const a = await register(srv, name('drg'));
    const old = C.randomId(12), oldBody = piece(500);
    assert.equal((await srv.api(`/api/drive/chunk?file=${old}&i=0`, { body: oldBody }, a.token)).status, 200);
    await srv.stop();

    srv = await startServer(gdEnv());
    for (let i = 0; i < 50 && !pieces().length; i++) await sleep(100);
    const folder = [...google.files].find(([, f]) => f.folder);
    assert.equal(folder[1].name, 'Sanga Drive');
    assert.deepEqual(pieces()[0].parents, [folder[0]]);
    assert.deepEqual(pieces()[0].data, Buffer.from(oldBody, 'base64')); // stored as bytes, after Google's hiccup
    assert.equal((await srv.api(`/api/drive/chunk?file=${old}&i=0`, undefined, a.token)).data.body, oldBody);

    const f = C.randomId(12), body = piece(1000), again = piece(1000);
    assert.equal((await srv.api(`/api/drive/chunk?file=${f}&i=0`, { body }, a.token)).status, 200);
    assert.equal((await srv.api(`/api/drive/chunk?file=${f}&i=0`, { body: again }, a.token)).status, 200); // sent again: replaces
    assert.equal(pieces().length, 2);
    assert.equal((await srv.api(`/api/drive/chunk?file=${f}&i=0`, undefined, a.token)).data.body, again);
    assert.deepEqual((await srv.api('/api/drive/usage', undefined, a.token)).data, { used: 1500, max: 50e9 });

    assert.equal((await srv.api('/api/drive/delete', { file: f }, a.token)).status, 200);
    assert.equal(pieces().length, 1);
    assert.equal(google.tokens, 1); // one sign-in, reused
    await srv.stop();
  });
});

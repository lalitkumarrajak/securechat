// Drive's server side: sealed pieces of files, private to their owner, within a space limit; kept in
// the database, or in R2 (here a fake S3 store) when that's set up.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { befriend, C, connect, name, register, sleep, startServer } from './helpers.js';
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
        const q = u.searchParams.get('q');
        const name = /name = '([^']+)'/.exec(q)?.[1], parent = /'([^']+)' in parents/.exec(q)?.[1];
        const folders = !q.includes("mimeType != 'application/vnd.google-apps.folder'");
        return json(200, { files: [...files].filter(([, f]) => !!f.folder === folders && (!name || f.name === name) && (!parent || f.parents?.includes(parent))).map(([id, f]) => ({ id, name: f.name })) });
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
      if (m && req.method === 'PATCH') {
        const f = files.get(m[1]);
        if (!f) return json(404, { error: 'notFound' });
        f.parents = [...f.parents.filter((p) => p !== u.searchParams.get('removeParents')), u.searchParams.get('addParents')];
        return json(200, { id: m[1] });
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

  it('keeps pieces as files in "Sanga Drive/<username>", moves old ones over, replaces and deletes them', async () => {
    let srv = await startServer({ DATA_DIR: dataDir });
    const a = await register(srv, name('drg'));
    const old = C.randomId(12), oldBody = piece(500);
    assert.equal((await srv.api(`/api/drive/chunk?file=${old}&i=0`, { body: oldBody }, a.token)).status, 200);
    await srv.stop();
    // From before there was a folder per person: a piece loose in "Sanga Drive".
    google.files.set('root0', { name: 'Sanga Drive', folder: true });
    google.files.set('loose0', { name: `${a.u}-${C.randomId(12)}-0`, parents: ['root0'], data: Buffer.from('x') });

    srv = await startServer(gdEnv());
    const mine = () => [...google.files].find(([, f]) => f.folder && f.name === a.u);
    for (let i = 0; i < 50 && !(pieces().length === 2 && pieces().every((p) => p.parents[0] === mine()?.[0])); i++) await sleep(100);
    assert.equal([...google.files.values()].filter((f) => f.folder && f.name === 'Sanga Drive').length, 1);
    assert.deepEqual(mine()[1].parents, ['root0']);
    for (const p of pieces()) assert.deepEqual(p.parents, [mine()[0]]); // the old one too
    const moved = pieces().find((p) => p.name === `${old}-0`);
    assert.deepEqual(moved.data, Buffer.from(oldBody, 'base64')); // stored as bytes, after Google's hiccup
    google.files.delete('loose0');
    assert.equal((await srv.api(`/api/drive/chunk?file=${old}&i=0`, undefined, a.token)).data.body, oldBody);

    const f = C.randomId(12), body = piece(1000), again = piece(1000);
    assert.equal((await srv.api(`/api/drive/chunk?file=${f}&i=0`, { body }, a.token)).status, 200);
    assert.equal((await srv.api(`/api/drive/chunk?file=${f}&i=0`, { body: again }, a.token)).status, 200); // sent again: replaces
    assert.equal(pieces().length, 2);
    assert.equal((await srv.api(`/api/drive/chunk?file=${f}&i=0`, undefined, a.token)).data.body, again);
    assert.deepEqual((await srv.api('/api/drive/usage', undefined, a.token)).data, { used: 1500, max: 50 * 1024 ** 3 });

    assert.equal((await srv.api('/api/drive/delete', { file: f }, a.token)).status, 200);
    assert.equal(pieces().length, 1);
    assert.equal(google.tokens, 1); // one sign-in, reused
    await srv.stop();
  });

  it('npm run google-drive-check goes through every step the server needs', async () => {
    const lines = [];
    const { checkDrive } = await import('../scripts/google-drive-check.mjs');
    await checkDrive({ ...gdEnv(), DATA_DIR: undefined }, (l) => lines.push(l));
    assert.equal(lines.filter((l) => l.includes('✔')).length, 4);
    await assert.rejects(checkDrive({ ...gdEnv(), GDRIVE_REFRESH_TOKEN: 'wrong' }, () => {}), /Google sign-in failed \(invalid_grant\)/);
  });
});

describe('drive shares', () => {
  let srv;
  before(async () => { srv = await startServer(); });
  after(() => srv.stop());

  it('open by link without signing in, only for the files listed, and go to friends picked', async () => {
    const [a, b, c] = await Promise.all(['dsa', 'dsb', 'dsc'].map((n) => register(srv, name(n))));
    await befriend(srv, a, b);
    const f1 = C.randomId(12), f2 = C.randomId(12), body = piece(300);
    for (const f of [f1, f2]) assert.equal((await srv.api(`/api/drive/chunk?file=${f}&i=0`, { body }, a.token)).status, 200);
    const id = C.randomId(16), box = piece(200);

    assert.equal((await srv.api('/api/drive/link', { id, box, files: [f1] }, a.token)).status, 200);
    // Anyone with the link: the sealed list, and the listed file's pieces, without signing in.
    assert.equal((await srv.api(`/api/drive/public?id=${id}`)).data.box, box);
    assert.equal((await srv.api(`/api/drive/public/chunk?id=${id}&file=${f1}&i=0`)).data.body, body);
    assert.equal((await srv.api(`/api/drive/public/chunk?id=${id}&file=${f2}&i=0`)).status, 404); // not in this share
    assert.equal((await srv.api(`/api/drive/public?id=${C.randomId(16)}`)).status, 404);
    // Someone else can't take it over or change who it goes to.
    assert.equal((await srv.api('/api/drive/link', { id, box: piece(10), files: [] }, b.token)).status, 404);
    assert.equal((await srv.api('/api/drive/link/to', { id, add: [{ u: c.u, wrapped: piece(60) }] }, b.token)).status, 404);

    // To friends only: b gets it (and is told), c (not a friend) doesn't.
    const live = await connect(srv, b.token);
    const wrapped = piece(60);
    assert.equal((await srv.api('/api/drive/link/to', { id, add: [{ u: b.u, wrapped }, { u: c.u, wrapped }] }, a.token)).status, 200);
    assert.equal((await live.next('drive')).from, a.u);
    assert.deepEqual((await srv.api('/api/drive/shared', undefined, b.token)).data.shares.map((x) => [x.id, x.owner, x.wrapped]), [[id, a.u, wrapped]]);
    assert.equal((await srv.api('/api/drive/shared', undefined, c.token)).data.shares.length, 0);

    // Taken off: gone from b's list. Stopped: the link stops working.
    assert.equal((await srv.api('/api/drive/link/to', { id, remove: [b.u] }, a.token)).status, 200);
    assert.equal((await srv.api('/api/drive/shared', undefined, b.token)).data.shares.length, 0);
    assert.equal((await srv.api('/api/drive/link/delete', { id }, a.token)).status, 200);
    assert.equal((await srv.api(`/api/drive/public?id=${id}`)).status, 404);
    assert.equal((await srv.api(`/api/drive/public/chunk?id=${id}&file=${f1}&i=0`)).status, 404);
    live.close();
  });
});

// End-to-end test: starts a throwaway server, registers two users with the real client
// crypto, exchanges an encrypted message and checks receipts, sync and auth rules.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import * as C from '../public/crypto.js';

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'securechat-test-'));
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT, DATA_DIR: dataDir, ALLOW_SIGNUP: '1' }, stdio: 'pipe' });
const cleanup = () => { server.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); };

const post = (p, body, token) => fetch(BASE + p, {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
});

async function register(u, pw) {
  const { auth, wrapKey } = await C.deriveFromPassword(u, pw);
  const id = await C.generateIdentity(wrapKey);
  const res = await post('/api/register', { u, auth, pub: id.pub, encPriv: id.encPriv });
  assert.equal(res.status, 200, await res.clone().text());
  return { u, ...id, token: (await res.json()).token };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    const queue = [];
    const waiters = [];
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      const i = waiters.findIndex((w) => w.t === m.t);
      if (i >= 0) waiters.splice(i, 1)[0].resolve(m); else queue.push(m);
    });
    ws.next = (t) => {
      const i = queue.findIndex((m) => m.t === t);
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((res, rej) => {
        waiters.push({ t, resolve: res });
        setTimeout(() => rej(new Error('timeout waiting for ' + t)), 5000);
      });
    };
    ws.sendJson = (o) => ws.send(JSON.stringify(o));
    ws.on('open', async () => {
      ws.sendJson({ t: 'auth', token });
      try { await ws.next('ok'); resolve(ws); } catch (e) { reject(e); }
    });
    ws.on('error', reject);
  });
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('server did not start');
}

try {
  await waitForServer();

  const page = await fetch(BASE + '/', { headers: { 'Accept-Encoding': 'br' } });
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(page.headers.get('content-encoding'), 'br');
  console.log('✓ static files served compressed with security headers');

  const alice = await register('alice', 'correct horse battery');
  const bob = await register('bob', 'hunter2hunter2');
  assert.equal((await post('/api/register', { u: 'alice', auth: 'x'.repeat(43) + '=', pub: alice.pub, encPriv: 'AAAA' })).status, 409);
  console.log('✓ registration (duplicate usernames rejected)');

  // Sign in on a "new device": derive keys from password, unwrap the private key backup.
  const { auth, wrapKey } = await C.deriveFromPassword('alice', 'correct horse battery');
  const login = await (await post('/api/login', { u: 'alice', auth })).json();
  const alicePriv2 = await C.unwrapIdentity(login.encPriv, wrapKey);
  const bad = await C.deriveFromPassword('alice', 'wrong password!');
  assert.equal((await post('/api/login', { u: 'alice', auth: bad.auth })).status, 401);
  console.log('✓ sign in with username + password; wrong password rejected');

  const search = await (await fetch(BASE + '/api/users?q=bo', { headers: { Authorization: 'Bearer ' + alice.token } })).json();
  assert.deepEqual(search.users.map((u) => u.u), ['bob']);
  assert.equal((await fetch(BASE + '/api/users?q=bo')).status, 401);
  console.log('✓ user search requires auth');

  const wsA = await connect(alice.token);
  const wsB = await connect(bob.token);

  const keyA = await C.conversationKey(alice.priv, bob.pub, 'alice', 'bob');
  const cid = C.randomId();
  const b = await C.encryptMessage(keyA, { type: 'text', text: 'hi bob 👋' }, 'alice', 'bob', cid);
  wsA.sendJson({ t: 'msg', cid, to: 'bob', b });
  const ack = await wsA.next('ack');
  wsA.sendJson({ t: 'msg', cid, to: 'bob', b }); // retransmit must not duplicate
  const ack2 = await wsA.next('ack');
  assert.equal(ack.id, ack2.id);

  const recv = await wsB.next('m');
  assert.equal(recv.f, 'alice');
  assert.ok(!recv.b.includes('hi bob'), 'server must only see ciphertext');
  const keyB = await C.conversationKey(bob.priv, alice.pub, 'bob', 'alice');
  assert.deepEqual(await C.decryptMessage(keyB, recv.b, 'alice', 'bob', cid), { type: 'text', text: 'hi bob 👋' });
  await assert.rejects(C.decryptMessage(keyB, recv.b, 'bob', 'alice', cid)); // tampered metadata fails
  console.log('✓ encrypted message delivered, decrypted, and de-duplicated');

  // Key restored on the new device decrypts too.
  const keyA2 = await C.conversationKey(alicePriv2, bob.pub, 'alice', 'bob');
  assert.equal((await C.decryptMessage(keyA2, recv.b, 'alice', 'bob', cid)).text, 'hi bob 👋');
  console.log('✓ restored identity key works across devices');

  wsB.sendJson({ t: 'rcpt', ids: [recv.id], s: 2 });
  const st = await wsA.next('st');
  assert.equal(st.items[0].s, 2);
  console.log('✓ read receipts');

  const wsB2 = await connect(bob.token);
  wsB2.sendJson({ t: 'sync', after: 0 });
  const batch = await wsB2.next('batch');
  assert.equal(batch.msgs.length, 1);
  assert.equal(batch.msgs[0].s, 2);
  console.log('✓ offline sync returns history with latest status');

  const n1 = await C.safetyNumber('alice', alice.pub, 'bob', bob.pub);
  const n2 = await C.safetyNumber('bob', bob.pub, 'alice', alice.pub);
  assert.deepEqual(n1, n2);
  console.log('✓ security codes match on both sides:', n1.join(' '));

  const evil = new WebSocket(`ws://localhost:${PORT}/ws`);
  const code = await new Promise((r) => { evil.on('open', () => evil.send(JSON.stringify({ t: 'auth', token: 'nope' }))); evil.on('close', r); });
  assert.equal(code, 4001);
  console.log('✓ invalid WebSocket token rejected');

  [wsA, wsB, wsB2].forEach((w) => w.close());
  console.log('\nAll tests passed');
} catch (err) {
  console.error('✗', err);
  process.exitCode = 1;
} finally {
  cleanup();
}

// Push notifications against a fake push service (HTTPS with a throwaway self-signed certificate).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { befriend, connect, name, register, sendText, sleep, startServer } from './helpers.js';

let srv, push, pushPort;
const hits = [];

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chattrix-push-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-days', '1',
    '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-subj', '/CN=localhost'], { stdio: 'ignore' });
  push = https.createServer({ key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) }, (req, res) => {
    let size = 0;
    req.on('data', (c) => { size += c.length; });
    req.on('end', () => {
      hits.push({ path: req.url, auth: req.headers.authorization, encoding: req.headers['content-encoding'], size });
      res.writeHead(req.url.includes('gone') ? 410 : 201).end();
    });
  });
  await new Promise((r) => push.listen(0, r));
  pushPort = push.address().port;
  srv = await startServer({ PUSH_ALLOW_ANY_HOST: '1', NODE_TLS_REJECT_UNAUTHORIZED: '0' });
});
after(async () => { await srv.stop(); push.close(); });

// A valid browser-style subscription: P-256 public key + 16-byte auth secret.
function subscription(id) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    endpoint: `https://localhost:${pushPort}/push/${id}`,
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') },
  };
}
const waitHits = async (n, ms = 3000) => { for (let t = 0; t < ms && hits.length < n; t += 50) await sleep(50); };

describe('push notifications', () => {
  let a, b, wa;
  before(async () => {
    [a, b] = await Promise.all([register(srv, name('xa')), register(srv, name('xb'))]);
    await befriend(srv, a, b);
    wa = await connect(srv, a.token);
  });
  after(() => wa.close());

  it('rejects endpoints that are not https', async () => {
    const sub = subscription('x');
    sub.endpoint = sub.endpoint.replace('https:', 'http:');
    assert.equal((await srv.api('/api/push/subscribe', { sub }, b.token)).status, 400);
  });

  it('pushes an encrypted, content-free notification when the recipient is offline', async () => {
    assert.equal((await srv.api('/api/push/subscribe', { sub: subscription('b1') }, b.token)).status, 200);
    assert.ok((await srv.api('/api/push/key', undefined, b.token)).data.key);
    hits.length = 0;
    await sendText(wa, a, b, 'are you there?');
    await waitHits(1);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].path, '/push/b1');
    assert.match(hits[0].auth, /^vapid t=/);
    assert.equal(hits[0].encoding, 'aes128gcm'); // payload encrypted for the browser
  });

  it('coalesces a burst into one notification', async () => {
    await sleep(4100);
    hits.length = 0;
    for (let i = 0; i < 3; i++) await sendText(wa, a, b, 'burst ' + i);
    await waitHits(2, 800);
    assert.equal(hits.length, 1);
  });

  it('does not push for quiet messages (reactions, edits), active recipients or muted chats', async () => {
    await sleep(4100);
    hits.length = 0;
    const key = { t: 'msg', cid: 'quietquiet1', to: b.u, b: 'AAAA', q: 1 };
    wa.sendJson(key);
    await wa.next('ack');
    await sleep(300);
    assert.equal(hits.length, 0, 'quiet message');

    const wb = await connect(srv, b.token);
    await sendText(wa, a, b, 'you are online');
    await sleep(300);
    assert.equal(hits.length, 0, 'recipient active');
    wb.close();
    await sleep(200);

    await srv.api('/api/mute', { u: a.u, until: -1 }, b.token);
    await sendText(wa, a, b, 'muted chat');
    await sleep(300);
    assert.equal(hits.length, 0, 'muted');
    await srv.api('/api/mute', { u: a.u, until: 0 }, b.token);
  });

  it('an endpoint stays with its account: others can neither take it over nor remove it', async () => {
    const [p, q] = await Promise.all([register(srv, name('xp')), register(srv, name('xq'))]);
    await befriend(srv, a, p);
    const sub = subscription('p1');
    assert.equal((await srv.api('/api/push/subscribe', { sub }, p.token)).status, 200);
    assert.equal((await srv.api('/api/push/subscribe', { sub }, p.token)).status, 200); // again, e.g. new keys
    assert.equal((await srv.api('/api/push/subscribe', { sub: subscription('p1') }, q.token)).status, 409);
    assert.equal((await srv.api('/api/push/unsubscribe', { endpoint: sub.endpoint }, q.token)).status, 200);
    await sleep(4100);
    hits.length = 0;
    await sendText(wa, a, p, 'still yours');
    await waitHits(1);
    assert.deepEqual(hits.map((h) => h.path), ['/push/p1']); // p still gets it
    // p's own unsubscribe removes it.
    assert.equal((await srv.api('/api/push/unsubscribe', { endpoint: sub.endpoint }, p.token)).status, 200);
    assert.equal((await srv.api('/api/push/subscribe', { sub: subscription('p1') }, q.token)).status, 200);
  });

  it('notifies about friend requests and drops expired subscriptions', async () => {
    const c = await register(srv, name('xc'));
    await srv.api('/api/push/subscribe', { sub: subscription('gone') }, c.token);
    hits.length = 0;
    await srv.api('/api/friends/request', { u: c.u }, a.token);
    await waitHits(1);
    assert.equal(hits[0].path, '/push/gone');
    // The fake service answered 410 Gone, so the subscription was deleted: no second attempt.
    await srv.api('/api/friends/decline', { u: a.u }, c.token);
    await sleep(4100);
    hits.length = 0;
    await srv.api('/api/friends/request', { u: c.u }, a.token);
    await sleep(400);
    assert.equal(hits.length, 0);
  });
});

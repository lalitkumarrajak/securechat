// Server integration tests. Run with: npm test (SQLite), or with MONGODB_URI / DATABASE_URL set.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { C, befriend, connect, decrypt, name, register, sendText, sleep, startServer } from './helpers.js';

let srv;
before(async () => {
  srv = await startServer({ DELETE_WINDOW_MS: '1500', PRESENCE_TIMEOUT_MS: '1200', PRESENCE_SWEEP_MS: '200' });
});
after(() => srv.stop());

describe('basics', () => {
  it('serves the web app compressed with strict security headers', async () => {
    const page = await fetch(srv.base + '/', { headers: { 'Accept-Encoding': 'br' } });
    assert.equal(page.status, 200);
    const csp = page.headers.get('content-security-policy');
    assert.match(csp, /script-src 'self' 'wasm-unsafe-eval';/); // WebAssembly only (HEIC photos), never JS eval
    assert.doesNotMatch(csp, /'unsafe-eval'/);
    assert.equal(page.headers.get('content-encoding'), 'br');
    assert.equal(page.headers.get('cache-control'), 'no-cache');
    const asset = await fetch(srv.base + '/assets/app-abc123.js');
    assert.match(asset.headers.get('cache-control'), /immutable/);
    assert.match(page.headers.get('permissions-policy'), /microphone=\(self\)/);
  });

  it('registers, rejects duplicates, signs in and rejects wrong passwords', async () => {
    const u = name('reg');
    const a = await register(srv, u, 'correct horse battery');
    assert.equal((await srv.api('/api/register', { u, auth: 'x'.repeat(43) + '=', pub: a.pub, encPriv: 'AAAA' })).status, 409);
    const { auth, wrapKey } = await C.deriveFromPassword(u, 'correct horse battery');
    const login = await srv.api('/api/login', { u, auth });
    assert.equal(login.status, 200);
    await C.unwrapIdentity(login.data.encPriv, wrapKey); // key backup unlocks
    const bad = await C.deriveFromPassword(u, 'wrong password!');
    assert.equal((await srv.api('/api/login', { u, auth: bad.auth })).status, 401);
  });

  it('sign-up is open by default and can be closed with ALLOW_SIGNUP=0', async () => {
    assert.equal((await srv.api('/api/config')).data.signup, true);
    const closed = await startServer({ ALLOW_SIGNUP: '0' });
    try {
      assert.equal((await closed.api('/api/config')).data.signup, false);
      assert.equal((await closed.api('/api/register', {})).status, 403);
    } finally { await closed.stop(); }
  });

  it('relays animated emoji and rejects bad paths', async () => {
    assert.equal((await fetch(srv.base + '/emoji/..%2fsecret.json')).status, 404);
    const emoji = await fetch(srv.base + '/emoji/1f600.json');
    if (emoji.status === 502) return; // no internet
    assert.equal(emoji.status, 200);
    assert.ok((await emoji.json()).layers);
  });
});

describe('friends', () => {
  let a, b, c, wa, wb;
  before(async () => {
    [a, b, c] = await Promise.all([register(srv, name('fa')), register(srv, name('fb')), register(srv, name('fc'))]);
    wa = await connect(srv, a.token);
    wb = await connect(srv, b.token);
  });
  after(() => { wa.close(); wb.close(); });

  it('blocks messaging, keys, presence and typing between non-friends', async () => {
    const r = await sendText(wa, a, b, 'hello stranger');
    assert.equal(r.t, 'err');
    assert.equal(r.e, 'not-friends');
    assert.equal((await srv.api('/api/key?u=' + b.u, undefined, a.token)).status, 404);
    wa.sendJson({ t: 'watch', u: b.u });
    assert.equal(await wa.gets('pres', (m) => m.u === b.u), false);
    wa.sendJson({ t: 'typ', to: b.u });
    assert.equal(await wb.gets('typ'), false);
    assert.equal((await srv.api('/api/avatar?u=' + b.u, undefined, a.token)).status, 404);
  });

  it('search shows strangers without profile details', async () => {
    const { data } = await srv.api('/api/users?q=' + b.u.slice(0, 4), undefined, a.token);
    const hit = data.users.find((x) => x.u === b.u);
    assert.equal(hit.rel, 'none');
    assert.equal(hit.pub, undefined);
  });

  it('request → live event → accept → friends can chat', async () => {
    assert.equal((await srv.api('/api/friends/request', { u: b.u }, a.token)).data.rel, 'out');
    await wb.next('fr', (m) => m.u === a.u && m.req === 1);
    const bf = (await srv.api('/api/friends', undefined, b.token)).data;
    assert.deepEqual(bf.incoming.map((x) => x.u), [a.u]);
    const af = (await srv.api('/api/friends', undefined, a.token)).data;
    assert.deepEqual(af.outgoing.map((x) => x.u), [b.u]);

    assert.equal((await srv.api('/api/friends/accept', { u: b.u }, a.token)).status, 404); // can't accept your own
    assert.equal((await srv.api('/api/friends/accept', { u: a.u }, b.token)).data.rel, 'friends');
    await wa.next('fr', (m) => m.u === b.u);
    const friends = (await srv.api('/api/friends', undefined, a.token)).data.friends;
    assert.equal(friends[0].u, b.u);
    assert.equal(friends[0].pub, b.pub);

    const r = await sendText(wa, a, b, 'hi friend');
    assert.equal(r.t, 'ack');
    const m = await wb.next('m', (x) => x.cid === r.cid);
    assert.equal((await decrypt(b, a, m)).text, 'hi friend');
    assert.equal((await srv.api('/api/key?u=' + b.u, undefined, a.token)).data.pub, b.pub);
  });

  it('a mutual request is accepted automatically; decline removes a request', async () => {
    await srv.api('/api/friends/request', { u: c.u }, a.token);
    assert.equal((await srv.api('/api/friends/decline', { u: a.u }, c.token)).data.rel, 'none');
    assert.equal((await srv.api('/api/friends', undefined, a.token)).data.outgoing.length, 0);
    await srv.api('/api/friends/request', { u: a.u }, c.token);
    assert.equal((await srv.api('/api/friends/request', { u: c.u }, a.token)).data.rel, 'friends');
  });

  it('block stops all contact and hides you from their search; unblock restores', async () => {
    assert.equal((await srv.api('/api/friends/block', { u: a.u }, b.token)).data.rel, 'blocked');
    assert.equal((await sendText(wa, a, b, 'are you there?')).e, 'not-friends');
    assert.equal((await sendText(wb, b, a, 'blocked side')).e, 'not-friends');
    const search = (await srv.api('/api/users?q=' + b.u.slice(0, 4), undefined, a.token)).data.users;
    assert.equal(search.some((x) => x.u === b.u), false);
    assert.deepEqual((await srv.api('/api/friends', undefined, b.token)).data.blocked, [a.u]);
    assert.equal((await srv.api('/api/friends/request', { u: b.u }, a.token)).status, 403);

    await srv.api('/api/friends/unblock', { u: a.u }, b.token);
    assert.equal((await sendText(wa, a, b, 'back again')).t, 'ack');
  });

  it('unfriending stops messaging', async () => {
    await srv.api('/api/friends/remove', { u: c.u }, a.token);
    const wc = await connect(srv, c.token);
    assert.equal((await sendText(wc, c, a, 'still friends?')).e, 'not-friends');
    wc.close();
  });
});

describe('messages', () => {
  let a, b, wa, wb;
  before(async () => {
    [a, b] = await Promise.all([register(srv, name('ma')), register(srv, name('mb'))]);
    await befriend(srv, a, b);
    wa = await connect(srv, a.token);
    wb = await connect(srv, b.token);
  });
  after(() => { wa.close(); wb.close(); });

  it('delivers once, acks retransmits with the same id, and reports receipts', async () => {
    const key = await C.conversationKey(a.priv, b.pub, a.u, b.u);
    const cid = C.randomId();
    const body = await C.encryptMessage(key, { type: 'text', text: 'hi 👋' }, a.u, b.u, cid);
    wa.sendJson({ t: 'msg', cid, to: b.u, b: body });
    const ack = await wa.next('ack');
    wa.sendJson({ t: 'msg', cid, to: b.u, b: body });
    assert.equal((await wa.next('ack')).id, ack.id);
    const recv = await wb.next('m');
    assert.equal(await wb.gets('m', (m) => m.cid === cid), false); // no duplicate
    wb.sendJson({ t: 'rcpt', ids: [recv.id], s: 2 });
    assert.equal((await wa.next('st')).items[0].s, 2);
  });

  it('offline sync returns history with latest status', async () => {
    const wb2 = await connect(srv, b.token);
    wb2.sendJson({ t: 'sync', after: 0 });
    const batch = await wb2.next('batch');
    assert.ok(batch.msgs.length >= 1);
    assert.equal(batch.msgs[0].s, 2);
    wb2.close();
  });

  it('delete for everyone works within the time limit and is synced', async () => {
    const r = await sendText(wa, a, b, 'oops');
    const recv = await wb.next('m', (m) => m.cid === r.cid);
    assert.equal((await srv.api('/api/me', undefined, a.token)).status, 200);
    wb.sendJson({ t: 'del', ids: [recv.id] }); // not mine: refused
    assert.deepEqual((await wb.next('delr')).failed, [recv.id]);
    wa.sendJson({ t: 'del', ids: [r.id] });
    assert.deepEqual((await wa.next('delr')).ok, [r.id]);
    const gone = await wb.next('gone');
    assert.equal(gone.items[0].id, r.id);
    // A device that was offline gets the deletion via sync: same message, empty body.
    const wb2 = await connect(srv, b.token);
    wb2.sendJson({ t: 'sync', after: recv.seq });
    const row = (await wb2.next('batch')).msgs.find((m) => m.id === r.id);
    assert.equal(row.b, '');
    wb2.close();
  });

  it('delete for everyone is refused after the time limit', async () => {
    const r = await sendText(wa, a, b, 'too late to delete');
    await wb.next('m', (m) => m.cid === r.cid);
    await sleep(1700); // DELETE_WINDOW_MS is 1500 in this server
    wa.sendJson({ t: 'del', ids: [r.id] });
    const res = await wa.next('delr');
    assert.deepEqual(res.failed, [r.id]);
    assert.equal(await wb.gets('gone'), false);
  });

  it('delete for me hides it on my devices only', async () => {
    const r = await sendText(wa, a, b, 'just for me to forget');
    await wb.next('m', (m) => m.cid === r.cid);
    const wa2 = await connect(srv, a.token);
    wa.sendJson({ t: 'hide', ids: [r.id] });
    const hid = await wa2.next('hid');
    assert.deepEqual(hid.ids, [r.id]);
    // Sync skips it for me…
    wa2.sendJson({ t: 'sync', after: 0 });
    let all = [];
    for (;;) {
      const batch = await wa2.next('batch');
      all = all.concat(batch.msgs);
      if (!batch.more) break;
      wa2.sendJson({ t: 'sync', after: all.at(-1).seq });
    }
    assert.equal(all.some((m) => m.id === r.id), false);
    // …catch-up for a device that missed the live event…
    wa2.sendJson({ t: 'hidden', since: 0 });
    assert.ok((await wa2.next('hid')).ids.includes(r.id));
    // …and the other person still has it.
    const wb2 = await connect(srv, b.token);
    wb2.sendJson({ t: 'sync', after: 0 });
    let found = false;
    for (;;) {
      const batch = await wb2.next('batch');
      if (batch.msgs.some((m) => m.id === r.id)) found = true;
      if (!batch.more) break;
      wb2.sendJson({ t: 'sync', after: batch.msgs.at(-1).seq });
    }
    assert.ok(found);
    wa2.close(); wb2.close();
  });

  it('turning read receipts off hides blue ticks both ways', async () => {
    await srv.api('/api/profile', { privacy: { receipts: false } }, b.token);
    const r = await sendText(wa, a, b, 'did you read this?');
    const recv = await wb.next('m', (m) => m.cid === r.cid);
    wb.sendJson({ t: 'rcpt', ids: [recv.id], s: 2 });
    assert.equal((await wa.next('st')).items[0].s, 1); // shows as delivered, not read
    await srv.api('/api/profile', { privacy: { receipts: true } }, b.token);
  });
});

describe('presence', () => {
  let a, b, wa;
  before(async () => {
    [a, b] = await Promise.all([register(srv, name('pa')), register(srv, name('pb'))]);
    await befriend(srv, a, b);
    wa = await connect(srv, a.token);
  });
  after(() => wa.close());

  it('goes offline when the tab is hidden and back online when visible', async () => {
    const wb = await connect(srv, b.token);
    wa.sendJson({ t: 'watch', u: b.u });
    assert.equal((await wa.next('pres', (m) => m.u === b.u)).on, true);
    wb.sendJson({ t: 'act', on: false });
    const off = await wa.next('pres', (m) => m.u === b.u && !m.on);
    assert.ok(off.ls > 0, 'last seen is set');
    wb.sendJson({ t: 'act', on: true });
    await wa.next('pres', (m) => m.u === b.u && m.on);
    wb.close();
    await wa.next('pres', (m) => m.u === b.u && !m.on);
  });

  it('goes offline when heartbeats stop even though the socket stays open', async () => {
    const wb = await connect(srv, b.token);
    await wa.next('pres', (m) => m.u === b.u && m.on);
    // Send nothing: like a frozen background tab whose socket the browser keeps alive.
    const off = await wa.next('pres', (m) => m.u === b.u && !m.on, 4000);
    assert.equal(wb.readyState, 1, 'socket still open');
    assert.ok(off.ls > 0);
    wb.close();
  });

  it('hiding last seen hides it both ways', async () => {
    await srv.api('/api/profile', { privacy: { lastSeen: false } }, b.token);
    wa.sendJson({ t: 'watch', u: b.u });
    const p = await wa.next('pres', (m) => m.u === b.u);
    assert.equal(p.hid, true);
    assert.equal(p.ls, 0);
    await srv.api('/api/profile', { privacy: { lastSeen: true } }, b.token);
  });
});

describe('profile & account', () => {
  let a, b, wa;
  before(async () => {
    [a, b] = await Promise.all([register(srv, name('aa')), register(srv, name('ab'))]);
    await befriend(srv, a, b);
    wa = await connect(srv, a.token);
  });
  after(() => wa.close());

  it('name and about reach friends', async () => {
    const r = await srv.api('/api/profile', { name: '  Rakhi\u0007 ', about: 'Busy 📚' }, b.token);
    assert.equal(r.data.name, 'Rakhi');
    await wa.next('prof', (m) => m.u === b.u);
    const f = (await srv.api('/api/friends', undefined, a.token)).data.friends.find((x) => x.u === b.u);
    assert.equal(f.name, 'Rakhi');
    assert.equal(f.about, 'Busy 📚');
  });

  it('profile photo: upload, live update, download, remove', async () => {
    wa.sendJson({ t: 'watch', u: b.u });
    assert.equal((await wa.next('pres', (m) => m.u === b.u)).av, 0);
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const { av } = (await srv.api('/api/avatar', { img: tinyPng }, b.token)).data;
    assert.equal((await wa.next('pres', (m) => m.u === b.u && m.av === av)).av, av);
    const pic = await fetch(srv.base + '/api/avatar?u=' + b.u, { headers: { Authorization: 'Bearer ' + a.token } });
    assert.equal(pic.headers.get('content-type'), 'image/png');
    assert.equal((await srv.api('/api/avatar', { img: 'aGVsbG8gd29ybGQh' }, b.token)).status, 400);
    await srv.api('/api/avatar', { img: null }, b.token);
    await wa.next('pres', (m) => m.u === b.u && m.av === 0);
  });

  it('mute is saved per chat', async () => {
    const r = await srv.api('/api/mute', { u: b.u, until: -1 }, a.token);
    assert.equal(r.data.mutes[b.u], -1);
    assert.equal((await srv.api('/api/me', undefined, a.token)).data.mutes[b.u], -1);
    await srv.api('/api/mute', { u: b.u, until: 0 }, a.token);
  });

  it('password change keeps the key readable and signs out other devices', async () => {
    const other = await C.deriveFromPassword(a.u, a.pw);
    const second = (await srv.api('/api/login', { u: a.u, auth: other.auth })).data.token;
    const ws2 = await connect(srv, second);
    const me = (await srv.api('/api/me', undefined, a.token)).data;
    const next = await C.deriveFromPassword(a.u, 'a brand new password');
    const encPriv = await C.rewrapIdentity(me.encPriv, a.wrapKey, next.wrapKey);
    const wrong = await C.deriveFromPassword(a.u, 'not my password');
    assert.equal((await srv.api('/api/password', { auth: wrong.auth, newAuth: next.auth, encPriv }, a.token)).status, 401);
    assert.equal((await srv.api('/api/password', { auth: other.auth, newAuth: next.auth, encPriv }, a.token)).status, 200);
    assert.equal(await ws2.closed, 4001);
    assert.equal((await srv.api('/api/me', undefined, second)).status, 401);
    assert.equal((await srv.api('/api/me', undefined, a.token)).status, 200); // this device stays signed in
    assert.equal((await srv.api('/api/login', { u: a.u, auth: other.auth })).status, 401);
    const login = await srv.api('/api/login', { u: a.u, auth: next.auth });
    const priv = await C.unwrapIdentity(login.data.encPriv, next.wrapKey);
    // Same identity key: an old conversation key still decrypts.
    const k1 = await C.conversationKey(priv, b.pub, a.u, b.u);
    const sealed = await C.encryptMessage(await C.conversationKey(b.priv, a.pub, b.u, a.u), { type: 'text', text: 'x' }, b.u, a.u, 'cidcidcid1');
    assert.equal((await C.decryptMessage(k1, sealed, b.u, a.u, 'cidcidcid1')).text, 'x');
  });

  it('sign out of all devices', async () => {
    const t2 = (await srv.api('/api/login', { u: b.u, auth: (await C.deriveFromPassword(b.u, b.pw)).auth })).data.token;
    assert.equal((await srv.api('/api/logout-all', {}, b.token)).status, 200);
    assert.equal((await srv.api('/api/me', undefined, b.token)).status, 401);
    assert.equal((await srv.api('/api/me', undefined, t2)).status, 401);
  });
});

describe('active sessions', () => {
  it('lists devices with details and signs out one of them', async () => {
    const u = name('sess');
    const a = await register(srv, u);
    const { auth } = await C.deriveFromPassword(u, a.pw);
    const login = await fetch(srv.base + '/api/login', {
      method: 'POST', body: JSON.stringify({ u, auth }),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131.0 Mobile Safari/537.36' },
    });
    const phoneToken = (await login.json()).token;
    const wsPhone = await connect(srv, phoneToken);

    const list = (await srv.api('/api/sessions', undefined, a.token)).data.sessions;
    assert.equal(list.length, 2);
    assert.equal(list[0].current, true);
    const phone = list.find((s) => !s.current);
    assert.match(phone.ua, /Android 14/);
    assert.equal(phone.online, true);
    assert.ok(phone.created > 0);
    assert.match(phone.id, /^[0-9a-f]{16}$/);

    assert.equal((await srv.api('/api/sessions/revoke', { id: 'ffffffffffffffff' }, a.token)).status, 404);
    assert.equal((await srv.api('/api/sessions/revoke', { id: phone.id }, a.token)).status, 200);
    assert.equal(await wsPhone.closed, 4001); // that device is disconnected right away
    assert.equal((await srv.api('/api/me', undefined, phoneToken)).status, 401);
    assert.equal((await srv.api('/api/me', undefined, a.token)).status, 200);
    assert.equal((await srv.api('/api/sessions', undefined, a.token)).data.sessions.length, 1);
  });

  it("can't see or sign out someone else's sessions", async () => {
    const [x, y] = await Promise.all([register(srv, name('sx')), register(srv, name('sy'))]);
    const yId = (await srv.api('/api/sessions', undefined, y.token)).data.sessions[0].id;
    assert.equal((await srv.api('/api/sessions/revoke', { id: yId }, x.token)).status, 404);
    assert.equal((await srv.api('/api/me', undefined, y.token)).status, 200);
  });
});

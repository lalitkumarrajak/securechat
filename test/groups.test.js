// Groups: membership and admins, relaying one ciphertext to every member, key hand-over between
// members who aren't friends, history only from when you joined, invite links.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { C, befriend, connect, name, register, startServer } from './helpers.js';

const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAAASUVORK5CYII=';

describe('groups', () => {
  let srv, a, b, c, d, A, B, C2, D;
  before(async () => {
    srv = await startServer();
    [a, b, c, d] = await Promise.all(['gra', 'grb', 'grc', 'grd'].map((x) => register(srv, name(x))));
    await befriend(srv, a, b);
    await befriend(srv, a, c);
    await befriend(srv, a, d); // b, c and d aren't friends with each other
    [A, B, C2, D] = await Promise.all([a, b, c, d].map((x) => connect(srv, x.token)));
  });
  after(async () => { for (const w of [A, B, C2, D]) w?.close(); await srv?.stop(); });

  const api = (who, path, body) => srv.api(path, body, who.token);
  const send = async (ws, from, gid, cid, b = 'AAAA', extra = {}) => {
    ws.sendJson({ t: 'msg', cid, to: 'g:' + gid, b, ...extra });
    return ws.next(['ack', 'err'], (m) => m.cid === cid);
  };
  let gid;

  it('only friends can be added; members see each other with keys', async () => {
    const bad = await api(b, '/api/groups', { name: 'Nope', members: [c.u] }); // b and c aren't friends
    assert.equal(bad.status, 400);
    const r = await api(a, '/api/groups', { name: 'Family', members: [b.u, c.u] });
    assert.equal(r.status, 200);
    gid = r.data.group.id;
    assert.equal(r.data.group.admin, true);
    assert.deepEqual(r.data.group.members.map((m) => m.u).sort(), [a.u, b.u, c.u].sort());
    assert.ok(r.data.group.members.every((m) => m.pub));
    await B.next('grp', (m) => m.id === gid);
    const list = (await api(b, '/api/groups')).data.groups;
    assert.equal(list[0].name, 'Family');
    assert.equal(list[0].admin, false);
    assert.equal(list[0].link, undefined); // only admins see the invite link
  });

  it('a group message is stored once and reaches every member', async () => {
    const ack = await send(B, b, gid, 'grpmsg00001');
    assert.equal(ack.t, 'ack');
    const [atA, atC] = await Promise.all([A.next('m', (m) => m.cid === 'grpmsg00001'), C2.next('m', (m) => m.cid === 'grpmsg00001')]);
    assert.equal(atA.to, 'g:' + gid);
    assert.equal(atC.f, b.u);
    assert.equal(await D.gets('m', (m) => m.cid === 'grpmsg00001'), false); // not a member
  });

  it('members who aren’t friends can fetch each other’s key and hand over group keys', async () => {
    assert.equal((await api(b, '/api/key?u=' + c.u)).status, 200);
    assert.equal((await api(b, '/api/key?u=' + d.u)).status, 404);
    const key = await C.conversationKey(b.priv, c.pub, b.u, c.u);
    const ct = await C.encryptMessage(key, { type: 'gkey', g: gid, kid: 'k1', key: 'x' }, b.u, c.u, 'gkeycid0001');
    B.sendJson({ t: 'gkey', g: 'g:' + gid, keys: [{ u: c.u, cid: 'gkeycid0001', b: ct }, { u: d.u, cid: 'gkeycid0002', b: ct }] });
    await B.next('gkeyok');
    const row = await C2.next('m', (m) => m.cid === 'gkeycid0001');
    assert.equal(row.to, c.u);
    assert.deepEqual(await C.decryptMessage(await C.conversationKey(c.priv, b.pub, c.u, b.u), row.b, b.u, c.u, row.cid), { type: 'gkey', g: gid, kid: 'k1', key: 'x' });
    assert.equal(await D.gets('m', (m) => m.cid === 'gkeycid0002'), false); // d isn't in the group
  });

  it('new members see messages from when they joined, not before', async () => {
    const add = await api(a, '/api/groups/add', { id: gid, users: [d.u] });
    assert.equal(add.status, 200);
    await D.next('grp', (m) => m.id === gid);
    await send(A, a, gid, 'grpmsg00002');
    await D.next('m', (m) => m.cid === 'grpmsg00002');
    const D2 = await connect(srv, d.token);
    D2.sendJson({ t: 'sync', after: 0 });
    const { msgs } = await D2.next('batch');
    const cids = msgs.map((m) => m.cid);
    assert.ok(cids.includes('grpmsg00002'));
    assert.ok(!cids.includes('grpmsg00001'));
    assert.ok(msgs.some((m) => m.b.startsWith('sys:') && JSON.parse(m.b.slice(4)).e === 'add')); // "a added d"
    D2.close();
  });

  it('removing someone stops their messages and starts a new key epoch', async () => {
    const before = (await api(a, '/api/groups')).data.groups.find((g) => g.id === gid).epoch;
    assert.equal((await api(b, '/api/groups/remove', { id: gid, u: c.u })).status, 403); // b isn't an admin
    const r = await api(a, '/api/groups/remove', { id: gid, u: c.u });
    assert.equal(r.data.group.epoch, before + 1);
    await C2.next('grp', (m) => m.id === gid);
    await send(B, b, gid, 'grpmsg00003');
    assert.equal(await C2.gets('m', (m) => m.cid === 'grpmsg00003'), false);
    const err = await send(C2, c, gid, 'grpmsg00004');
    assert.equal(err.e, 'not-member');
  });

  it('admins can make it admins-only, and make others admin', async () => {
    await api(a, '/api/groups/update', { id: gid, adminsOnly: true });
    assert.equal((await send(B, b, gid, 'grpmsg00005')).e, 'admins-only');
    assert.equal((await send(B, b, gid, 'grpmsg00006', 'AAAA', { q: 1 })).t, 'ack'); // reactions still allowed
    await api(a, '/api/groups/admin', { id: gid, u: b.u, on: true });
    assert.equal((await send(B, b, gid, 'grpmsg00007')).t, 'ack');
    await api(a, '/api/groups/update', { id: gid, adminsOnly: false, name: 'Family 🏠' });
    assert.equal((await api(b, '/api/groups')).data.groups.find((g) => g.id === gid).name, 'Family 🏠');
  });

  it('invite link: anyone with it can join; reset kills the old one', async () => {
    const e = await register(srv, name('gre')); // nobody's friend
    const { link } = (await api(a, '/api/groups/link', { id: gid })).data;
    assert.match(link, /^[A-Za-z0-9_-]{16}$/);
    const pre = await srv.api('/api/groups/preview?code=' + link, undefined, e.token);
    assert.equal(pre.data.name, 'Family 🏠');
    assert.equal(pre.data.member, false);
    assert.equal((await api(e, '/api/groups/join', { code: link })).status, 200);
    const reset = (await api(a, '/api/groups/link', { id: gid, action: 'reset' })).data.link;
    assert.notEqual(reset, link);
    const f = await register(srv, name('grf'));
    assert.equal((await api(f, '/api/groups/join', { code: link })).status, 404);
    await api(a, '/api/groups/link', { id: gid, action: 'off' });
    assert.equal((await api(f, '/api/groups/join', { code: reset })).status, 404);
  });

  it('group photo, for members only', async () => {
    assert.equal((await api(a, '/api/groups/photo', { id: gid, img: tinyPng })).status, 200);
    const pic = await fetch(srv.base + '/api/groups/photo?id=' + gid, { headers: { Authorization: 'Bearer ' + b.token } });
    assert.equal(pic.status, 200);
    const out = await fetch(srv.base + '/api/groups/photo?id=' + gid, { headers: { Authorization: 'Bearer ' + c.token } });
    assert.equal(out.status, 404); // c was removed
  });

  it('when the last admin leaves, the longest-standing member takes over', async () => {
    const r = await api(a, '/api/groups', { name: 'Trio', members: [b.u, d.u] });
    const id = r.data.group.id;
    await api(a, '/api/groups/leave', { id });
    const g = (await api(b, '/api/groups')).data.groups.find((x) => x.id === id);
    assert.equal(g.members.length, 2);
    assert.ok(g.members.some((m) => m.admin));
    assert.equal(g.epoch, 1);
  });

  it('group-mates can be invited to a game', async () => {
    B.sendJson({ t: 'gnew', type: 'ludo', to: [d.u], ref: 'gg' }); // b and d aren't friends, but share a group
    const g = (await B.next('g', (m) => m.ref === 'gg')).g;
    assert.equal(g.players[1].u, d.u);
  });
});

// Split: shared expense groups. Membership is enforced by the server; the contents stay sealed.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { befriend, C, connect, name, register, startServer } from './helpers.js';

let srv, a, b, c;
const gid = 'grp_' + 'a1b2c3d4e5f6g7';
const key = () => C.b64(crypto.getRandomValues(new Uint8Array(48)));

before(async () => {
  srv = await startServer();
  [a, b, c] = [await register(srv, name('sa')), await register(srv, name('sb')), await register(srv, name('sc'))];
  await befriend(srv, a, b);
});
after(() => srv.stop());

describe('split', () => {
  test('a group: create, add a friend (not a stranger), and both see it', async () => {
    assert.equal((await srv.api('/api/split/create', { gid, wrapped: key() }, a.token)).status, 200);
    assert.equal((await srv.api('/api/split/create', { gid, wrapped: key() }, b.token)).status, 400, 'an id can only be made once');
    assert.equal((await srv.api('/api/split/add', { gid, u: c.u, wrapped: key() }, a.token)).status, 400, 'strangers cannot be added');
    const ws = await connect(srv, b.token);
    assert.equal((await srv.api('/api/split/add', { gid, u: b.u, wrapped: key() }, a.token)).status, 200);
    assert.equal((await ws.next('split')).g, gid, 'the new member is told live');
    const mine = (await srv.api('/api/split', undefined, b.token)).data.groups;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].wrapper, a.u, 'their key came from the person who added them');
    assert.deepEqual(mine[0].members.map((m) => [m.u, m.owner]), [[a.u, true], [b.u, false]]);
    ws.close();
  });

  test('only members read or write; records sync in order and deletions are kept', async () => {
    const body = C.b64(crypto.getRandomValues(new Uint8Array(40)));
    assert.equal((await srv.api(`/api/split/records?gid=${gid}`, { id: 'exp_00000001', body }, c.token)).status, 404);
    assert.equal((await srv.api(`/api/split/records?gid=${gid}&since=0`, undefined, c.token)).status, 404);
    const r1 = await srv.api(`/api/split/records?gid=${gid}`, { id: 'exp_00000001', body }, a.token);
    const r2 = await srv.api(`/api/split/records?gid=${gid}`, { id: 'exp_00000002', body }, b.token);
    assert.ok(r2.data.updated > r1.data.updated);
    assert.equal((await srv.api(`/api/split/records?gid=${gid}`, { id: 'exp_00000003', body: 'not base64!' }, a.token)).status, 400);
    let got = (await srv.api(`/api/split/records?gid=${gid}&since=0`, undefined, b.token)).data;
    assert.deepEqual(got.items.map((i) => i.id), ['exp_00000001', 'exp_00000002']);
    await srv.api(`/api/split/records?gid=${gid}`, { id: 'exp_00000001', body: '' }, a.token);
    got = (await srv.api(`/api/split/records?gid=${gid}&since=${r2.data.updated}`, undefined, a.token)).data;
    assert.deepEqual(got.items.map((i) => [i.id, i.body === '']), [['exp_00000002', false], ['exp_00000001', true]]);
  });

  test('the history is only added to: a line is never changed or deleted, by anyone', async () => {
    const line = C.b64(crypto.getRandomValues(new Uint8Array(40)));
    const id = 'log-AbCdEf012345';
    const put = (who, body, rid = id) => srv.api(`/api/split/records?gid=${gid}`, { id: rid, body }, who.token);
    const first = await put(a, line);
    assert.equal(first.status, 200);
    // Sent again (a lost reply), or rewritten or emptied by anyone: answered, and left as it was.
    assert.equal((await put(a, C.b64(crypto.getRandomValues(new Uint8Array(40))))).data.updated, first.data.updated);
    assert.equal((await put(b, C.b64(crypto.getRandomValues(new Uint8Array(40))))).status, 200);
    assert.equal((await put(b, '')).status, 400, 'a line can’t be deleted');
    assert.equal((await put(a, line, 'log-short')).status, 400, 'only the history’s own shape of id');
    const got = (await srv.api(`/api/split/records?gid=${gid}&since=0`, undefined, b.token)).data.items.find((i) => i.id === id);
    assert.equal(got.body, line);
    assert.equal(got.updated, first.data.updated);
  });

  test('bills: members only, one at a time', async () => {
    const body = C.b64(crypto.getRandomValues(new Uint8Array(5000)));
    assert.equal((await srv.api(`/api/split/bill?gid=${gid}`, { id: 'bill_0001', body }, c.token)).status, 404);
    assert.equal((await srv.api(`/api/split/bill?gid=${gid}`, { id: 'bill_0001', body }, b.token)).status, 200);
    assert.equal((await srv.api(`/api/split/bill?gid=${gid}&id=bill_0001`, undefined, a.token)).data.body, body);
    assert.equal((await srv.api(`/api/split/bill?gid=${gid}&id=bill_0001`, undefined, c.token)).status, 404);
    assert.equal((await srv.api(`/api/split/bill?gid=${gid}&id=bill_0002`, undefined, a.token)).status, 404);
  });

  test('leaving and removing: only the creator removes others; an empty group disappears', async () => {
    assert.equal((await srv.api('/api/split/remove', { gid, u: a.u }, b.token)).status, 403);
    assert.equal((await srv.api('/api/split/remove', { gid }, b.token)).status, 200, 'leaving');
    assert.equal((await srv.api('/api/split', undefined, b.token)).data.groups.length, 0);
    assert.equal((await srv.api(`/api/split/records?gid=${gid}&since=0`, undefined, b.token)).status, 404);
    assert.equal((await srv.api('/api/split/remove', { gid }, a.token)).status, 200);
    assert.equal((await srv.api('/api/split/create', { gid, wrapped: key() }, c.token)).status, 200, 'its id is free again');
    assert.deepEqual((await srv.api(`/api/split/records?gid=${gid}&since=0`, undefined, c.token)).data.items, [], 'old records are gone');
  });
});

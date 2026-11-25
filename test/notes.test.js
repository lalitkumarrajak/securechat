// Notes and diary: stored as ciphertext only the account's own devices can open, synced between them.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { befriend, C, connect, name, register, startServer } from './helpers.js';

let srv;
before(async () => { srv = await startServer({ NOTES_MAX_BYTES: '300000' }); });
after(() => srv.stop());

describe('notes', () => {
  it('only the owner can read them, and their other devices hear about changes', async () => {
    const a = await register(srv, name('nora'));
    const b = await register(srv, name('nick'));
    const key = await C.notesKey(a.priv, a.pub);
    const id = C.randomId(18);
    const note = { day: '2026-10-27', chat: '', title: 'Tuesday', text: 'A quiet day', mood: '🙂' };
    const body = await C.encryptNote(key, note, a.u, id);

    const other = await connect(srv, a.token); // another of a's devices
    const put = await srv.api('/api/notes', { id, body }, a.token);
    assert.equal(put.status, 200);
    await other.next('notes');

    const got = (await srv.api('/api/notes?since=0', undefined, a.token)).data;
    assert.equal(got.notes.length, 1);
    assert.equal(got.notes[0].updated, put.data.updated);
    assert.deepEqual(await C.decryptNote(key, got.notes[0].body, a.u, id), note);
    assert.doesNotMatch(JSON.stringify(got), /quiet/); // the server only has ciphertext

    assert.equal((await srv.api('/api/notes?since=0', undefined, b.token)).data.notes.length, 0); // not someone else's
    const bKey = await C.notesKey(b.priv, b.pub);
    await assert.rejects(C.decryptNote(bKey, body, a.u, id));      // nor with another account's key
    await assert.rejects(C.decryptNote(key, body, a.u, C.randomId(18))); // nor passed off as a different note
    assert.equal((await srv.api('/api/notes?since=0')).status, 401);
    other.close();
  });

  it('syncs changes since the last one seen, including deletions', async () => {
    const a = await register(srv, name('olga'));
    const key = await C.notesKey(a.priv, a.pub);
    const ids = [C.randomId(18), C.randomId(18), C.randomId(18)];
    const times = [];
    for (const id of ids) times.push((await srv.api('/api/notes', { id, body: await C.encryptNote(key, { day: '2026-01-01' }, a.u, id) }, a.token)).data.updated);
    assert.ok(times[0] < times[1] && times[1] < times[2]); // always later, even within the same millisecond

    await srv.api('/api/notes', { id: ids[0], body: '' }, a.token); // deleted
    const since = (await srv.api(`/api/notes?since=${times[2]}`, undefined, a.token)).data.notes;
    assert.deepEqual(since.map((n) => [n.id, n.body]), [[ids[2], since[0].body], [ids[0], '']]);
  });

  it('limits the space an account’s notes take; deleting makes room', async () => {
    const a = await register(srv, name('opal'));
    const ids = [C.randomId(18), C.randomId(18), C.randomId(18)];
    const put = (id, body) => srv.api('/api/notes', { id, body }, a.token);
    const big = 'A'.repeat(110_000);
    assert.equal((await put(ids[0], big)).status, 200);
    assert.equal((await put(ids[1], big)).status, 200);
    const full = await put(ids[2], big); // 330 000 > NOTES_MAX_BYTES
    assert.equal(full.status, 400);
    assert.match(full.data.error, /space/);
    assert.equal((await put(ids[0], '')).status, 200); // a deletion always goes through
    assert.equal((await put(ids[2], big)).status, 200);
  });

  it('rejects bad ids, oversized or non-base64 bodies', async () => {
    const a = await register(srv, name('otto'));
    const ok = C.randomId(18);
    assert.equal((await srv.api('/api/notes', { id: 'short', body: '' }, a.token)).status, 400);
    assert.equal((await srv.api('/api/notes', { id: '../../etc/passwd!!', body: '' }, a.token)).status, 400);
    assert.equal((await srv.api('/api/notes', { id: ok, body: '<script>' }, a.token)).status, 400);
    assert.equal((await srv.api('/api/notes', { id: ok, body: 'A'.repeat(120_004) }, a.token)).status, 400);
    assert.equal((await srv.api('/api/notes', { id: ok, body: 42 }, a.token)).status, 400);
    assert.equal((await srv.api('/api/notes?since=-5', undefined, a.token)).status, 400);
  });

  it('a note shared with a friend reaches only them, sealed with the key the two share, and can be taken back', async () => {
    const a = await register(srv, name('sana'));
    const b = await register(srv, name('sami'));
    const c = await register(srv, name('sid'));
    const id = C.randomId(18);
    const note = { day: '2026-11-25', title: 'Trip', text: 'Packing list', mood: '' };
    const seal = async (to) => C.encryptItem(await C.conversationKey(a.priv, to.pub, a.u, to.u), note, `${a.u}>${to.u}`, 'sharednote', id);
    const share = (to, body) => srv.api('/api/notes/share', { id, to: to.u, body }, a.token);

    assert.equal((await share(b, await seal(b))).status, 400); // not friends yet
    await befriend(srv, a, b);
    const ws = await connect(srv, b.token);
    const put = await share(b, await seal(b));
    assert.equal(put.status, 200);
    await ws.next('notes'); // b hears about it at once
    const told = await ws.next('nshare'); // and is told who shared it, not what it says
    assert.equal(told.from, a.u);
    assert.doesNotMatch(JSON.stringify(told), /Packing/);
    assert.equal((await share(b, await seal(b))).status, 200); // an edit: synced, but no new "shared with you"
    await ws.next('notes');
    assert.equal(await ws.gets('nshare', () => true, 400), false);

    const got = (await srv.api('/api/notes/shared?since=0', undefined, b.token)).data.notes;
    assert.equal(got.length, 1);
    assert.equal(got[0].owner, a.u);
    assert.doesNotMatch(JSON.stringify(got), /Packing/);
    const bKey = await C.conversationKey(b.priv, a.pub, b.u, a.u);
    assert.deepEqual(await C.decryptItem(bKey, got[0].body, `${a.u}>${b.u}`, 'sharednote', id), note);
    await assert.rejects(C.decryptItem(bKey, got[0].body, `${a.u}>${c.u}`, 'sharednote', id)); // can't be passed off as for someone else

    assert.equal((await srv.api('/api/notes/shared?since=0', undefined, c.token)).data.notes.length, 0); // nobody else sees it
    assert.equal((await srv.api('/api/notes/shared?since=0', undefined, a.token)).data.notes.length, 0); // nor the owner's own inbox

    const off = await share(b, ''); // stop sharing
    assert.equal(off.status, 200);
    assert.ok(off.data.updated > put.data.updated);
    const after = (await srv.api(`/api/notes/shared?since=${off.data.updated}`, undefined, b.token)).data.notes;
    assert.deepEqual(after.map((n) => [n.id, n.body]), [[id, '']]);
    assert.equal((await share(c, '')).status, 200); // taking back one never shared: nothing happens
    assert.equal((await srv.api('/api/notes/share', { id, to: a.u, body: 'QQ==' }, a.token)).status, 400); // not with yourself
    ws.close();
  });
});

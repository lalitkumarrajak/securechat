// Notes and diary: stored as ciphertext only the account's own devices can open, synced between them.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { C, connect, name, register, startServer } from './helpers.js';

let srv;
before(async () => { srv = await startServer(); });
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
});

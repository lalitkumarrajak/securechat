// The calendar's server side: its records (sealed like notes, per app) and reminders (the server
// knows when, sends a push with the sealed title, and forgets it).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { C, connect, name, register, sleep, startServer } from './helpers.js';

let srv;
before(async () => { srv = await startServer({ REMINDER_SCAN_MS: '150' }); });
after(() => srv.stop());

describe('calendar records', () => {
  it('are sealed, private to their owner, synced to their other devices and deletable', async () => {
    const [a, b] = await Promise.all(['cal', 'cam'].map((n) => register(srv, name(n))));
    const key = await C.appKey(a.priv, a.pub, 'calendar');
    const id = C.randomId(12);
    const body = await C.encryptItem(key, { title: 'Dentist', start: '2026-11-02T10:00' }, a.u, 'calendar', id);
    const other = await connect(srv, a.token); // another of a's devices

    assert.equal((await srv.api('/api/items?app=calendar', { id, body }, a.token)).status, 200);
    assert.equal((await other.next('calendar')).t, 'calendar');
    const mine = (await srv.api('/api/items?app=calendar&since=0', undefined, a.token)).data.items;
    assert.equal(mine.length, 1);
    assert.deepEqual(await C.decryptItem(key, mine[0].body, a.u, 'calendar', id), { title: 'Dentist', start: '2026-11-02T10:00' });
    assert.equal((await srv.api('/api/items?app=calendar&since=0', undefined, b.token)).data.items.length, 0); // not b's
    await assert.rejects(C.decryptItem(key, mine[0].body, a.u, 'calendar', C.randomId(12))); // can't be passed off as another

    assert.equal((await srv.api('/api/items?app=nope&since=0', undefined, a.token)).status, 400);
    assert.equal((await srv.api('/api/items?app=calendar', { id: 'x', body }, a.token)).status, 400);
    assert.equal((await srv.api('/api/items?app=calendar', { id, body: 'not base64!' }, a.token)).status, 400);

    await srv.api('/api/items?app=calendar', { id, body: '' }, a.token); // deleted
    const after = (await srv.api(`/api/items?app=calendar&since=${mine[0].updated}`, undefined, a.token)).data.items;
    assert.deepEqual(after.map((x) => [x.id, x.body]), [[id, '']]);
    other.close();
  });
});

describe('reminders', () => {
  it('are sent once when due, to the account’s open devices, with the sealed title', async () => {
    const a = await register(srv, name('rem'));
    const ws = await connect(srv, a.token);
    const key = await C.reminderKey(a.priv, a.pub);
    const id = 'r' + C.randomId(10);
    const b = await C.sealReminder(key, { title: 'Ekadashi fast tomorrow' }, a.u, id);
    const later = 'r' + C.randomId(10);
    const r = await srv.api('/api/reminders', { list: [{ id, at: Date.now() + 300, b }, { id: later, at: Date.now() + 3600e3, b }] }, a.token);
    assert.deepEqual(r.data, { ok: true, n: 2 });

    const got = await ws.next('remind', (m) => m.id === id, 4000);
    assert.deepEqual(await C.openReminder(key, got.b, a.u, got.id), { title: 'Ekadashi fast tomorrow' });
    await sleep(500);
    assert.equal(await ws.gets('remind'), false); // once, and the later one isn't due

    // A new list replaces the old one: the later reminder is gone.
    await srv.api('/api/reminders', { list: [] }, a.token);
    ws.close();
  });

  it('rejects bad lists', async () => {
    const a = await register(srv, name('reb'));
    const ok = { id: 'r' + C.randomId(10), at: Date.now() + 60e3, b: 'AAAA' };
    for (const list of [null, [{ ...ok, id: 'x' }], [{ ...ok, at: Date.now() - 3600e3 }], [{ ...ok, at: Date.now() + 500 * 86400e3 }], [{ ...ok, b: '' }],
      Array.from({ length: 501 }, (_, i) => ({ ...ok, id: 'r' + C.randomId(10) + i }))]) {
      assert.equal((await srv.api('/api/reminders', { list }, a.token)).status, 400);
    }
    assert.equal((await srv.api('/api/reminders', { list: [ok] })).status, 401);
  });
});

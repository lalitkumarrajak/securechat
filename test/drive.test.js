// Drive's server side: sealed pieces of files, private to their owner, within a space limit.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { C, name, register, startServer } from './helpers.js';

let srv;
before(async () => { srv = await startServer({ DRIVE_MAX_BYTES: '3000' }); });
after(() => srv.stop());

describe('drive pieces', () => {
  it('are kept per owner, counted against their space, and deleted with the file', async () => {
    const [a, b] = await Promise.all(['dra', 'drb'].map((n) => register(srv, name(n))));
    const file = C.randomId(12);
    const body = C.b64(crypto.getRandomValues(new Uint8Array(900)));

    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=0`, { body }, a.token)).status, 200);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=1`, { body }, a.token)).status, 200);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=0`, undefined, a.token)).data.body, body);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=0`, undefined, b.token)).status, 404); // not b's
    assert.equal((await srv.api('/api/drive/usage', undefined, a.token)).data.used, body.length * 2);
    assert.equal((await srv.api('/api/drive/usage', undefined, b.token)).data.used, 0);

    // Sending a piece again replaces it rather than counting twice; going over the limit is refused.
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=1`, { body }, a.token)).status, 200);
    assert.equal((await srv.api(`/api/drive/chunk?file=${file}&i=2`, { body }, a.token)).status, 400);

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
    const rec = await C.encryptItem(key, { kind: 'folder', name: 'Photos', parent: '' }, a.u, 'drive', id);
    assert.equal((await srv.api('/api/items?app=drive', { id, body: rec }, a.token)).status, 200);
    assert.equal((await srv.api('/api/items?app=drive&since=0', undefined, a.token)).data.items.length, 1);
  });
});

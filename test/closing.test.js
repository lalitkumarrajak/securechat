// "Sign out when I close the tab": the closing tab's beacon ends the sign-in unless a tab with
// the same sign-in reconnects within the grace period (a reload).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { connect, name, register, sleep, startServer } from './helpers.js';

describe('sign out on tab close', () => {
  let srv;
  before(async () => { srv = await startServer({ CLOSE_GRACE_MS: '400' }); });
  after(async () => { await srv?.stop(); });

  const beacon = (token) => fetch(srv.base + '/api/session/closing', {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ token }),
  });

  it('ends the sign-in after the tab closes', async () => {
    const a = await register(srv, name('close'));
    const ws = await connect(srv, a.token);
    ws.close();
    assert.equal((await beacon(a.token)).status, 200);
    await sleep(700);
    assert.equal((await srv.api('/api/me', undefined, a.token)).status, 401);
  });

  it('keeps it when the page reloads (reconnects in time)', async () => {
    const a = await register(srv, name('reload'));
    const ws = await connect(srv, a.token);
    ws.close();
    await beacon(a.token);
    const again = await connect(srv, a.token); // the reloaded page
    await sleep(700);
    assert.equal((await srv.api('/api/me', undefined, a.token)).status, 200);
    again.close();
  });

  it('ignores unknown tokens', async () => {
    assert.equal((await beacon('nope')).status, 200);
  });
});

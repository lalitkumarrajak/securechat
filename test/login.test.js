// Sign-in rate limits: wrong guesses from one address must not lock the account's owner out elsewhere.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { C, name, register, startServer } from './helpers.js';

let srv;
before(async () => { srv = await startServer({ TRUST_PROXY: '1' }); });
after(() => srv.stop());

async function login(u, auth, ip) {
  const res = await fetch(srv.base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ u, auth }),
  });
  return res.status;
}

describe('login limits', () => {
  it('locks out the guessing address, not the account', async () => {
    const a = await register(srv, name('lia'));
    const good = (await C.deriveFromPassword(a.u, a.pw)).auth;
    const bad = (await C.deriveFromPassword(a.u, 'not the password')).auth;
    for (let i = 0; i < 10; i++) assert.equal(await login(a.u, bad, '203.0.113.7'), 401);
    assert.equal(await login(a.u, bad, '203.0.113.7'), 429);
    assert.equal(await login(a.u, good, '203.0.113.7'), 429);  // that address is done for now
    assert.equal(await login(a.u, good, '198.51.100.2'), 200); // the owner, somewhere else, isn't
  });
});

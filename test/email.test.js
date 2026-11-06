// Email: a code to sign up (required once Brevo is set up), signing in with the email, and adding or
// changing it in Settings. Against a fake Brevo API that keeps the emails it was asked to send.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { C, name, register, startServer } from './helpers.js';

let srv, brevo;
const mails = [];
let failNext = false;

before(async () => {
  brevo = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      if (failNext) { failNext = false; return res.writeHead(401).end('{"message":"Key not found"}'); }
      mails.push({ key: req.headers['api-key'], path: req.url, ...JSON.parse(body) });
      res.writeHead(201, { 'Content-Type': 'application/json' }).end('{"messageId":"x"}');
    });
  });
  await new Promise((r) => brevo.listen(0, r));
  srv = await startServer({ BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'sanga@example.com', BREVO_BASE_URL: `http://localhost:${brevo.address().port}` });
});
after(async () => { await srv.stop(); brevo.close(); });

const lastCode = (to) => mails.filter((m) => m.to[0].email === to).at(-1)?.textContent.match(/\b\d{6}\b/)?.[0];

async function signUp(u, email, code, pw = 'test password 123') {
  const { auth, wrapKey } = await C.deriveFromPassword(u, pw);
  const id = await C.generateIdentity(wrapKey);
  return srv.api('/api/register', { u, auth, pub: id.pub, encPriv: id.encPriv, email, code });
}
async function signIn(u, pw = 'test password 123') {
  const { auth } = await C.deriveFromPassword(u, pw);
  return srv.api('/api/login', { u, auth });
}

describe('email', () => {
  it('is required to sign up once email is set up', async () => {
    assert.equal((await srv.api('/api/config')).data.email, true);
    const r = await signUp(name('noemail'), undefined, undefined);
    assert.equal(r.status, 400);
  });

  it('signs up with a code sent through Brevo, in the chosen language, then signs in with the email', async () => {
    const u = name('mailer');
    const email = `${u}@Example.com`;
    const sent = await srv.api('/api/register/code', { u, email, lang: 'hi' });
    assert.equal(sent.status, 200, JSON.stringify(sent.data));
    const m = mails.at(-1);
    assert.equal(m.key, 'xkeysib-test');
    assert.equal(m.path, '/v3/smtp/email');
    assert.equal(m.sender.email, 'sanga@example.com');
    assert.equal(m.to[0].email, email.toLowerCase());
    assert.match(m.subject, /साइन-अप/);
    const code = lastCode(email.toLowerCase());

    assert.equal((await signUp(u, email, code === '000000' ? '111111' : '000000')).status, 400); // wrong code
    const ok = await signUp(u, email, code);
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal((await signUp(u + 'x', email, code)).status, 409); // the email is taken now

    const me = await srv.api('/api/me', undefined, ok.data.token);
    assert.equal(me.data.email, email.toLowerCase());
    // Signing in with the email: the server says whose it is, and the password works with that username.
    const look = await srv.api('/api/login/lookup', { email: email.toUpperCase() });
    assert.equal(look.data.u, u);
    assert.equal((await signIn(look.data.u)).status, 200);
  });

  it('gives an unknown email a made-up username, so it doesn’t say which emails have accounts', async () => {
    const a = await srv.api('/api/login/lookup', { email: 'nobody@example.com' });
    const b = await srv.api('/api/login/lookup', { email: 'nobody@example.com' });
    assert.equal(a.status, 200);
    assert.match(a.data.u, /^[a-z0-9_.]{3,24}$/);
    assert.equal(a.data.u, b.data.u);
    assert.equal((await signIn(a.data.u)).status, 401);
  });

  it('won’t send a code for a taken username or email, and says when the email couldn’t be sent', async () => {
    const taken = name('mailer');
    assert.equal((await srv.api('/api/register/code', { u: taken, email: 'free@example.com' })).status, 409);
    assert.equal((await srv.api('/api/register/code', { u: name('other'), email: `${taken}@example.com` })).status, 409);
    assert.equal((await srv.api('/api/register/code', { u: name('other'), email: 'not an email' })).status, 400);
    failNext = true;
    assert.equal((await srv.api('/api/register/code', { u: name('other'), email: 'other@example.com' })).status, 502);
  });

  it('a code only works for the username it was sent for, and stops after 5 wrong tries', async () => {
    const u = name('tries');
    const email = `${u}@example.com`;
    await srv.api('/api/register/code', { u, email });
    const code = lastCode(email);
    assert.equal((await signUp(name('thief'), email, code)).status, 400);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await signUp(u, email, wrong);
    const r = await signUp(u, email, code);
    assert.equal(r.status, 400);
    assert.match(r.data.error, /expired/);
  });

  it('lets an account change its email after checking a code sent to the new one', async () => {
    const u = name('changer');
    const email = `${u}@example.com`;
    await srv.api('/api/register/code', { u, email });
    assert.equal((await signUp(u, email, lastCode(email))).status, 200);
    const token = (await signIn(u)).data.token;

    assert.equal((await srv.api('/api/email/code', { email }, token)).status, 409); // already yours
    const next = `${u}.new@example.com`;
    assert.equal((await srv.api('/api/email/code', { email: next, lang: 'mr' }, token)).status, 200);
    assert.match(mails.at(-1).subject, /ईमेल/);
    assert.equal((await srv.api('/api/email/verify', { email: next, code: '12' }, token)).status, 400);
    const v = await srv.api('/api/email/verify', { email: next, code: lastCode(next) }, token);
    assert.equal(v.status, 200, JSON.stringify(v.data));
    assert.equal((await srv.api('/api/me', undefined, token)).data.email, next);
    assert.equal((await srv.api('/api/login/lookup', { email: next })).data.u, u);
    assert.notEqual((await srv.api('/api/login/lookup', { email })).data.u, u); // the old one is let go
    assert.equal((await srv.api('/api/email/code', { email: 'x@example.com' })).status, 401); // signed in only
  });
});

describe('email without Brevo', () => {
  it('is optional, so accounts can be made without one, and added later in Settings', async () => {
    const plain = await startServer();
    try {
      assert.equal((await plain.api('/api/config')).data.email, false);
      const a = await register(plain, name('plain'));
      assert.ok(a.token);
      assert.equal((await plain.api('/api/me', undefined, a.token)).data.email, null);
      // Without Brevo the code goes to the server log.
      const email = `${a.u}@example.com`;
      assert.equal((await plain.api('/api/email/code', { email }, a.token)).status, 200);
      const code = plain.log.match(new RegExp(`to ${email.replace('.', '\\.')}[\\s\\S]*?\\b(\\d{6})\\b`))?.[1];
      assert.ok(code, plain.log);
      assert.equal((await plain.api('/api/email/verify', { email, code }, a.token)).status, 200);
      assert.equal((await plain.api('/api/me', undefined, a.token)).data.email, email);
    } finally { await plain.stop(); }
  });
});

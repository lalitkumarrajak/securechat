// Accounts and sessions. The server never sees passwords: the browser derives an "auth key"
// from the password (PBKDF2) and the server stores only an scrypt hash of that.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { ctx } from './context.js';
import { B64_RE, USER_RE, config } from './config.js';
import { clientIp, rateLimited, readJson, sendJson, sha256 } from './http.js';
import { online, sendTo } from './hub.js';
import { locate } from './geo.js';
import { notify } from './push.js';
import { checkCode, normEmail, sendCode, validEmail } from './mail.js';

const scrypt = promisify(crypto.scrypt);
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };
const DUMMY_SALT = crypto.randomBytes(16);

const hashAuth = (auth, salt) => scrypt(Buffer.from(auth, 'base64'), salt, 32, SCRYPT_OPTS);
const isAuthKey = (s) => typeof s === 'string' && s.length === 44 && B64_RE.test(s);
const isKeyBackup = (s) => typeof s === 'string' && s.length <= 2000 && B64_RE.test(s);

async function validPublicKey(b64) {
  if (typeof b64 !== 'string' || b64.length !== 88 || !B64_RE.test(b64)) return false;
  try {
    await crypto.webcrypto.subtle.importKey('raw', Buffer.from(b64, 'base64'),
      { name: 'ECDH', namedCurve: 'P-256' }, true, []);
    return true;
  } catch { return false; }
}

// Device details the app sends at sign-in (from the browser's client hints): the phone model and
// OS version, which the user-agent string no longer includes.
function deviceInfo(dev) {
  const s = (v) => (typeof v === 'string' ? v.replace(/[^\w .,()+-]/g, '').slice(0, 60) : '');
  return dev && typeof dev === 'object' ? JSON.stringify({ model: s(dev.model), pv: s(dev.pv), platform: s(dev.platform) }) : '';
}
const parseDevice = (json) => { try { return json ? JSON.parse(json) : null; } catch { return null; } };

async function createSession(username, req, dev) {
  const token = crypto.randomBytes(32).toString('base64url');
  const h = sha256(token);
  const now = Date.now();
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);
  const ip = clientIp(req);
  const device = deviceInfo(dev);
  await ctx.db.run('insertSession', h, username, now + config.sessionMs);
  await ctx.db.run('insertSessionInfo', h, username, now, now, ua, ip, device);
  return { token, id: sessionId(h), ua, ip, device: parseDevice(device) };
}

// Tell the account's other devices about a new sign-in, so a stranger signing in is noticed.
async function alertSignIn(username, s) {
  const loc = await locate(s.ip);
  sendTo(username, { t: 'signin', id: s.id, ua: s.ua, device: s.device, ip: s.ip, loc });
  const where = loc?.city ? ` near ${[loc.city, loc.country].filter(Boolean).join(', ')}` : '';
  await notify(username, { t: 'signin', name: 'Sanga', where });
}

// Record when each session was last used, at most every 5 minutes (it's only for the sessions list).
const touched = new Map();
export function touchSession(tokenHash, ip) {
  const now = Date.now();
  if (now - (touched.get(tokenHash) || 0) < 5 * 60e3) return;
  touched.set(tokenHash, now);
  if (touched.size > 20000) touched.clear();
  ctx.db.run('touchSessionInfo', now, ip, tokenHash).catch(() => {});
}

// A session's public id: enough of its hash to tell sessions apart, never the token itself.
const sessionId = (tokenHash) => tokenHash.slice(0, 16);

export async function userFromToken(token) {
  if (typeof token !== 'string' || token.length > 100) return null;
  return (await ctx.db.get('getSession', sha256(token), Date.now()))?.username ?? null;
}

async function checkPassword(u, auth) {
  const user = await ctx.db.get('getUser', u);
  // Hash even for unknown users so response timing doesn't reveal which usernames exist.
  const hash = await hashAuth(auth, user ? user.auth_salt : DUMMY_SALT);
  return user && crypto.timingSafeEqual(hash, Buffer.from(user.auth_hash)) ? user : null;
}

// Close sockets of sessions that no longer exist.
function dropSockets(user, keepTokenHash) {
  for (const ws of online.get(user) || []) {
    if (ws.tokenHash !== keepTokenHash) ws.close(4001, 'signed out');
  }
}

export const PUBLIC_ROUTES = new Set(['POST /api/register', 'POST /api/register/code', 'POST /api/register/check', 'POST /api/login', 'POST /api/login/lookup',
  'GET /api/config', 'POST /api/session/closing']);

const emailTaken = async (email) => !!(await ctx.db.get('getUserByEmail', email));
const CODE_ERRORS = { wrong: 'That code isn’t right', expired: 'That code has expired, ask for a new one' };

// Signing in with an email: the password's keys are derived with the username (crypto.deriveFromPassword),
// so the app first asks which username it is. An unknown email gets a made-up username, the same one
// each time while the server runs, so the answer doesn't say whether the email has an account.
const LOOKUP_KEY = crypto.randomBytes(32);
const madeUpUser = (email) => 'u' + crypto.createHmac('sha256', LOOKUP_KEY).update(email).digest('hex').slice(0, 15);

export const routes = {
  // What the landing page needs to know before anyone signs in.
  'GET /api/config': async (req, res) => sendJson(res, 200, { signup: config.allowSignup, gifs: !!config.klipyKey, email: config.emailRequired }),

  // Sign-up: is this username free? Asked while it's typed. (Usernames aren't secret: friends search by them.)
  'POST /api/register/check': async (req, res) => {
    if (rateLimited('check:' + clientIp(req), 60, 60e3)) return sendJson(res, 429, { error: 'Slow down' });
    const { u } = await readJson(req);
    if (typeof u !== 'string' || !USER_RE.test(u)) return sendJson(res, 400, { error: 'Username: 3-24 chars, a-z 0-9 _ .' });
    sendJson(res, 200, { free: !(await ctx.db.get('getUser', u)) });
  },

  // Sign-up, step 1 (when an email is needed): check the username and email are free, and email a code.
  'POST /api/register/code': async (req, res) => {
    if (!config.allowSignup) return sendJson(res, 403, { error: 'Sign-up is closed' });
    const ip = clientIp(req);
    const body = await readJson(req);
    const { u, lang } = body;
    const email = normEmail(body.email);
    if (typeof u !== 'string' || !USER_RE.test(u)) return sendJson(res, 400, { error: 'Username: 3-24 chars, a-z 0-9 _ .' });
    if (!validEmail(email)) return sendJson(res, 400, { error: 'Enter a valid email address' });
    // A few codes per address and per email, so nobody can flood an inbox through Sanga.
    if (rateLimited('code-ip:' + ip, 10, 3600e3) || rateLimited('code-e:' + email, 5, 3600e3)) return sendJson(res, 429, { error: 'Too many attempts, try later' });
    if (await ctx.db.get('getUser', u)) return sendJson(res, 409, { error: 'Username taken' });
    if (await emailTaken(email)) return sendJson(res, 409, { error: 'This email is already used by another account' });
    try { await sendCode('register', email, u, lang); }
    catch (err) { console.error('sign-up email failed', err.message); return sendJson(res, 502, { error: 'Couldn’t send the email, try again later' }); }
    sendJson(res, 200, { ok: true });
  },

  'POST /api/register': async (req, res) => {
    if (!config.allowSignup) return sendJson(res, 403, { error: 'Sign-up is closed' });
    if (rateLimited('reg:' + clientIp(req), config.signupsPerHour, 3600e3)) return sendJson(res, 429, { error: 'Too many attempts, try later' });
    const body = await readJson(req);
    const { u, auth, pub, encPriv, dev, code } = body;
    const email = normEmail(body.email);
    if (typeof u !== 'string' || !USER_RE.test(u)) return sendJson(res, 400, { error: 'Username: 3-24 chars, a-z 0-9 _ .' });
    if (!isAuthKey(auth)) return sendJson(res, 400, { error: 'Invalid auth key' });
    if (!(await validPublicKey(pub))) return sendJson(res, 400, { error: 'Invalid public key' });
    if (!isKeyBackup(encPriv)) return sendJson(res, 400, { error: 'Invalid key backup' });
    if (await ctx.db.get('getUser', u)) return sendJson(res, 409, { error: 'Username taken' });
    // The email, with the code sent to it by /api/register/code: needed when email is set up, else optional.
    if (email || config.emailRequired) {
      if (!validEmail(email)) return sendJson(res, 400, { error: 'Enter a valid email address' });
      if (await emailTaken(email)) return sendJson(res, 409, { error: 'This email is already used by another account' });
      const ok = checkCode('register', email, u, code);
      if (ok !== 'ok') return sendJson(res, 400, { error: CODE_ERRORS[ok] });
    }
    const salt = crypto.randomBytes(16);
    const hash = await hashAuth(auth, salt);
    let changes;
    try { ({ changes } = await ctx.db.run('insertUser', u, hash, salt, pub, encPriv, Date.now(), email || null)); }
    catch (err) {
      if (email && await emailTaken(email)) return sendJson(res, 409, { error: 'This email is already used by another account' });
      throw err;
    }
    if (!changes) return sendJson(res, 409, { error: await emailTaken(email) ? 'This email is already used by another account' : 'Username taken' });
    sendJson(res, 200, { token: (await createSession(u, req, dev)).token });
  },

  // Signing in with an email: which username to derive the password's keys with (see madeUpUser).
  'POST /api/login/lookup': async (req, res) => {
    if (rateLimited('lookup:' + clientIp(req), 30, 900e3)) return sendJson(res, 429, { error: 'Too many attempts, try again in 15 minutes' });
    const email = normEmail((await readJson(req)).email);
    if (!validEmail(email)) return sendJson(res, 400, { error: 'Enter a valid email address' });
    const row = await ctx.db.get('getUserByEmail', email);
    sendJson(res, 200, { u: row?.username || madeUpUser(email) });
  },

  // Settings → Account → Email: add or change this account's email. Step 1, send a code to it.
  'POST /api/email/code': async (req, res, me) => {
    const body = await readJson(req);
    const email = normEmail(body.email);
    if (!validEmail(email)) return sendJson(res, 400, { error: 'Enter a valid email address' });
    if (rateLimited('code-u:' + me, 5, 3600e3) || rateLimited('code-e:' + email, 5, 3600e3)) return sendJson(res, 429, { error: 'Too many attempts, try later' });
    const owner = (await ctx.db.get('getUserByEmail', email))?.username;
    if (owner === me) return sendJson(res, 409, { error: 'This is already your email' });
    if (owner) return sendJson(res, 409, { error: 'This email is already used by another account' });
    try { await sendCode('add', email, me, body.lang); }
    catch (err) { console.error('email code failed', err.message); return sendJson(res, 502, { error: 'Couldn’t send the email, try again later' }); }
    sendJson(res, 200, { ok: true });
  },

  // Step 2: the code from the email; the email is saved only now.
  'POST /api/email/verify': async (req, res, me) => {
    const body = await readJson(req);
    const email = normEmail(body.email);
    if (!validEmail(email)) return sendJson(res, 400, { error: 'Enter a valid email address' });
    const ok = checkCode('add', email, me, body.code);
    if (ok !== 'ok') return sendJson(res, 400, { error: CODE_ERRORS[ok] });
    if (await emailTaken(email)) return sendJson(res, 409, { error: 'This email is already used by another account' });
    try { await ctx.db.run('setEmail', email, me); }
    catch (err) {
      if (await emailTaken(email)) return sendJson(res, 409, { error: 'This email is already used by another account' });
      throw err;
    }
    sendJson(res, 200, { email });
  },

  'POST /api/login': async (req, res) => {
    const ip = clientIp(req);
    const { u, auth, dev } = await readJson(req);
    if (typeof u !== 'string' || !USER_RE.test(u) || !isAuthKey(auth)) return sendJson(res, 400, { error: 'Invalid credentials' });
    // Guessing is limited per address, and per account from each address; a much higher limit per
    // account from everywhere is a backstop. So someone else's wrong guesses can't lock its owner out.
    if (rateLimited('login-ip:' + ip, 30, 900e3) || rateLimited('login-u:' + u + '|' + ip, 10, 900e3) ||
        rateLimited('login-u:' + u, 200, 900e3)) {
      return sendJson(res, 429, { error: 'Too many attempts, try again in 15 minutes' });
    }
    const user = await checkPassword(u, auth);
    if (!user) return sendJson(res, 401, { error: 'Wrong username or password' });
    const s = await createSession(u, req, dev);
    sendJson(res, 200, { token: s.token, pub: user.pubkey, encPriv: user.enc_priv });
    alertSignIn(u, s).catch((err) => console.error('sign-in alert failed', err.message));
  },

  'POST /api/logout': async (req, res, me, token) => {
    await ctx.db.run('deleteSession', sha256(token));
    sendJson(res, 200, { ok: true });
  },

  // "Sign out when I close the tab": a closing tab sends its token (navigator.sendBeacon can't set
  // headers). Unless a tab using the same sign-in is connected again shortly after (a reload, or
  // another open tab), the sign-in ends.
  'POST /api/session/closing': async (req, res) => {
    if (rateLimited('closing:' + clientIp(req), 30, 60e3)) return sendJson(res, 429, { error: 'Slow down' });
    const { token } = await readJson(req, 1024);
    const user = await userFromToken(token);
    sendJson(res, 200, { ok: true });
    if (!user) return;
    const hash = sha256(token);
    setTimeout(async () => {
      const stillOpen = [...(online.get(user) || [])].some((ws) => ws.tokenHash === hash);
      if (!stillOpen) await ctx.db.run('deleteSession', hash).catch((err) => console.error('closing sign-out failed', err.message));
    }, config.closeGraceMs).unref();
  },

  // Devices signed in to this account, newest activity first.
  'GET /api/sessions': async (req, res, me, token) => {
    const mine = sha256(token);
    const rows = await ctx.db.all('listSessions', me, Date.now());
    const live = new Set([...(online.get(me) || [])].map((ws) => ws.tokenHash));
    const locs = await Promise.all(rows.map((r) => locate(r.ip)));
    const sessions = rows.map((r, i) => ({
      id: sessionId(r.token_hash),
      current: r.token_hash === mine,
      online: live.has(r.token_hash),
      created: r.created || 0,
      lastSeen: r.token_hash === mine ? Date.now() : (r.last_seen || 0),
      ua: r.ua || '',
      ip: r.ip || '',
      device: parseDevice(r.device),
      loc: locs[i],
    })).sort((a, b) => Number(b.current) - Number(a.current) || b.lastSeen - a.lastSeen);
    sendJson(res, 200, { sessions });
  },

  // Sign out one device.
  'POST /api/sessions/revoke': async (req, res, me) => {
    const { id } = await readJson(req);
    if (typeof id !== 'string' || !/^[0-9a-f]{16}$/.test(id)) return sendJson(res, 400, { error: 'Invalid session' });
    const row = (await ctx.db.all('listSessions', me, Date.now())).find((r) => sessionId(r.token_hash) === id);
    if (!row) return sendJson(res, 404, { error: 'Session not found' });
    await ctx.db.run('deleteSession', row.token_hash);
    for (const ws of online.get(me) || []) if (ws.tokenHash === row.token_hash) ws.close(4001, 'signed out');
    sendJson(res, 200, { ok: true });
  },

  'POST /api/logout-all': async (req, res, me, token) => {
    await ctx.db.run('deleteOtherSessions', me, sha256(token));
    await ctx.db.run('deleteSession', sha256(token));
    dropSockets(me, null);
    sendJson(res, 200, { ok: true });
  },

  // Change password: the browser re-encrypts the private key with the new password, so all
  // messages stay readable. Other devices are signed out.
  'POST /api/password': async (req, res, me, token) => {
    if (rateLimited('pw:' + me, 10, 900e3)) return sendJson(res, 429, { error: 'Too many attempts, try again in 15 minutes' });
    const { auth, newAuth, encPriv } = await readJson(req);
    if (!isAuthKey(auth) || !isAuthKey(newAuth) || !isKeyBackup(encPriv)) return sendJson(res, 400, { error: 'Invalid request' });
    if (!(await checkPassword(me, auth))) return sendJson(res, 401, { error: 'Current password is wrong' });
    const salt = crypto.randomBytes(16);
    await ctx.db.run('updateAuth', await hashAuth(newAuth, salt), salt, encPriv, me);
    await ctx.db.run('deleteOtherSessions', me, sha256(token));
    dropSockets(me, sha256(token));
    sendJson(res, 200, { ok: true });
  },
};

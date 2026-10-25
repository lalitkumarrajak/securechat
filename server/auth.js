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
  await notify(username, { t: 'signin', name: 'Chattrix', where });
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

export const PUBLIC_ROUTES = new Set(['POST /api/register', 'POST /api/login', 'GET /api/config', 'POST /api/session/closing']);

export const routes = {
  // What the landing page needs to know before anyone signs in.
  'GET /api/config': async (req, res) => sendJson(res, 200, { signup: config.allowSignup, gifs: !!config.klipyKey }),

  'POST /api/register': async (req, res) => {
    if (!config.allowSignup) return sendJson(res, 403, { error: 'Sign-up is closed' });
    if (rateLimited('reg:' + clientIp(req), config.signupsPerHour, 3600e3)) return sendJson(res, 429, { error: 'Too many attempts, try later' });
    const { u, auth, pub, encPriv, dev } = await readJson(req);
    if (typeof u !== 'string' || !USER_RE.test(u)) return sendJson(res, 400, { error: 'Username: 3-24 chars, a-z 0-9 _ .' });
    if (!isAuthKey(auth)) return sendJson(res, 400, { error: 'Invalid auth key' });
    if (!(await validPublicKey(pub))) return sendJson(res, 400, { error: 'Invalid public key' });
    if (!isKeyBackup(encPriv)) return sendJson(res, 400, { error: 'Invalid key backup' });
    if (await ctx.db.get('getUser', u)) return sendJson(res, 409, { error: 'Username taken' });
    const salt = crypto.randomBytes(16);
    const hash = await hashAuth(auth, salt);
    const { changes } = await ctx.db.run('insertUser', u, hash, salt, pub, encPriv, Date.now());
    if (!changes) return sendJson(res, 409, { error: 'Username taken' });
    sendJson(res, 200, { token: (await createSession(u, req, dev)).token });
  },

  'POST /api/login': async (req, res) => {
    const ip = clientIp(req);
    const { u, auth, dev } = await readJson(req);
    if (typeof u !== 'string' || !USER_RE.test(u) || !isAuthKey(auth)) return sendJson(res, 400, { error: 'Invalid credentials' });
    if (rateLimited('login-ip:' + ip, 30, 900e3) || rateLimited('login-u:' + u, 10, 900e3)) {
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

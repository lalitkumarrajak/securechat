// Accounts and sessions. The server never sees passwords: the browser derives an "auth key"
// from the password (PBKDF2) and the server stores only an scrypt hash of that.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { ctx } from './context.js';
import { B64_RE, USER_RE, config } from './config.js';
import { clientIp, rateLimited, readJson, sendJson, sha256 } from './http.js';
import { online } from './hub.js';

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

async function createSession(username) {
  const token = crypto.randomBytes(32).toString('base64url');
  await ctx.db.run('insertSession', sha256(token), username, Date.now() + config.sessionMs);
  return token;
}

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

export const PUBLIC_ROUTES = new Set(['POST /api/register', 'POST /api/login', 'GET /api/config']);

export const routes = {
  // What the landing page needs to know before anyone signs in.
  'GET /api/config': async (req, res) => sendJson(res, 200, { signup: config.allowSignup }),

  'POST /api/register': async (req, res) => {
    if (!config.allowSignup) return sendJson(res, 403, { error: 'Sign-up is closed' });
    if (rateLimited('reg:' + clientIp(req), config.signupsPerHour, 3600e3)) return sendJson(res, 429, { error: 'Too many attempts, try later' });
    const { u, auth, pub, encPriv } = await readJson(req);
    if (typeof u !== 'string' || !USER_RE.test(u)) return sendJson(res, 400, { error: 'Username: 3-24 chars, a-z 0-9 _ .' });
    if (!isAuthKey(auth)) return sendJson(res, 400, { error: 'Invalid auth key' });
    if (!(await validPublicKey(pub))) return sendJson(res, 400, { error: 'Invalid public key' });
    if (!isKeyBackup(encPriv)) return sendJson(res, 400, { error: 'Invalid key backup' });
    if (await ctx.db.get('getUser', u)) return sendJson(res, 409, { error: 'Username taken' });
    const salt = crypto.randomBytes(16);
    const hash = await hashAuth(auth, salt);
    const { changes } = await ctx.db.run('insertUser', u, hash, salt, pub, encPriv, Date.now());
    if (!changes) return sendJson(res, 409, { error: 'Username taken' });
    sendJson(res, 200, { token: await createSession(u) });
  },

  'POST /api/login': async (req, res) => {
    const ip = clientIp(req);
    const { u, auth } = await readJson(req);
    if (typeof u !== 'string' || !USER_RE.test(u) || !isAuthKey(auth)) return sendJson(res, 400, { error: 'Invalid credentials' });
    if (rateLimited('login-ip:' + ip, 30, 900e3) || rateLimited('login-u:' + u, 10, 900e3)) {
      return sendJson(res, 429, { error: 'Too many attempts, try again in 15 minutes' });
    }
    const user = await checkPassword(u, auth);
    if (!user) return sendJson(res, 401, { error: 'Wrong username or password' });
    sendJson(res, 200, { token: await createSession(u), pub: user.pubkey, encPriv: user.enc_priv });
  },

  'POST /api/logout': async (req, res, me, token) => {
    await ctx.db.run('deleteSession', sha256(token));
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

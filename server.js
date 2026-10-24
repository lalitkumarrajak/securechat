// SecureChat server: relays end-to-end encrypted messages. It never sees plaintext,
// passwords, or private keys — only ciphertext blobs and public keys.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { openDatabase } from './db.js';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS) || 30;
const SESSION_MS = 30 * 864e5;
const MAX_BODY = 2_000_000; // max ciphertext length (chars) per message
const TLS_CERT = process.env.TLS_CERT;
const TLS_KEY = process.env.TLS_KEY;
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

const USER_RE = /^[a-z0-9_.]{3,24}$/;
const CID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const scrypt = promisify(crypto.scrypt);
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

// ---------- database ----------
const db = await openDatabase({ url: process.env.DATABASE_URL, dataDir: DATA_DIR });

// Every insert or status change gets a new seq so clients can sync deltas with one number.
let seqCounter = (await db.get('maxSeq')).s;
const nextSeq = () => ++seqCounter;

async function cleanup() {
  const now = Date.now();
  await db.run('purgeMsgs', now - RETENTION_DAYS * 864e5);
  await db.run('purgeSessions', now);
}
await cleanup();
setInterval(() => cleanup().catch((e) => console.error('cleanup failed', e.message)), 3600e3).unref();

// ---------- helpers ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

// Fixed-window rate limiter.
const buckets = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) buckets.set(key, (b = { n: 0, reset: now + windowMs }));
  return ++b.n > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60e3).unref();

async function hashAuth(auth, salt) {
  return scrypt(Buffer.from(auth, 'base64'), salt, 32, SCRYPT_OPTS);
}

async function validPublicKey(b64) {
  if (typeof b64 !== 'string' || b64.length !== 88 || !B64_RE.test(b64)) return false;
  try {
    await crypto.webcrypto.subtle.importKey('raw', Buffer.from(b64, 'base64'),
      { name: 'ECDH', namedCurve: 'P-256' }, true, []);
    return true;
  } catch { return false; }
}

const isAuthKey = (s) => typeof s === 'string' && s.length === 44 && B64_RE.test(s);

async function createSession(username) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.run('insertSession', sha256(token), username, Date.now() + SESSION_MS);
  return token;
}

async function userFromToken(token) {
  if (typeof token !== 'string' || token.length > 100) return null;
  return (await db.get('getSession', sha256(token), Date.now()))?.username ?? null;
}

// ---------- static files (pre-compressed in memory) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};
const staticFiles = new Map();
function loadStatic() {
  const dir = path.join(__dirname, 'public');
  for (const name of fs.readdirSync(dir)) {
    const raw = fs.readFileSync(path.join(dir, name));
    staticFiles.set('/' + name, {
      raw,
      gz: zlib.gzipSync(raw, { level: 9 }),
      br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
      type: MIME[path.extname(name)] || 'application/octet-stream',
      etag: '"' + sha256(raw).slice(0, 16) + '"',
    });
  }
}
loadStatic();

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; " +
    "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  ...(TLS_CERT || TRUST_PROXY ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};

function serveStatic(req, res, pathname) {
  const file = staticFiles.get(pathname === '/' ? '/index.html' : pathname);
  if (!file) return sendJson(res, 404, { error: 'not found' });
  const headers = {
    ...SECURITY_HEADERS, 'Content-Type': file.type, ETag: file.etag,
    'Cache-Control': 'no-cache', Vary: 'Accept-Encoding',
  };
  if (req.headers['if-none-match'] === file.etag) { res.writeHead(304, headers); return res.end(); }
  const ae = String(req.headers['accept-encoding'] || '');
  let body = file.raw;
  if (/\bbr\b/.test(ae)) { body = file.br; headers['Content-Encoding'] = 'br'; }
  else if (/\bgzip\b/.test(ae)) { body = file.gz; headers['Content-Encoding'] = 'gzip'; }
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function sendJson(res, code, obj) {
  res.writeHead(code, { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readJson(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

// ---------- REST API ----------
const DUMMY_SALT = crypto.randomBytes(16);

const routes = {
  'POST /api/register': async (req, res) => {
    if (rateLimited('reg:' + clientIp(req), 10, 3600e3)) return sendJson(res, 429, { error: 'Too many attempts, try later' });
    const { u, auth, pub, encPriv } = await readJson(req);
    if (typeof u !== 'string' || !USER_RE.test(u)) return sendJson(res, 400, { error: 'Username: 3-24 chars, a-z 0-9 _ .' });
    if (!isAuthKey(auth)) return sendJson(res, 400, { error: 'Invalid auth key' });
    if (!(await validPublicKey(pub))) return sendJson(res, 400, { error: 'Invalid public key' });
    if (typeof encPriv !== 'string' || encPriv.length > 2000 || !B64_RE.test(encPriv)) return sendJson(res, 400, { error: 'Invalid key backup' });
    if (await db.get('getUser', u)) return sendJson(res, 409, { error: 'Username taken' });
    const salt = crypto.randomBytes(16);
    const hash = await hashAuth(auth, salt);
    const { changes } = await db.run('insertUser', u, hash, salt, pub, encPriv, Date.now());
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
    const user = await db.get('getUser', u);
    // Hash even for unknown users so response timing doesn't reveal which usernames exist.
    const hash = await hashAuth(auth, user ? user.auth_salt : DUMMY_SALT);
    if (!user || !crypto.timingSafeEqual(hash, Buffer.from(user.auth_hash))) {
      return sendJson(res, 401, { error: 'Wrong username or password' });
    }
    sendJson(res, 200, { token: await createSession(u), pub: user.pubkey, encPriv: user.enc_priv });
  },

  'POST /api/logout': async (req, res, me, token) => {
    await db.run('deleteSession', sha256(token));
    sendJson(res, 200, { ok: true });
  },

  'GET /api/users': async (req, res, me, token, url) => {
    const term = String(url.searchParams.get('q') || '').toLowerCase().slice(0, 24).replace(/[\\%_]/g, '\\$&');
    if (term.length < 2) return sendJson(res, 200, { users: [] });
    const users = (await db.all('searchUsers', term + '%', me)).map((r) => ({ u: r.username, pub: r.pubkey }));
    sendJson(res, 200, { users });
  },

  'GET /api/key': async (req, res, me, token, url) => {
    const user = await db.get('getUser', String(url.searchParams.get('u') || ''));
    if (!user) return sendJson(res, 404, { error: 'No such user' });
    sendJson(res, 200, { u: user.username, pub: user.pubkey });
  },
};
const PUBLIC_ROUTES = new Set(['POST /api/register', 'POST /api/login']);

async function handleHttp(req, res) {
  const url = new URL(req.url, 'http://x');
  const key = `${req.method} ${url.pathname}`;
  const route = routes[key];
  if (!route) {
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method not allowed' });
    return serveStatic(req, res, url.pathname);
  }
  try {
    let me = null, token = null;
    if (!PUBLIC_ROUTES.has(key)) {
      token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      me = await userFromToken(token);
      if (!me) return sendJson(res, 401, { error: 'Not logged in' });
      if (rateLimited('api:' + me, 120, 60e3)) return sendJson(res, 429, { error: 'Slow down' });
    }
    await route(req, res, me, token, url);
  } catch (err) {
    if (!res.headersSent) sendJson(res, 400, { error: err.message === 'too large' ? 'Request too large' : 'Bad request' });
  }
}

const server = TLS_CERT && TLS_KEY
  ? https.createServer({ cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) }, handleHttp)
  : http.createServer(handleHttp);
server.headersTimeout = 15e3;
server.requestTimeout = 30e3;

// ---------- WebSocket relay ----------
const online = new Map();   // username -> Set<ws>
const watchers = new Map(); // username -> Set<ws> subscribed to their presence

const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: MAX_BODY + 4096,
  // Compress only larger frames; saves bandwidth on slow links without wasting CPU on tiny ones.
  perMessageDeflate: { threshold: 512, zlibDeflateOptions: { level: 6 } },
  verifyClient: ({ req }) => {
    const origin = req.headers.origin;
    if (!origin) return true; // non-browser clients
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
  },
});

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const sendTo = (user, obj, except) => {
  for (const ws of online.get(user) || []) if (ws !== except) send(ws, obj);
};
const rowOut = (r) => ({ id: r.id, cid: r.cid, f: r.sender, to: r.recipient, b: r.body, ts: r.ts, s: r.status, seq: r.seq });

async function presence(user) {
  const isOn = online.has(user);
  return { t: 'pres', u: user, on: isOn, ls: isOn ? 0 : ((await db.get('getUser', user))?.last_seen || 0) };
}
async function broadcastPresence(user) {
  const msg = await presence(user);
  for (const ws of watchers.get(user) || []) send(ws, msg);
}

const handlers = {
  async sync(ws, m) {
    const after = Number.isSafeInteger(m.after) ? m.after : 0;
    // Page by row count and payload size so a slow link gets small, steady batches.
    const rows = await db.all('syncMsgs', after, ws.user, ws.user, 200);
    const msgs = [];
    let bytes = 0;
    for (const r of rows) {
      msgs.push(rowOut(r));
      bytes += r.body.length;
      if (bytes > 512_000) break;
    }
    send(ws, { t: 'batch', msgs, more: msgs.length < rows.length || rows.length === 200 });
  },

  async msg(ws, m) {
    if (typeof m.cid !== 'string' || !CID_RE.test(m.cid)) return send(ws, { t: 'err', e: 'bad cid' });
    if (typeof m.to !== 'string' || m.to === ws.user || !(await db.get('getUser', m.to))) return send(ws, { t: 'err', cid: m.cid, e: 'Unknown recipient' });
    if (typeof m.b !== 'string' || m.b.length > MAX_BODY || !B64_RE.test(m.b)) return send(ws, { t: 'err', cid: m.cid, e: 'Bad message' });
    const res = await db.run('insertMsg', nextSeq(), m.cid, ws.user, m.to, m.b, Date.now());
    const row = await db.get('getMsgByCid', ws.user, m.cid);
    send(ws, { t: 'ack', cid: row.cid, id: row.id, ts: row.ts, s: row.status, seq: row.seq });
    if (res.changes === 0) return; // retransmit of a message we already have
    const out = { t: 'm', ...rowOut(row) };
    sendTo(m.to, out);
    sendTo(ws.user, out, ws); // sender's other devices
  },

  async rcpt(ws, m) {
    const s = m.s === 2 ? 2 : 1;
    if (!Array.isArray(m.ids) || m.ids.length > 500) return;
    const bySender = new Map();
    await db.transaction(async (tx) => {
      for (const id of m.ids) {
        if (!Number.isSafeInteger(id)) continue;
        const r = await tx.get('setStatus', s, nextSeq(), id, ws.user, s);
        if (!r) continue;
        if (!bySender.has(r.sender)) bySender.set(r.sender, []);
        bySender.get(r.sender).push({ id: r.id, s: r.status, seq: r.seq });
      }
    });
    for (const [sender, items] of bySender) {
      sendTo(sender, { t: 'st', items });
      sendTo(ws.user, { t: 'st', items }, ws);
    }
  },

  typ(ws, m) {
    if (typeof m.to === 'string' && online.has(m.to)) sendTo(m.to, { t: 'typ', f: ws.user });
  },

  async watch(ws, m) {
    if (typeof m.u !== 'string' || !USER_RE.test(m.u)) return;
    if (ws.watching.size >= 50) {
      const oldest = ws.watching.values().next().value;
      ws.watching.delete(oldest);
      watchers.get(oldest)?.delete(ws);
    }
    ws.watching.add(m.u);
    if (!watchers.has(m.u)) watchers.set(m.u, new Set());
    watchers.get(m.u).add(ws);
    send(ws, await presence(m.u));
  },

  p(ws) { send(ws, { t: 'P' }); },
};

wss.on('connection', (ws, req) => {
  ws.user = null;
  ws.alive = true;
  ws.watching = new Set();
  ws.ip = clientIp(req);
  const authTimer = setTimeout(() => ws.close(4000, 'auth timeout'), 10e3);

  ws.on('pong', () => { ws.alive = true; });
  // Handle each socket's frames one at a time, in order: the database calls are async,
  // and e.g. a 'sync' sent right after 'auth' must not run before auth has finished.
  let queue = Promise.resolve();
  ws.on('message', (data, isBinary) => {
    ws.alive = true;
    if (isBinary) return;
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    queue = queue.then(() => onMessage(m)).catch((err) => console.error('handler error', m.t, err));
  });

  async function onMessage(m) {
    if (!ws.user) {
      if (m.t !== 'auth') return;
      if (rateLimited('wsauth:' + ws.ip, 60, 60e3)) return ws.close(4029, 'rate limited');
      const user = await userFromToken(m.token);
      if (!user) return ws.close(4001, 'unauthorized');
      clearTimeout(authTimer);
      ws.user = user;
      const first = !online.has(user);
      if (first) online.set(user, new Set());
      online.get(user).add(ws);
      send(ws, { t: 'ok', u: user });
      if (first) await broadcastPresence(user);
      return;
    }

    if (rateLimited('ws:' + ws.user, 300, 10e3)) return send(ws, { t: 'err', e: 'Slow down' });
    const h = handlers[m.t];
    if (h) await h(ws, m);
  }

  ws.on('close', () => {
    clearTimeout(authTimer);
    for (const u of ws.watching) watchers.get(u)?.delete(ws);
    if (!ws.user) return;
    const set = online.get(ws.user);
    set?.delete(ws);
    if (set && set.size === 0) {
      online.delete(ws.user);
      const user = ws.user;
      db.run('touchUser', Date.now(), user)
        .then(() => broadcastPresence(user))
        .catch((err) => console.error('presence update failed', err.message));
    }
  });
});

// Drop dead connections (common on flaky mobile networks).
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 30e3).unref();

server.listen(PORT, HOST, () => {
  const proto = TLS_CERT ? 'https' : 'http';
  console.log(`SecureChat running at ${proto}://localhost:${PORT} (${db.kind})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const ws of wss.clients) ws.close(1001, 'server shutting down');
    server.close(() => { db.close(); process.exit(0); });
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

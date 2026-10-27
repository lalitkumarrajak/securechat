// Sanga server: relays end-to-end encrypted messages. It never sees plaintext,
// passwords, or private keys — only ciphertext blobs and public keys.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
import { config, MAX_BODY } from './config.js';
import { ctx } from './context.js';
import { openDatabase } from './db.js';
import { clientIp, installedApps, loadStatic, rateLimited, sendJson, serveStatic, sha256 } from './http.js';
import { addSocket, removeSocket, refreshPresence, send, startPresenceSweep } from './hub.js';
import { PUBLIC_ROUTES, routes as authRoutes, touchSession, userFromToken } from './auth.js';
import { routes as profileRoutes, avatarVersion } from './profiles.js';
import { routes as friendRoutes, migrateFriends } from './friends.js';
import { routes as pushRoutes, initPush } from './push.js';
import { routes as gifRoutes } from './gifs.js';
import { routes as previewRoutes } from './preview.js';
import { routes as groupRoutes } from './groups.js';
import { routes as noteRoutes } from './notes.js';
import { purgeStories, routes as storyRoutes } from './stories.js';
import { handlers as callHandlers, onClose as callClosed, onConnect as callConnected, routes as callRoutes } from './calls.js';
import { handlers as messageHandlers } from './messages.js';
import { handlers as gameHandlers, loadGames, purgeGames } from './games.js';
import { EMOJI_RE, serveEmoji } from './emoji.js';

// ---------- database ----------
ctx.db = await openDatabase({ mongoUri: config.mongoUri, url: config.databaseUrl, dataDir: config.dataDir });
ctx.seq = (await ctx.db.get('maxSeq')).s;

async function cleanup() {
  const cutoff = Date.now() - config.retentionDays * 864e5;
  await ctx.db.run('purgeMsgs', cutoff);
  await ctx.db.run('purgeHidden', cutoff);
  await ctx.db.run('purgeSessions', Date.now());
  await ctx.db.run('purgeSessionInfo');
  await purgeGames();
  await purgeStories();
}
await cleanup();
setInterval(() => cleanup().catch((e) => console.error('cleanup failed', e.message)), 3600e3).unref();

const migrated = await migrateFriends();
if (migrated) console.log(`made ${migrated} existing chat pair(s) friends`);
await initPush();
await loadGames();
loadStatic();

const handlers = { ...messageHandlers, ...gameHandlers, ...callHandlers };

// ---------- HTTP ----------
const routes = { ...authRoutes, ...profileRoutes, ...friendRoutes, ...pushRoutes, ...gifRoutes, ...previewRoutes, ...groupRoutes, ...noteRoutes, ...storyRoutes, ...callRoutes };

async function handleHttp(req, res) {
  const url = new URL(req.url, 'http://x');
  const key = `${req.method} ${url.pathname}`;
  const route = routes[key];
  if (!route) {
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method not allowed' });
    if (url.pathname === '/apps.json') return sendJson(res, 200, installedApps());
    const emoji = EMOJI_RE.exec(url.pathname);
    if (emoji) return serveEmoji(req, res, emoji[1]);
    return serveStatic(req, res, url.pathname);
  }
  try {
    let me = null, token = null;
    if (!PUBLIC_ROUTES.has(key)) {
      token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      me = await userFromToken(token);
      if (!me) return sendJson(res, 401, { error: 'Not logged in' });
      touchSession(sha256(token), clientIp(req));
      if (rateLimited('api:' + me, 240, 60e3)) return sendJson(res, 429, { error: 'Slow down' });
    }
    await route(req, res, me, token, url);
  } catch (err) {
    if (!res.headersSent) sendJson(res, 400, { error: err.message === 'too large' ? 'Request too large' : 'Bad request' });
  }
}

const server = config.tlsCert && config.tlsKey
  ? https.createServer({ cert: fs.readFileSync(config.tlsCert), key: fs.readFileSync(config.tlsKey) }, handleHttp)
  : http.createServer(handleHttp);
server.headersTimeout = 15e3;
server.requestTimeout = 30e3;

// ---------- WebSocket ----------
// Before auth a socket may only send its small 'auth' frame, so a stranger can't make us buffer
// and parse megabytes; the full limit applies once signed in.
const PRE_AUTH_MAX = 4096;
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: MAX_BODY + 4096, // after auth; see PRE_AUTH_MAX
  // Compress only larger frames; saves bandwidth on slow links without wasting CPU on tiny ones.
  perMessageDeflate: { threshold: 512, zlibDeflateOptions: { level: 6 } },
  verifyClient: ({ req }) => {
    const origin = req.headers.origin;
    if (!origin) return true; // non-browser clients
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
  },
});

wss.on('connection', (ws, req) => {
  ws.user = null;
  ws.alive = true;
  ws.active = false;
  ws.beat = Date.now();
  ws.watching = new Set();
  ws.ip = clientIp(req);
  const authTimer = setTimeout(() => ws.close(4000, 'auth timeout'), 10e3);
  // ws has no public per-socket limit; lowering its receiver's one refuses (1009) a big frame from
  // its header instead of after buffering it. The size check below still holds if ws changes.
  if (ws._receiver) ws._receiver._maxPayload = PRE_AUTH_MAX;

  ws.on('pong', () => { ws.alive = true; });
  // A bad or oversized frame is emitted here before ws closes the socket; unhandled, it would crash the server.
  ws.on('error', () => {});

  // Handle each socket's frames one at a time, in order: the database calls are async,
  // and e.g. a 'sync' sent right after 'auth' must not run before auth has finished.
  let queue = Promise.resolve();
  ws.on('message', (data, isBinary) => {
    ws.alive = true;
    if (!ws.user && data.length > PRE_AUTH_MAX) return ws.close(1009, 'too big');
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
      if (ws._receiver) ws._receiver._maxPayload = MAX_BODY + 4096;
      ws.user = user;
      ws.tokenHash = sha256(m.token);
      touchSession(ws.tokenHash, ws.ip);
      ws.active = m.act !== false;
      ws.beat = Date.now();
      addSocket(ws);
      send(ws, { t: 'ok', u: user, av: await avatarVersion(user) });
      callConnected(ws);
      await refreshPresence(user);
      return;
    }
    // Any frame from the client proves its JavaScript is running (not frozen in the background).
    ws.beat = Date.now();
    if (rateLimited('ws:' + ws.user, 300, 10e3)) return send(ws, { t: 'err', e: 'Slow down' });
    const h = Object.hasOwn(handlers, m.t) ? handlers[m.t] : null;
    if (h) await h(ws, m);
  }

  ws.on('close', () => {
    clearTimeout(authTimer);
    if (!ws.user) return;
    removeSocket(ws);
    callClosed(ws);
    refreshPresence(ws.user).catch((err) => console.error('presence update failed', err.message));
  });
});

// Drop dead TCP connections (common on flaky mobile networks).
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 30e3).unref();
startPresenceSweep();

server.listen(config.port, config.host, () => {
  const proto = config.tlsCert ? 'https' : 'http';
  console.log(`Sanga running at ${proto}://localhost:${config.port} (${ctx.db.kind})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const ws of wss.clients) ws.close(1001, 'server shutting down');
    server.close(() => { ctx.db.close(); process.exit(0); });
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

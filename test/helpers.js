// Test helpers: throwaway servers, users created with the real browser crypto, WebSocket clients.
// Set MONGODB_URI or DATABASE_URL to run the same tests against MongoDB or Postgres.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import WebSocket from 'ws';
import * as C from '../web/src/lib/crypto.js';

export { C };
const ROOT = path.join(import.meta.dirname, '..');
let nextPort = 4100 + Math.floor(Math.random() * 500);

// Usernames are unique per run, so tests can share a Postgres/Mongo database between runs.
const RUN = crypto.randomBytes(3).toString('hex');
export const name = (base) => `${base}_${RUN}`;

export async function startServer(env = {}) {
  const port = nextPort++;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chattrix-test-'));
  const webDir = path.join(dataDir, 'web');
  fs.mkdirSync(path.join(webDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(webDir, 'index.html'), '<!doctype html><title>Chattrix</title>'.repeat(20));
  fs.writeFileSync(path.join(webDir, 'assets', 'app-abc123.js'), 'console.log(1)');
  const proc = spawn(process.execPath, [path.join(ROOT, 'server/index.js')], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, WEB_DIR: webDir, SIGNUPS_PER_HOUR: '1000', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  const base = `http://localhost:${port}`;
  for (let i = 0; ; i++) {
    try { await fetch(base + '/'); break; } catch {
      if (i > 100 || proc.exitCode != null) throw new Error('server did not start:\n' + log);
      await sleep(100);
    }
  }
  const api = async (p, body, token, method) => {
    const res = await fetch(base + p, {
      method: method || (body !== undefined ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data, res };
  };
  return {
    port, base, api, proc,
    get log() { return log; },
    async stop() {
      proc.kill();
      await new Promise((r) => (proc.exitCode != null ? r() : proc.once('exit', r)));
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function register(srv, u, pw = 'test password 123') {
  const { auth, wrapKey } = await C.deriveFromPassword(u, pw);
  const id = await C.generateIdentity(wrapKey);
  const r = await srv.api('/api/register', { u, auth, pub: id.pub, encPriv: id.encPriv });
  if (r.status !== 200) throw new Error(`register ${u}: ${r.status} ${JSON.stringify(r.data)}`);
  return { u, pw, ...id, wrapKey, token: r.data.token };
}

export async function befriend(srv, a, b) {
  await srv.api('/api/friends/request', { u: b.u }, a.token);
  const r = await srv.api('/api/friends/accept', { u: a.u }, b.token);
  if (r.status !== 200) throw new Error('befriend failed: ' + JSON.stringify(r.data));
}

// A WebSocket client with a typed inbox: ws.next('ack') waits for the next frame of that type.
export function connect(srv, token, { act = true } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${srv.port}/ws`);
    const inbox = [];
    const waiters = [];
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      const i = waiters.findIndex((w) => w.match(m));
      if (i >= 0) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
    });
    ws.next = (t, pred = () => true, ms = 5000) => {
      const types = [].concat(t);
      const match = (m) => types.includes(m.t) && pred(m);
      const i = inbox.findIndex(match);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((res, rej) => {
        const w = { match, resolve: (m) => { clearTimeout(timer); res(m); } };
        const timer = setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); rej(new Error(`timeout waiting for ${t}`)); }, ms);
        waiters.push(w);
      });
    };
    // Resolves true if a matching frame arrives within ms, false otherwise (for "must NOT happen" checks).
    ws.gets = (t, pred, ms = 600) => ws.next(t, pred, ms).then(() => true, () => false);
    ws.drain = () => inbox.splice(0);
    ws.sendJson = (o) => ws.send(JSON.stringify(o));
    ws.closed = new Promise((r) => ws.on('close', (code) => r(code)));
    ws.on('open', async () => {
      ws.sendJson({ t: 'auth', token, act });
      try { await ws.next('ok'); resolve(ws); } catch (e) { reject(e); }
    });
    ws.on('error', reject);
  });
}

// Encrypts and sends a message the way the app does; resolves with the server ack.
export async function sendText(ws, from, to, content) {
  const key = await C.conversationKey(from.priv, to.pub, from.u, to.u);
  const cid = C.randomId();
  const b = await C.encryptMessage(key, typeof content === 'string' ? { type: 'text', text: content } : content, from.u, to.u, cid);
  ws.sendJson({ t: 'msg', cid, to: to.u, b });
  const reply = await ws.next(['ack', 'err'], (m) => m.cid === cid);
  return { ...reply, cid, b };
}

export async function decrypt(me, other, row) {
  const key = await C.conversationKey(me.priv, other.pub, me.u, other.u);
  return C.decryptMessage(key, row.b, row.f, row.to, row.cid);
}

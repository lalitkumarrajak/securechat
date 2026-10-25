// One-time migration: people who already chatted before friend requests existed become friends.
// Uses SQLite directly to build an "old" database, so it only runs without MONGODB_URI/DATABASE_URL.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { C, sleep } from './helpers.js';

function start(dir) {
  return new Promise((resolve, reject) => {
    const port = 4900 + Math.floor(Math.random() * 90);
    const p = spawn(process.execPath, ['server/index.js'], {
      cwd: path.join(import.meta.dirname, '..'),
      env: { ...process.env, PORT: String(port), DATA_DIR: dir, WEB_DIR: dir },
    });
    let out = '';
    p.stdout.on('data', (d) => { out += d; if (out.includes('running')) resolve({ p, out }); });
    p.on('exit', (code) => reject(new Error('server exited ' + code + '\n' + out)));
  });
}

it('existing chat partners become friends exactly once', { skip: !!(process.env.MONGODB_URI || process.env.DATABASE_URL) }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chattrix-mig-'));
  const pub = async () => (await C.generateIdentity((await C.deriveFromPassword('x', 'y')).wrapKey)).pub;

  // An "old" database: users and a message, but no friendships table or migration flag.
  const old = new DatabaseSync(path.join(dir, 'chat.db'));
  old.exec(`CREATE TABLE users (username TEXT PRIMARY KEY, auth_hash BLOB NOT NULL, auth_salt BLOB NOT NULL,
    pubkey TEXT NOT NULL, enc_priv TEXT NOT NULL, created BIGINT NOT NULL, last_seen BIGINT NOT NULL DEFAULT 0);
    CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, seq BIGINT NOT NULL, cid TEXT NOT NULL,
    sender TEXT NOT NULL, recipient TEXT NOT NULL, body TEXT NOT NULL, ts BIGINT NOT NULL,
    status INTEGER NOT NULL DEFAULT 0, UNIQUE (sender, cid));`);
  const ins = old.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, 0)');
  ins.run('olda', Buffer.alloc(32), Buffer.alloc(16), await pub(), 'AAAA', Date.now());
  ins.run('oldb', Buffer.alloc(32), Buffer.alloc(16), await pub(), 'AAAA', Date.now());
  old.prepare('INSERT INTO messages (seq, cid, sender, recipient, body, ts) VALUES (1, ?, ?, ?, ?, ?)')
    .run('oldcid0001', 'olda', 'oldb', 'AAAA', Date.now());
  old.close();

  const first = await start(dir);
  assert.match(first.out, /made 1 existing chat pair\(s\) friends/);
  first.p.kill();
  await sleep(300);

  const db = new DatabaseSync(path.join(dir, 'chat.db'));
  assert.equal(db.prepare("SELECT status FROM friendships WHERE a = 'olda' AND b = 'oldb'").get().status, 'accepted');
  db.exec('DELETE FROM friendships'); // they unfriend later…
  db.close();

  const second = await start(dir); // …and a restart must not make them friends again
  assert.doesNotMatch(second.out, /existing chat pair/);
  second.p.kill();
  fs.rmSync(dir, { recursive: true, force: true });
});

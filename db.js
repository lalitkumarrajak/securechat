// Storage layer. Uses MongoDB when MONGODB_URI is set or Postgres when DATABASE_URL is set
// (needed on hosts with ephemeral disks, like Render's free plan), otherwise a local SQLite file.
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = (pg) => `
  CREATE TABLE IF NOT EXISTS users (
    username  TEXT PRIMARY KEY,
    auth_hash ${pg ? 'BYTEA' : 'BLOB'} NOT NULL,
    auth_salt ${pg ? 'BYTEA' : 'BLOB'} NOT NULL,
    pubkey    TEXT NOT NULL,
    enc_priv  TEXT NOT NULL,
    created   BIGINT NOT NULL,
    last_seen BIGINT NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    username   TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    expires    BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id        ${pg ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
    seq       BIGINT NOT NULL,
    cid       TEXT NOT NULL,
    sender    TEXT NOT NULL,
    recipient TEXT NOT NULL,
    body      TEXT NOT NULL,
    ts        BIGINT NOT NULL,
    status    INTEGER NOT NULL DEFAULT 0,
    UNIQUE (sender, cid)
  );
  CREATE INDEX IF NOT EXISTS msg_recipient ON messages(recipient, seq);
  CREATE INDEX IF NOT EXISTS msg_sender ON messages(sender, seq);
  CREATE INDEX IF NOT EXISTS msg_ts ON messages(ts);
  CREATE TABLE IF NOT EXISTS avatars (
    username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    data     ${pg ? 'BYTEA' : 'BLOB'} NOT NULL,
    type     TEXT NOT NULL,
    ver      BIGINT NOT NULL
  );
`;

// Queries written once with `?` placeholders; converted to $1, $2… for Postgres.
const SQL = {
  getUser: 'SELECT * FROM users WHERE username = ?',
  insertUser: `INSERT INTO users (username, auth_hash, auth_salt, pubkey, enc_priv, created)
               VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (username) DO NOTHING`,
  searchUsers: `SELECT username, pubkey FROM users WHERE username LIKE ? ESCAPE '\\'
                AND username != ? ORDER BY username LIMIT 20`,
  touchUser: 'UPDATE users SET last_seen = ? WHERE username = ?',
  insertSession: 'INSERT INTO sessions (token_hash, username, expires) VALUES (?, ?, ?)',
  getSession: 'SELECT username FROM sessions WHERE token_hash = ? AND expires > ?',
  deleteSession: 'DELETE FROM sessions WHERE token_hash = ?',
  insertMsg: `INSERT INTO messages (seq, cid, sender, recipient, body, ts)
              VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (sender, cid) DO NOTHING`,
  getMsgByCid: 'SELECT * FROM messages WHERE sender = ? AND cid = ?',
  syncMsgs: `SELECT * FROM messages WHERE seq > ? AND (recipient = ? OR sender = ?)
             ORDER BY seq LIMIT ?`,
  setStatus: `UPDATE messages SET status = ?, seq = ? WHERE id = ? AND recipient = ? AND status < ?
              RETURNING id, sender, status, seq`,
  maxSeq: 'SELECT COALESCE(MAX(seq), 0) AS s FROM messages',
  purgeMsgs: 'DELETE FROM messages WHERE ts < ?',
  purgeSessions: 'DELETE FROM sessions WHERE expires < ?',
  getAvatar: 'SELECT data, type, ver FROM avatars WHERE username = ?',
  avatarVer: 'SELECT ver FROM avatars WHERE username = ?',
  setAvatar: `INSERT INTO avatars (username, data, type, ver) VALUES (?, ?, ?, ?)
              ON CONFLICT (username) DO UPDATE SET data = excluded.data, type = excluded.type, ver = excluded.ver`,
  deleteAvatar: 'DELETE FROM avatars WHERE username = ?',
};

async function openSqlite(dataDir) {
  const { DatabaseSync } = await import('node:sqlite');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'chat.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA(false));
  const stmts = Object.fromEntries(Object.entries(SQL).map(([k, sql]) => [k, db.prepare(sql)]));
  return {
    kind: 'sqlite',
    get: async (name, ...args) => stmts[name].get(...args),
    all: async (name, ...args) => stmts[name].all(...args),
    run: async (name, ...args) => ({ changes: Number(stmts[name].run(...args).changes) }),
    async transaction(fn) {
      db.exec('BEGIN');
      try {
        const out = await fn(this);
        db.exec('COMMIT');
        return out;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    close: async () => db.close(),
  };
}

async function openPostgres(url) {
  const { default: pg } = await import('pg');
  pg.types.setTypeParser(20, Number); // BIGINT -> number (all our values are well below 2^53)
  const pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30e3 });
  pool.on('error', (err) => console.error('postgres pool error', err.message));
  await pool.query(SCHEMA(true));
  const text = Object.fromEntries(Object.entries(SQL).map(([k, sql]) => {
    let i = 0;
    return [k, sql.replace(/\?/g, () => '$' + ++i)];
  }));
  const wrap = (client) => ({
    get: async (name, ...args) => (await client.query(text[name], args)).rows[0],
    all: async (name, ...args) => (await client.query(text[name], args)).rows,
    run: async (name, ...args) => ({ changes: (await client.query(text[name], args)).rowCount }),
  });
  return {
    kind: 'postgres',
    ...wrap(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(wrap(client));
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

// Turns the `LIKE 'term%' ESCAPE '\'` patterns built by the server into an anchored regex.
function likeToRegex(pattern) {
  let re = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (c === '%') re += '.*';
    else if (c === '_') re += '.';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return re + '$';
}

async function openMongo(uri) {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, { maxPoolSize: 5 });
  await client.connect();
  // Use the database named in the URI, or "securechat" if it names none.
  const mdb = client.db(client.options.dbName === 'test' ? 'securechat' : undefined);
  const users = mdb.collection('users');
  const sessions = mdb.collection('sessions');
  const messages = mdb.collection('messages');
  const avatars = mdb.collection('avatars');
  await Promise.all([
    messages.createIndex({ sender: 1, cid: 1 }, { unique: true }),
    messages.createIndex({ recipient: 1, seq: 1 }),
    messages.createIndex({ sender: 1, seq: 1 }),
    messages.createIndex({ seq: 1 }),
    messages.createIndex({ ts: 1 }),
    sessions.createIndex({ expires: 1 }),
  ]);

  // Shape documents like the SQL rows the server expects.
  const bytes = (b) => (b && b.buffer instanceof Uint8Array ? b.buffer : b);
  const userRow = (d) => d && { ...d, username: d._id, auth_hash: bytes(d.auth_hash), auth_salt: bytes(d.auth_salt) };
  const msgRow = (d) => d && { ...d, id: d._id };
  const changes = (n) => ({ changes: n });
  const insertIgnoringDupes = async (coll, doc) => {
    try { await coll.insertOne(doc); return changes(1); }
    catch (e) { if (e.code === 11000) return changes(0); throw e; }
  };

  const ops = {
    getUser: async (u) => userRow(await users.findOne({ _id: u })),
    insertUser: (u, auth_hash, auth_salt, pubkey, enc_priv, created) =>
      insertIgnoringDupes(users, { _id: u, auth_hash, auth_salt, pubkey, enc_priv, created, last_seen: 0 }),
    searchUsers: async (pattern, me) => (await users
      .find({ _id: { $regex: likeToRegex(pattern), $ne: me } }, { projection: { pubkey: 1 } })
      .sort({ _id: 1 }).limit(20).toArray()).map((d) => ({ username: d._id, pubkey: d.pubkey })),
    touchUser: async (ts, u) => changes((await users.updateOne({ _id: u }, { $set: { last_seen: ts } })).modifiedCount),
    insertSession: async (token_hash, username, expires) => {
      await sessions.insertOne({ _id: token_hash, username, expires });
      return changes(1);
    },
    getSession: (h, now) => sessions.findOne({ _id: h, expires: { $gt: now } }),
    deleteSession: async (h) => changes((await sessions.deleteOne({ _id: h })).deletedCount),
    // The message id is its first seq: seqs only grow, so it is unique and an integer like SQL ids.
    insertMsg: (seq, cid, sender, recipient, body, ts) =>
      insertIgnoringDupes(messages, { _id: seq, seq, cid, sender, recipient, body, ts, status: 0 }),
    getMsgByCid: async (sender, cid) => msgRow(await messages.findOne({ sender, cid })),
    syncMsgs: async (after, me, _me, limit) => (await messages
      .find({ seq: { $gt: after }, $or: [{ recipient: me }, { sender: me }] })
      .sort({ seq: 1 }).limit(limit).toArray()).map(msgRow),
    setStatus: async (status, seq, id, recipient, minStatus) => msgRow(await messages.findOneAndUpdate(
      { _id: id, recipient, status: { $lt: minStatus } },
      { $set: { status, seq } },
      { returnDocument: 'after' })) ?? undefined,
    maxSeq: async () => ({ s: (await messages.find().sort({ seq: -1 }).limit(1).next())?.seq ?? 0 }),
    purgeMsgs: async (cutoff) => changes((await messages.deleteMany({ ts: { $lt: cutoff } })).deletedCount),
    purgeSessions: async (now) => changes((await sessions.deleteMany({ expires: { $lt: now } })).deletedCount),
    getAvatar: async (u) => {
      const d = await avatars.findOne({ _id: u });
      return d && { data: bytes(d.data), type: d.type, ver: d.ver };
    },
    avatarVer: (u) => avatars.findOne({ _id: u }, { projection: { ver: 1 } }),
    setAvatar: async (u, data, type, ver) => {
      await avatars.replaceOne({ _id: u }, { data, type, ver }, { upsert: true });
      return changes(1);
    },
    deleteAvatar: async (u) => changes((await avatars.deleteOne({ _id: u })).deletedCount),
  };
  const call = (name, ...args) => ops[name](...args);
  return {
    kind: 'mongodb',
    get: call,
    all: call,
    run: call,
    // Receipt updates are independent and idempotent, so no multi-document transaction is needed.
    transaction(fn) { return fn(this); },
    close: () => client.close(),
  };
}

export function openDatabase({ mongoUri, url, dataDir }) {
  if (mongoUri) return openMongo(mongoUri);
  return url ? openPostgres(url) : openSqlite(dataDir);
}

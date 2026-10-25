// Storage layer. Uses MongoDB when MONGODB_URI is set or Postgres when DATABASE_URL is set
// (needed on hosts with ephemeral disks, like Render's free plan), otherwise a local SQLite file.
//
// Every query has a name; the server calls db.get/all/run(name, ...args) and never sees SQL,
// so the three backends stay interchangeable. New tables are created idempotently on start.
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
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(username);
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
  CREATE TABLE IF NOT EXISTS message_hidden (
    msg_id   BIGINT NOT NULL,
    username TEXT NOT NULL,
    ts       BIGINT NOT NULL,
    PRIMARY KEY (msg_id, username)
  );
  CREATE INDEX IF NOT EXISTS hidden_user ON message_hidden(username, ts);
  CREATE TABLE IF NOT EXISTS avatars (
    username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    data     ${pg ? 'BYTEA' : 'BLOB'} NOT NULL,
    type     TEXT NOT NULL,
    ver      BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS friendships (
    a         TEXT NOT NULL,
    b         TEXT NOT NULL,
    status    TEXT NOT NULL,
    requester TEXT NOT NULL,
    created   BIGINT NOT NULL,
    PRIMARY KEY (a, b)
  );
  CREATE INDEX IF NOT EXISTS friendships_b ON friendships(b);
  CREATE TABLE IF NOT EXISTS blocks (
    blocker TEXT NOT NULL,
    blocked TEXT NOT NULL,
    created BIGINT NOT NULL,
    PRIMARY KEY (blocker, blocked)
  );
  CREATE TABLE IF NOT EXISTS profiles (
    username TEXT PRIMARY KEY,
    name     TEXT NOT NULL DEFAULT '',
    about    TEXT NOT NULL DEFAULT '',
    privacy  TEXT NOT NULL DEFAULT '{}',
    mutes    TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    keys     TEXT NOT NULL,
    created  BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS push_user ON push_subs(username);
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

// Queries written once with `?` placeholders; converted to $1, $2… for Postgres.
// A message whose body is '' has been deleted for everyone.
const SQL = {
  getUser: 'SELECT * FROM users WHERE username = ?',
  insertUser: `INSERT INTO users (username, auth_hash, auth_salt, pubkey, enc_priv, created)
               VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (username) DO NOTHING`,
  updateAuth: 'UPDATE users SET auth_hash = ?, auth_salt = ?, enc_priv = ? WHERE username = ?',
  searchUsers: `SELECT username FROM users WHERE username LIKE ? ESCAPE '\\'
                AND username != ? ORDER BY username LIMIT 20`,
  touchUser: 'UPDATE users SET last_seen = ? WHERE username = ?',

  insertSession: 'INSERT INTO sessions (token_hash, username, expires) VALUES (?, ?, ?)',
  getSession: 'SELECT username FROM sessions WHERE token_hash = ? AND expires > ?',
  deleteSession: 'DELETE FROM sessions WHERE token_hash = ?',
  deleteOtherSessions: 'DELETE FROM sessions WHERE username = ? AND token_hash != ?',

  insertMsg: `INSERT INTO messages (seq, cid, sender, recipient, body, ts)
              VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (sender, cid) DO NOTHING`,
  getMsgByCid: 'SELECT * FROM messages WHERE sender = ? AND cid = ?',
  getMsgById: 'SELECT * FROM messages WHERE id = ?',
  syncMsgs: `SELECT * FROM messages m WHERE m.seq > ? AND (m.recipient = ? OR m.sender = ?)
             AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.msg_id = m.id AND h.username = ?)
             ORDER BY m.seq LIMIT ?`,
  setStatus: `UPDATE messages SET status = ?, seq = ? WHERE id = ? AND recipient = ? AND status < ?
              RETURNING id, sender, status, seq`,
  deleteForAll: `UPDATE messages SET body = '', seq = ? WHERE id = ? AND sender = ? AND ts >= ? AND body != ''
                 RETURNING id, recipient, seq`,
  maxSeq: 'SELECT COALESCE(MAX(seq), 0) AS s FROM messages',
  purgeMsgs: 'DELETE FROM messages WHERE ts < ?',
  purgeSessions: 'DELETE FROM sessions WHERE expires < ?',
  chatPairs: 'SELECT DISTINCT sender, recipient FROM messages',

  hideMsg: 'INSERT INTO message_hidden (msg_id, username, ts) VALUES (?, ?, ?) ON CONFLICT (msg_id, username) DO NOTHING',
  hiddenSince: 'SELECT msg_id, ts FROM message_hidden WHERE username = ? AND ts > ? ORDER BY ts LIMIT 1000',
  purgeHidden: 'DELETE FROM message_hidden WHERE ts < ?',

  getAvatar: 'SELECT data, type, ver FROM avatars WHERE username = ?',
  avatarVer: 'SELECT ver FROM avatars WHERE username = ?',
  setAvatar: `INSERT INTO avatars (username, data, type, ver) VALUES (?, ?, ?, ?)
              ON CONFLICT (username) DO UPDATE SET data = excluded.data, type = excluded.type, ver = excluded.ver`,
  deleteAvatar: 'DELETE FROM avatars WHERE username = ?',

  getFriendship: 'SELECT * FROM friendships WHERE a = ? AND b = ?',
  insertFriendship: `INSERT INTO friendships (a, b, status, requester, created) VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT (a, b) DO NOTHING`,
  acceptFriendship: `UPDATE friendships SET status = 'accepted', created = ?
                     WHERE a = ? AND b = ? AND status = 'pending' AND requester = ?`,
  deleteFriendship: 'DELETE FROM friendships WHERE a = ? AND b = ?',
  listFriendships: 'SELECT * FROM friendships WHERE a = ? OR b = ?',

  insertBlock: 'INSERT INTO blocks (blocker, blocked, created) VALUES (?, ?, ?) ON CONFLICT (blocker, blocked) DO NOTHING',
  deleteBlock: 'DELETE FROM blocks WHERE blocker = ? AND blocked = ?',
  getBlock: 'SELECT blocker FROM blocks WHERE (blocker = ? AND blocked = ?) OR (blocker = ? AND blocked = ?)',
  listBlocks: 'SELECT blocked FROM blocks WHERE blocker = ? ORDER BY blocked',

  getProfile: 'SELECT name, about, privacy, mutes FROM profiles WHERE username = ?',
  setProfile: `INSERT INTO profiles (username, name, about, privacy, mutes) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT (username) DO UPDATE SET name = excluded.name, about = excluded.about,
               privacy = excluded.privacy, mutes = excluded.mutes`,

  setPushSub: `INSERT INTO push_subs (endpoint, username, keys, created) VALUES (?, ?, ?, ?)
               ON CONFLICT (endpoint) DO UPDATE SET username = excluded.username, keys = excluded.keys, created = excluded.created`,
  deletePushSub: 'DELETE FROM push_subs WHERE endpoint = ?',
  pushSubsFor: 'SELECT endpoint, keys FROM push_subs WHERE username = ?',

  getConfig: 'SELECT value FROM config WHERE key = ?',
  setConfig: 'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
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
  const c = (name) => mdb.collection(name);
  const [users, sessions, messages, hidden, avatars, friendships, blocks, profiles, pushSubs, config] =
    ['users', 'sessions', 'messages', 'message_hidden', 'avatars', 'friendships', 'blocks', 'profiles', 'push_subs', 'config'].map(c);
  await Promise.all([
    sessions.createIndex({ expires: 1 }),
    sessions.createIndex({ username: 1 }),
    messages.createIndex({ sender: 1, cid: 1 }, { unique: true }),
    messages.createIndex({ recipient: 1, seq: 1 }),
    messages.createIndex({ sender: 1, seq: 1 }),
    messages.createIndex({ seq: 1 }),
    messages.createIndex({ ts: 1 }),
    hidden.createIndex({ username: 1, ts: 1 }),
    friendships.createIndex({ a: 1 }),
    friendships.createIndex({ b: 1 }),
    blocks.createIndex({ blocked: 1 }),
    pushSubs.createIndex({ username: 1 }),
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
  const pairId = (a, b) => a + '|' + b;
  const friendRow = (d) => d && { a: d.a, b: d.b, status: d.status, requester: d.requester, created: d.created };

  const ops = {
    getUser: async (u) => userRow(await users.findOne({ _id: u })),
    insertUser: (u, auth_hash, auth_salt, pubkey, enc_priv, created) =>
      insertIgnoringDupes(users, { _id: u, auth_hash, auth_salt, pubkey, enc_priv, created, last_seen: 0 }),
    updateAuth: async (auth_hash, auth_salt, enc_priv, u) =>
      changes((await users.updateOne({ _id: u }, { $set: { auth_hash, auth_salt, enc_priv } })).modifiedCount),
    searchUsers: async (pattern, me) => (await users
      .find({ _id: { $regex: likeToRegex(pattern), $ne: me } }, { projection: { _id: 1 } })
      .sort({ _id: 1 }).limit(20).toArray()).map((d) => ({ username: d._id })),
    touchUser: async (ts, u) => changes((await users.updateOne({ _id: u }, { $set: { last_seen: ts } })).modifiedCount),

    insertSession: async (token_hash, username, expires) => {
      await sessions.insertOne({ _id: token_hash, username, expires });
      return changes(1);
    },
    getSession: (h, now) => sessions.findOne({ _id: h, expires: { $gt: now } }),
    deleteSession: async (h) => changes((await sessions.deleteOne({ _id: h })).deletedCount),
    deleteOtherSessions: async (u, keep) => changes((await sessions.deleteMany({ username: u, _id: { $ne: keep } })).deletedCount),

    // The message id is its first seq: seqs only grow, so it is unique and an integer like SQL ids.
    insertMsg: (seq, cid, sender, recipient, body, ts) =>
      insertIgnoringDupes(messages, { _id: seq, seq, cid, sender, recipient, body, ts, status: 0 }),
    getMsgByCid: async (sender, cid) => msgRow(await messages.findOne({ sender, cid })),
    getMsgById: async (id) => msgRow(await messages.findOne({ _id: id })),
    // Hidden rows are excluded before the limit (like the SQL NOT EXISTS), so a page full of
    // hidden messages can't come back empty and stall the sync.
    syncMsgs: async (after, me, _me, _me2, limit) => (await messages.aggregate([
      { $match: { seq: { $gt: after }, $or: [{ recipient: me }, { sender: me }] } },
      { $sort: { seq: 1 } },
      { $lookup: { from: 'message_hidden', let: { id: '$_id' }, as: 'h',
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$msg_id', '$$id'] }, { $eq: ['$username', me] }] } } }] } },
      { $match: { h: { $size: 0 } } },
      { $limit: limit },
      { $project: { h: 0 } },
    ]).toArray()).map(msgRow),
    setStatus: async (status, seq, id, recipient, minStatus) => msgRow(await messages.findOneAndUpdate(
      { _id: id, recipient, status: { $lt: minStatus } },
      { $set: { status, seq } },
      { returnDocument: 'after' })) ?? undefined,
    deleteForAll: async (seq, id, sender, minTs) => msgRow(await messages.findOneAndUpdate(
      { _id: id, sender, ts: { $gte: minTs }, body: { $ne: '' } },
      { $set: { body: '', seq } },
      { returnDocument: 'after' })) ?? undefined,
    maxSeq: async () => ({ s: (await messages.find().sort({ seq: -1 }).limit(1).next())?.seq ?? 0 }),
    purgeMsgs: async (cutoff) => changes((await messages.deleteMany({ ts: { $lt: cutoff } })).deletedCount),
    purgeSessions: async (now) => changes((await sessions.deleteMany({ expires: { $lt: now } })).deletedCount),
    chatPairs: async () => (await messages.aggregate([{ $group: { _id: { s: '$sender', r: '$recipient' } } }]).toArray())
      .map((d) => ({ sender: d._id.s, recipient: d._id.r })),

    hideMsg: (msg_id, username, ts) => insertIgnoringDupes(hidden, { _id: msg_id + '|' + username, msg_id, username, ts }),
    hiddenSince: async (u, ts) => (await hidden.find({ username: u, ts: { $gt: ts } }).sort({ ts: 1 }).limit(1000).toArray())
      .map((d) => ({ msg_id: d.msg_id, ts: d.ts })),
    purgeHidden: async (cutoff) => changes((await hidden.deleteMany({ ts: { $lt: cutoff } })).deletedCount),

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

    getFriendship: async (a, b) => friendRow(await friendships.findOne({ _id: pairId(a, b) })),
    insertFriendship: (a, b, status, requester, created) =>
      insertIgnoringDupes(friendships, { _id: pairId(a, b), a, b, status, requester, created }),
    acceptFriendship: async (created, a, b, requester) => changes((await friendships.updateOne(
      { _id: pairId(a, b), status: 'pending', requester }, { $set: { status: 'accepted', created } })).modifiedCount),
    deleteFriendship: async (a, b) => changes((await friendships.deleteOne({ _id: pairId(a, b) })).deletedCount),
    listFriendships: async (u) => (await friendships.find({ $or: [{ a: u }, { b: u }] }).toArray()).map(friendRow),

    insertBlock: (blocker, blocked, created) => insertIgnoringDupes(blocks, { _id: pairId(blocker, blocked), blocker, blocked, created }),
    deleteBlock: async (blocker, blocked) => changes((await blocks.deleteOne({ _id: pairId(blocker, blocked) })).deletedCount),
    // Same as the SQL: (blocker1 blocked1) OR (blocker2 blocked2), so callers can ask one direction.
    getBlock: async (x1, y1, x2, y2) => {
      const d = await blocks.findOne({ _id: { $in: [pairId(x1, y1), pairId(x2, y2)] } });
      return d && { blocker: d.blocker };
    },
    listBlocks: async (u) => (await blocks.find({ blocker: u }).sort({ blocked: 1 }).toArray()).map((d) => ({ blocked: d.blocked })),

    getProfile: async (u) => {
      const d = await profiles.findOne({ _id: u });
      return d && { name: d.name, about: d.about, privacy: d.privacy, mutes: d.mutes };
    },
    setProfile: async (u, name, about, privacy, mutes) => {
      await profiles.replaceOne({ _id: u }, { name, about, privacy, mutes }, { upsert: true });
      return changes(1);
    },

    setPushSub: async (endpoint, username, keys, created) => {
      await pushSubs.replaceOne({ _id: endpoint }, { username, keys, created }, { upsert: true });
      return changes(1);
    },
    deletePushSub: async (endpoint) => changes((await pushSubs.deleteOne({ _id: endpoint })).deletedCount),
    pushSubsFor: async (u) => (await pushSubs.find({ username: u }).toArray()).map((d) => ({ endpoint: d._id, keys: d.keys })),

    getConfig: (key) => config.findOne({ _id: key }),
    setConfig: async (key, value) => {
      await config.replaceOne({ _id: key }, { value }, { upsert: true });
      return changes(1);
    },
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

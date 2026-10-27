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
  CREATE TABLE IF NOT EXISTS session_info (
    token_hash TEXT PRIMARY KEY,
    username   TEXT NOT NULL,
    created    BIGINT NOT NULL,
    last_seen  BIGINT NOT NULL,
    ua         TEXT NOT NULL DEFAULT '',
    ip         TEXT NOT NULL DEFAULT '',
    device     TEXT NOT NULL DEFAULT ''
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
  CREATE TABLE IF NOT EXISTS groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    about       TEXT NOT NULL DEFAULT '',
    creator     TEXT NOT NULL,
    created     BIGINT NOT NULL,
    epoch       INTEGER NOT NULL DEFAULT 0,
    admins_only INTEGER NOT NULL DEFAULT 0,
    link        TEXT NOT NULL DEFAULT '',
    photo_ver   BIGINT NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS groups_link ON groups(link);
  CREATE TABLE IF NOT EXISTS group_members (
    gid      TEXT NOT NULL,
    username TEXT NOT NULL,
    admin    INTEGER NOT NULL DEFAULT 0,
    joined   BIGINT NOT NULL,
    from_seq BIGINT NOT NULL,
    PRIMARY KEY (gid, username)
  );
  CREATE INDEX IF NOT EXISTS group_members_user ON group_members(username);
  CREATE TABLE IF NOT EXISTS group_photos (
    gid  TEXT PRIMARY KEY,
    data ${pg ? 'BYTEA' : 'BLOB'} NOT NULL,
    type TEXT NOT NULL,
    ver  BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS games (
    id      TEXT PRIMARY KEY,
    type    TEXT NOT NULL,
    status  TEXT NOT NULL,
    state   TEXT NOT NULL,
    updated BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notes (
    username TEXT NOT NULL,
    id       TEXT NOT NULL,
    body     TEXT NOT NULL,
    updated  BIGINT NOT NULL,
    PRIMARY KEY (username, id)
  );
  CREATE INDEX IF NOT EXISTS notes_updated ON notes(username, updated);
  CREATE TABLE IF NOT EXISTS stories (
    id      TEXT PRIMARY KEY,
    owner   TEXT NOT NULL,
    body    TEXT NOT NULL,
    ts      BIGINT NOT NULL,
    expires BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS stories_owner ON stories(owner, expires);
  CREATE INDEX IF NOT EXISTS stories_expires ON stories(expires);
  CREATE TABLE IF NOT EXISTS story_keys (
    story  TEXT NOT NULL,
    viewer TEXT NOT NULL,
    key    TEXT NOT NULL,
    PRIMARY KEY (story, viewer)
  );
  CREATE INDEX IF NOT EXISTS story_keys_viewer ON story_keys(viewer);
  CREATE TABLE IF NOT EXISTS story_views (
    story  TEXT NOT NULL,
    viewer TEXT NOT NULL,
    ts     BIGINT NOT NULL,
    liked  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (story, viewer)
  );
  CREATE TABLE IF NOT EXISTS story_comments (
    id     TEXT NOT NULL,
    story  TEXT NOT NULL,
    author TEXT NOT NULL,
    body   TEXT NOT NULL,
    ts     BIGINT NOT NULL,
    PRIMARY KEY (story, id)
  );
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

// Columns added after a table was first created (CREATE TABLE IF NOT EXISTS won't add them).
const COLUMNS = [
  "ALTER TABLE session_info ADD COLUMN device TEXT NOT NULL DEFAULT ''", // phone model etc., JSON
];

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
  // Device details for the "active sessions" list (sessions created before this have none).
  insertSessionInfo: 'INSERT INTO session_info (token_hash, username, created, last_seen, ua, ip, device) VALUES (?, ?, ?, ?, ?, ?, ?)',
  touchSessionInfo: 'UPDATE session_info SET last_seen = ?, ip = ? WHERE token_hash = ?',
  listSessions: `SELECT s.token_hash, s.expires, i.created, i.last_seen, i.ua, i.ip, i.device FROM sessions s
                 LEFT JOIN session_info i ON i.token_hash = s.token_hash
                 WHERE s.username = ? AND s.expires > ?`,
  purgeSessionInfo: 'DELETE FROM session_info WHERE token_hash NOT IN (SELECT token_hash FROM sessions)',

  insertMsg: `INSERT INTO messages (seq, cid, sender, recipient, body, ts)
              VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (sender, cid) DO NOTHING`,
  getMsgByCid: 'SELECT * FROM messages WHERE sender = ? AND cid = ?',
  getMsgById: 'SELECT * FROM messages WHERE id = ?',
  // Group messages go to "g:<group id>" and reach members who joined before they were sent.
  syncMsgs: `SELECT * FROM messages m WHERE m.seq > ? AND (m.recipient = ? OR m.sender = ?
               OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.username = ? AND m.recipient = 'g:' || gm.gid AND m.seq > gm.from_seq))
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

  // Games (Ludo, …): the whole state as JSON, rewritten after every move.
  saveGame: `INSERT INTO games (id, type, status, state, updated) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET status = excluded.status, state = excluded.state, updated = excluded.updated`,
  openGames: "SELECT state FROM games WHERE status != 'over' AND updated > ?",
  purgeGames: 'DELETE FROM games WHERE updated < ?',

  // Groups. admin and admins_only are 0/1.
  insertGroup: 'INSERT INTO groups (id, name, about, creator, created, link) VALUES (?, ?, ?, ?, ?, ?)',
  getGroup: 'SELECT * FROM groups WHERE id = ?',
  groupByLink: "SELECT * FROM groups WHERE link = ? AND link != ''",
  updateGroup: 'UPDATE groups SET name = ?, about = ?, admins_only = ? WHERE id = ?',
  setGroupLink: 'UPDATE groups SET link = ? WHERE id = ?',
  bumpEpoch: 'UPDATE groups SET epoch = epoch + 1 WHERE id = ?',
  setGroupPhotoVer: 'UPDATE groups SET photo_ver = ? WHERE id = ?',
  deleteGroup: 'DELETE FROM groups WHERE id = ?',
  addMember: `INSERT INTO group_members (gid, username, admin, joined, from_seq) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (gid, username) DO NOTHING`,
  removeMember: 'DELETE FROM group_members WHERE gid = ? AND username = ?',
  setAdmin: 'UPDATE group_members SET admin = ? WHERE gid = ? AND username = ?',
  getMember: 'SELECT * FROM group_members WHERE gid = ? AND username = ?',
  groupMembers: `SELECT gm.username, gm.admin, gm.joined, u.pubkey FROM group_members gm
                 JOIN users u ON u.username = gm.username WHERE gm.gid = ? ORDER BY gm.joined, gm.username`,
  groupsOf: `SELECT g.* FROM groups g JOIN group_members gm ON gm.gid = g.id WHERE gm.username = ?`,
  shareGroup: `SELECT 1 AS x FROM group_members a JOIN group_members b ON a.gid = b.gid
               WHERE a.username = ? AND b.username = ? LIMIT 1`,
  getGroupPhoto: 'SELECT data, type, ver FROM group_photos WHERE gid = ?',
  setGroupPhoto: `INSERT INTO group_photos (gid, data, type, ver) VALUES (?, ?, ?, ?)
                  ON CONFLICT (gid) DO UPDATE SET data = excluded.data, type = excluded.type, ver = excluded.ver`,
  deleteGroupPhoto: 'DELETE FROM group_photos WHERE gid = ?',

  // Notes and diary entries: ciphertext only. An empty body is a deleted note.
  notesSince: 'SELECT id, body, updated FROM notes WHERE username = ? AND updated >= ? ORDER BY updated, id LIMIT ?',
  putNote: `INSERT INTO notes (username, id, body, updated) VALUES (?, ?, ?, ?)
            ON CONFLICT (username, id) DO UPDATE SET body = excluded.body, updated = excluded.updated`,
  getNote: 'SELECT updated FROM notes WHERE username = ? AND id = ?',
  noteStats: 'SELECT COUNT(*) AS n, COALESCE(MAX(updated), 0) AS last FROM notes WHERE username = ?',

  // Stories: ciphertext, plus the story's key wrapped for each person allowed to see it.
  insertStory: 'INSERT INTO stories (id, owner, body, ts, expires) VALUES (?, ?, ?, ?, ?)',
  insertStoryKey: 'INSERT INTO story_keys (story, viewer, key) VALUES (?, ?, ?) ON CONFLICT (story, viewer) DO NOTHING',
  getStory: 'SELECT id, owner, body, ts, expires FROM stories WHERE id = ? AND expires > ?',
  getStoryKey: 'SELECT key FROM story_keys WHERE story = ? AND viewer = ?',
  storiesFor: `SELECT s.id, s.owner, s.ts, s.expires, k.key, v.ts AS seen, v.liked FROM story_keys k
               JOIN stories s ON s.id = k.story
               LEFT JOIN story_views v ON v.story = s.id AND v.viewer = ?
               WHERE k.viewer = ? AND s.expires > ? ORDER BY s.ts`,
  storyCount: 'SELECT COUNT(*) AS n FROM stories WHERE owner = ? AND expires > ?',
  storyViewers: 'SELECT viewer FROM story_keys WHERE story = ?',
  viewStory: 'INSERT INTO story_views (story, viewer, ts, liked) VALUES (?, ?, ?, 0) ON CONFLICT (story, viewer) DO NOTHING',
  likeStory: `INSERT INTO story_views (story, viewer, ts, liked) VALUES (?, ?, ?, ?)
              ON CONFLICT (story, viewer) DO UPDATE SET liked = excluded.liked`,
  storyViews: 'SELECT viewer, ts, liked FROM story_views WHERE story = ? ORDER BY ts',
  insertComment: 'INSERT INTO story_comments (id, story, author, body, ts) VALUES (?, ?, ?, ?, ?) ON CONFLICT (story, id) DO NOTHING',
  storyComments: 'SELECT id, author, body, ts FROM story_comments WHERE story = ? ORDER BY ts LIMIT 1000',
  getComment: 'SELECT id, author FROM story_comments WHERE story = ? AND id = ?',
  commentCount: 'SELECT COUNT(*) AS n FROM story_comments WHERE story = ? AND author = ?',
  deleteComment: 'DELETE FROM story_comments WHERE story = ? AND id = ?',
  deleteStoryComments: 'DELETE FROM story_comments WHERE story = ?',
  deleteStoryViews: 'DELETE FROM story_views WHERE story = ?',
  deleteStoryKeys: 'DELETE FROM story_keys WHERE story = ?',
  deleteStory: 'DELETE FROM stories WHERE id = ?',
  expiredStories: 'SELECT id FROM stories WHERE expires <= ? LIMIT 500',

  getConfig: 'SELECT value FROM config WHERE key = ?',
  setConfig: 'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
};

async function openSqlite(dataDir) {
  const { DatabaseSync } = await import('node:sqlite');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'chat.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA(false));
  for (const sql of COLUMNS) try { db.exec(sql); } catch { /* column already there */ }
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
  for (const sql of COLUMNS) await pool.query(sql.replace('ADD COLUMN', 'ADD COLUMN IF NOT EXISTS'));
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
  const [users, sessions, messages, hidden, avatars, friendships, blocks, profiles, pushSubs, games, config, groups, groupMembers, groupPhotos, notes,
    stories, storyKeys, storyViews, storyComments] =
    ['users', 'sessions', 'messages', 'message_hidden', 'avatars', 'friendships', 'blocks', 'profiles', 'push_subs', 'games', 'config',
      'groups', 'group_members', 'group_photos', 'notes', 'stories', 'story_keys', 'story_views', 'story_comments'].map(c);
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
    groupMembers.createIndex({ username: 1 }),
    groupMembers.createIndex({ gid: 1 }),
    groups.createIndex({ link: 1 }),
    friendships.createIndex({ b: 1 }),
    blocks.createIndex({ blocked: 1 }),
    pushSubs.createIndex({ username: 1 }),
    notes.createIndex({ username: 1, updated: 1 }),
    stories.createIndex({ owner: 1, expires: 1 }),
    stories.createIndex({ expires: 1 }),
    storyKeys.createIndex({ viewer: 1 }),
    storyKeys.createIndex({ story: 1 }),
    storyViews.createIndex({ story: 1, ts: 1 }),
    storyComments.createIndex({ story: 1, ts: 1 }),
  ]);

  // Shape documents like the SQL rows the server expects.
  const bytes = (b) => (b && b.buffer instanceof Uint8Array ? b.buffer : b);
  const userRow = (d) => d && { ...d, username: d._id, auth_hash: bytes(d.auth_hash), auth_salt: bytes(d.auth_salt) };
  const msgRow = (d) => d && { ...d, id: d._id };
  const groupRow = (d) => d && { ...d, id: d._id };
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
    insertSessionInfo: async (h, _u, created, last_seen, ua, ip, device) =>
      changes((await sessions.updateOne({ _id: h }, { $set: { created, last_seen, ua, ip, device } })).modifiedCount),
    touchSessionInfo: async (last_seen, ip, h) => changes((await sessions.updateOne({ _id: h }, { $set: { last_seen, ip } })).modifiedCount),
    listSessions: async (u, now) => (await sessions.find({ username: u, expires: { $gt: now } }).toArray())
      .map((d) => ({ token_hash: d._id, expires: d.expires, created: d.created, last_seen: d.last_seen, ua: d.ua, ip: d.ip, device: d.device })),
    purgeSessionInfo: async () => changes(0), // stored on the session document, removed with it

    // The message id is its first seq: seqs only grow, so it is unique and an integer like SQL ids.
    insertMsg: (seq, cid, sender, recipient, body, ts) =>
      insertIgnoringDupes(messages, { _id: seq, seq, cid, sender, recipient, body, ts, status: 0 }),
    getMsgByCid: async (sender, cid) => msgRow(await messages.findOne({ sender, cid })),
    getMsgById: async (id) => msgRow(await messages.findOne({ _id: id })),
    // Hidden rows are excluded before the limit (like the SQL NOT EXISTS), so a page full of
    // hidden messages can't come back empty and stall the sync.
    syncMsgs: async (after, me, _me, _me2, _me3, limit) => {
      const mine = await groupMembers.find({ username: me }).toArray();
      return (await messages.aggregate([
      { $match: { seq: { $gt: after }, $or: [{ recipient: me }, { sender: me },
        ...mine.map((m) => ({ recipient: 'g:' + m.gid, seq: { $gt: m.from_seq } }))] } },
      { $sort: { seq: 1 } },
      { $lookup: { from: 'message_hidden', let: { id: '$_id' }, as: 'h',
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$msg_id', '$$id'] }, { $eq: ['$username', me] }] } } }] } },
      { $match: { h: { $size: 0 } } },
      { $limit: limit },
      { $project: { h: 0 } },
    ]).toArray()).map(msgRow);
    },
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

    saveGame: async (id, type, status, state, updated) => {
      await games.replaceOne({ _id: id }, { type, status, state, updated }, { upsert: true });
      return changes(1);
    },
    openGames: async (since) => games.find({ status: { $ne: 'over' }, updated: { $gt: since } }, { projection: { state: 1 } }).toArray(),
    purgeGames: async (cutoff) => changes((await games.deleteMany({ updated: { $lt: cutoff } })).deletedCount),

    insertGroup: async (id, name, about, creator, created, link) => {
      await groups.insertOne({ _id: id, name, about, creator, created, epoch: 0, admins_only: 0, link, photo_ver: 0 });
      return changes(1);
    },
    getGroup: async (id) => groupRow(await groups.findOne({ _id: id })),
    groupByLink: async (link) => (link ? groupRow(await groups.findOne({ link })) : undefined),
    updateGroup: async (name, about, admins_only, id) => changes((await groups.updateOne({ _id: id }, { $set: { name, about, admins_only } })).modifiedCount),
    setGroupLink: async (link, id) => changes((await groups.updateOne({ _id: id }, { $set: { link } })).modifiedCount),
    bumpEpoch: async (id) => changes((await groups.updateOne({ _id: id }, { $inc: { epoch: 1 } })).modifiedCount),
    setGroupPhotoVer: async (ver, id) => changes((await groups.updateOne({ _id: id }, { $set: { photo_ver: ver } })).modifiedCount),
    deleteGroup: async (id) => changes((await groups.deleteOne({ _id: id })).deletedCount),
    addMember: (gid, username, admin, joined, from_seq) =>
      insertIgnoringDupes(groupMembers, { _id: gid + '|' + username, gid, username, admin, joined, from_seq }),
    removeMember: async (gid, u) => changes((await groupMembers.deleteOne({ _id: gid + '|' + u })).deletedCount),
    setAdmin: async (admin, gid, u) => changes((await groupMembers.updateOne({ _id: gid + '|' + u }, { $set: { admin } })).modifiedCount),
    getMember: async (gid, u) => (await groupMembers.findOne({ _id: gid + '|' + u })) ?? undefined,
    groupMembers: async (gid) => {
      const ms = await groupMembers.find({ gid }).sort({ joined: 1, username: 1 }).toArray();
      const keys = new Map((await users.find({ _id: { $in: ms.map((m) => m.username) } }, { projection: { pubkey: 1 } }).toArray()).map((u) => [u._id, u.pubkey]));
      return ms.filter((m) => keys.has(m.username)).map((m) => ({ username: m.username, admin: m.admin, joined: m.joined, pubkey: keys.get(m.username) }));
    },
    groupsOf: async (u) => {
      const ids = (await groupMembers.find({ username: u }, { projection: { gid: 1 } }).toArray()).map((m) => m.gid);
      return (await groups.find({ _id: { $in: ids } }).toArray()).map(groupRow);
    },
    shareGroup: async (a, b) => {
      const ids = (await groupMembers.find({ username: a }, { projection: { gid: 1 } }).toArray()).map((m) => m.gid);
      return (await groupMembers.findOne({ username: b, gid: { $in: ids } })) ? { x: 1 } : undefined;
    },
    getGroupPhoto: async (gid) => {
      const d = await groupPhotos.findOne({ _id: gid });
      return d && { data: bytes(d.data), type: d.type, ver: d.ver };
    },
    setGroupPhoto: async (gid, data, type, ver) => {
      await groupPhotos.replaceOne({ _id: gid }, { data, type, ver }, { upsert: true });
      return changes(1);
    },
    deleteGroupPhoto: async (gid) => changes((await groupPhotos.deleteOne({ _id: gid })).deletedCount),

    notesSince: async (u, since, limit) => (await notes.find({ username: u, updated: { $gte: since } })
      .sort({ updated: 1, id: 1 }).limit(limit).toArray()).map((d) => ({ id: d.id, body: d.body, updated: d.updated })),
    putNote: async (u, id, body, updated) => {
      await notes.replaceOne({ _id: u + '|' + id }, { username: u, id, body, updated }, { upsert: true });
      return changes(1);
    },
    getNote: async (u, id) => (await notes.findOne({ _id: u + '|' + id }, { projection: { updated: 1 } })) ?? undefined,
    noteStats: async (u) => ({
      n: await notes.countDocuments({ username: u }),
      last: (await notes.find({ username: u }).sort({ updated: -1 }).limit(1).next())?.updated ?? 0,
    }),

    insertStory: (id, owner, body, ts, expires) => insertIgnoringDupes(stories, { _id: id, owner, body, ts, expires }),
    insertStoryKey: (story, viewer, key) => insertIgnoringDupes(storyKeys, { _id: story + '|' + viewer, story, viewer, key }),
    getStory: async (id, now) => {
      const d = await stories.findOne({ _id: id, expires: { $gt: now } });
      return d ? { id: d._id, owner: d.owner, body: d.body, ts: d.ts, expires: d.expires } : undefined;
    },
    getStoryKey: async (story, viewer) => (await storyKeys.findOne({ _id: story + '|' + viewer }, { projection: { key: 1 } })) ?? undefined,
    storiesFor: async (_viewer, viewer, now) => {
      const keys = new Map((await storyKeys.find({ viewer }).toArray()).map((k) => [k.story, k.key]));
      const list = await stories.find({ _id: { $in: [...keys.keys()] }, expires: { $gt: now } }, { projection: { body: 0 } }).sort({ ts: 1 }).toArray();
      const views = new Map((await storyViews.find({ viewer, story: { $in: list.map((d) => d._id) } }).toArray()).map((v) => [v.story, v]));
      return list.map((d) => ({ id: d._id, owner: d.owner, ts: d.ts, expires: d.expires, key: keys.get(d._id), seen: views.get(d._id)?.ts ?? null, liked: views.get(d._id)?.liked ?? null }));
    },
    storyCount: async (owner, now) => ({ n: await stories.countDocuments({ owner, expires: { $gt: now } }) }),
    storyViewers: async (story) => (await storyKeys.find({ story }, { projection: { viewer: 1 } }).toArray()).map((d) => ({ viewer: d.viewer })),
    viewStory: (story, viewer, ts) => insertIgnoringDupes(storyViews, { _id: story + '|' + viewer, story, viewer, ts, liked: 0 }),
    likeStory: async (story, viewer, ts, liked) => {
      await storyViews.updateOne({ _id: story + '|' + viewer }, { $set: { liked }, $setOnInsert: { story, viewer, ts } }, { upsert: true });
      return changes(1);
    },
    storyViews: async (story) => (await storyViews.find({ story }).sort({ ts: 1 }).toArray()).map((d) => ({ viewer: d.viewer, ts: d.ts, liked: d.liked })),
    insertComment: (id, story, author, body, ts) => insertIgnoringDupes(storyComments, { _id: story + '|' + id, id, story, author, body, ts }),
    storyComments: async (story) => (await storyComments.find({ story }).sort({ ts: 1 }).limit(1000).toArray())
      .map((d) => ({ id: d.id, author: d.author, body: d.body, ts: d.ts })),
    getComment: async (story, id) => {
      const d = await storyComments.findOne({ _id: story + '|' + id }, { projection: { author: 1 } });
      return d ? { id, author: d.author } : undefined;
    },
    commentCount: async (story, author) => ({ n: await storyComments.countDocuments({ story, author }) }),
    deleteComment: async (story, id) => changes((await storyComments.deleteOne({ _id: story + '|' + id })).deletedCount),
    deleteStoryComments: async (story) => changes((await storyComments.deleteMany({ story })).deletedCount),
    deleteStoryViews: async (story) => changes((await storyViews.deleteMany({ story })).deletedCount),
    deleteStoryKeys: async (story) => changes((await storyKeys.deleteMany({ story })).deletedCount),
    deleteStory: async (id) => changes((await stories.deleteOne({ _id: id })).deletedCount),
    expiredStories: async (now) => (await stories.find({ expires: { $lte: now } }, { projection: { _id: 1 } }).limit(500).toArray()).map((d) => ({ id: d._id })),

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

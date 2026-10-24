// Storage layer. Uses Postgres when DATABASE_URL is set (needed on hosts with
// ephemeral disks, like Render's free plan), otherwise a local SQLite file.
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

export function openDatabase({ url, dataDir }) {
  return url ? openPostgres(url) : openSqlite(dataDir);
}

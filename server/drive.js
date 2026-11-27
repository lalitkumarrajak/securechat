// Drive: your files and folders. Each file is sealed on the device with a random key of its own and
// sent in pieces; the server keeps only those sealed pieces, per account, and never sees a name, a
// folder or a key (those are the file's record, an item of app 'drive', sealed like any other app's).
//
// Where the pieces go: a Google Drive (gdrive.js) when one is set up, else Cloudflare R2 (r2.js), as
// plain bytes; otherwise the database itself, as base64 text. Either way the database keeps a row per
// piece (who, which file, which piece, its size, and where it is: 'gd:<file id>' or 'r2:<key>'), which
// is how space is counted. Pieces still in the database from before move out in the background.
import { B64_RE, USER_RE } from './config.js';
import { ctx } from './context.js';
import { canChat } from './friends.js';
import { clientIp, rateLimited, readJson, sendJson } from './http.js';
import { sendTo } from './hub.js';
import { r2FromEnv } from './r2.js';
import { gdriveFromEnv } from './gdrive.js';

const FILE_RE = /^[A-Za-z0-9_-]{8,40}$/;
const LINK_RE = /^[A-Za-z0-9_-]{16,40}$/;
const MAX_BOX = 4_000_000;     // a share's sealed list of what's in it (base64)
const MAX_LINK_FILES = 5000;   // files one share may hand out
const MAX_LINKS = 500;         // shares per person
const MAX_RECIPIENTS = 50;     // friends per share
export const MAX_CHUNK = 2_200_000; // base64 of one sealed piece (1.5 MB of the file)
const MAX_PIECES = 4000;

const gd = gdriveFromEnv(), r2 = r2FromEnv();
const keyOf = (u, file, i) => `drive/${u}/${file}/${i}`;

/** Where new pieces go, or null for the database. Pieces already elsewhere stay readable there. */
export const storage = gd
  ? { name: `Google Drive (folder “${gd.where}”)`, put: async (u, file, i, buf) => 'gd:' + (await gd.put(`${u}-${file}-${i}`, buf)) }
  : r2
    ? { name: `R2 (${r2.endpoint}, bucket ${r2.bucket})`, put: async (u, file, i, buf) => { const k = keyOf(u, file, i); await r2.put(k, buf); return 'r2:' + k; } }
    : null;
const outside = (ref) => {
  const [kind, rest] = [ref.slice(0, 3), ref.slice(3)];
  const s = kind === 'gd:' ? gd : kind === 'r2:' ? r2 : null;
  if (!s) throw Object.assign(new Error(`file storage ${kind} not set up`), { setup: true });
  return { get: () => s.get(rest), del: () => s.del(rest) };
};

// Stored bytes per byte of the files: base64 text in the database is a third bigger.
const RATIO = storage ? 1 : 4 / 3;
const env = (k, d) => Number(process.env[k]) || d;
// Space per person, and for everyone together, as stored. In the database it's kept small (Atlas's free
// cluster holds 512 MB for everything); R2's free plan holds 10 GB; a Google Drive what its plan has.
const GB = 1024 ** 3; // as the app shows sizes, so "50 GB" reads 50 GB
const [MAX_BYTES, MAX_TOTAL] = gd ? [50 * GB, 1024 * GB] : r2 ? [2 * GB, 9 * GB] : [200e6, 250e6];
const maxEach = env('DRIVE_MAX_BYTES', MAX_BYTES), maxAll = env('DRIVE_TOTAL_MAX_BYTES', MAX_TOTAL);

const fileOf = (url) => {
  const f = url.searchParams.get('file');
  return typeof f === 'string' && FILE_RE.test(f) ? f : null;
};
const pieceOf = (url) => {
  const i = Number(url.searchParams.get('i'));
  return Number.isSafeInteger(i) && i >= 0 && i < MAX_PIECES ? i : null;
};
const asFiles = (stored) => Math.round(Number(stored) / RATIO);
/** One piece of `owner`'s file, as base64, wherever it's kept; or why not. */
async function readChunk(owner, file, i) {
  const row = await ctx.db.get('getDriveChunk', owner, file, i);
  if (!row) return { status: 404 };
  if (row.body) return { body: row.body }; // still in the database
  try {
    const buf = await outside(row.ref || 'r2:' + keyOf(owner, file, i)).get();
    return buf ? { body: buf.toString('base64') } : { status: 404 };
  } catch (e) { return { status: 502, e }; }
}
const sendChunk = (res, r) => (r.body ? sendJson(res, 200, { body: r.body })
  : r.status === 502 ? unreachable(res, r.e) : sendJson(res, 404, { error: 'File not found' }));

/** The share, if `me` owns it (or it doesn't exist yet when `fresh`); else answers 404 and returns null. */
async function ownShare(res, me, id, fresh = false) {
  if (typeof id !== 'string' || !LINK_RE.test(id)) { sendJson(res, 400, { error: 'Invalid share' }); return null; }
  const row = await ctx.db.get('getDriveLink', id);
  if (row ? row.owner !== me : !fresh) { sendJson(res, 404, { error: 'Share not found' }); return null; }
  return row ?? { id, owner: me, fresh: true };
}
const tellRecipients = async (id, extra = {}) => {
  for (const { recipient } of await ctx.db.all('driveLinkRecipients', id)) sendTo(recipient, { t: 'drive', ...extra });
};
const publicLimit = (req) => rateLimited('drivepub:' + clientIp(req), 600, 60e3);

/** The routes anyone may call, signed in or not: what a share link opens. */
export const PUBLIC = ['GET /api/drive/public', 'GET /api/drive/public/chunk'];

const unreachable = (res, e) => { console.error('drive:', e.message); sendJson(res, 502, { error: 'Couldn’t reach file storage. Try again.' }); };

export const routes = {
  // How much space your files use and how much there is, in bytes of the files themselves.
  'GET /api/drive/usage': async (req, res, me) => {
    const [{ bytes }, { bytes: total }] = await Promise.all([ctx.db.get('driveStats', me), ctx.db.get('driveTotal')]);
    // Your room is your own limit, or what's left for everyone if that's less.
    const max = Math.min(maxEach, Number(bytes) + Math.max(0, maxAll - Number(total)));
    sendJson(res, 200, { used: asFiles(bytes), max: asFiles(max) });
  },

  'GET /api/drive/chunk': async (req, res, me, token, url) => {
    const file = fileOf(url), i = pieceOf(url);
    if (!file || i == null) return sendJson(res, 400, { error: 'Invalid file' });
    sendChunk(res, await readChunk(me, file, i));
  },

  // ---------- sharing ----------
  // A share's sealed list, and the files it may hand out (sent again whenever what's in it changes).
  'POST /api/drive/link': async (req, res, me) => {
    const { id, box, files } = await readJson(req, MAX_BOX + MAX_LINK_FILES * 45 + 1000);
    const row = await ownShare(res, me, id, true);
    if (!row) return;
    if (typeof box !== 'string' || !box || box.length > MAX_BOX || !B64_RE.test(box)) return sendJson(res, 400, { error: 'That is too much to share at once' });
    if (!Array.isArray(files) || files.length > MAX_LINK_FILES || !files.every((f) => typeof f === 'string' && FILE_RE.test(f))) return sendJson(res, 400, { error: 'That is too much to share at once' });
    if (row.fresh && (await ctx.db.get('driveLinkCount', me)).n >= MAX_LINKS) return sendJson(res, 400, { error: `You can share up to ${MAX_LINKS} things at a time` });
    await ctx.db.run('putDriveLink', id, me, box, [...new Set(files)].join(','), Date.now());
    if (!row.fresh) await tellRecipients(id);
    sendJson(res, 200, {});
  },

  // Sharing stopped: the link stops working and the friends it went to lose it.
  'POST /api/drive/link/delete': async (req, res, me) => {
    const { id } = await readJson(req, 500);
    const row = await ownShare(res, me, id, true);
    if (!row) return;
    if (!row.fresh) {
      await tellRecipients(id);
      await ctx.db.run('delDriveLinkAllTo', id);
      await ctx.db.run('delDriveLink', id);
    }
    sendJson(res, 200, {});
  },

  // Friends a share goes to: each gets its key wrapped with the key the two of you share.
  'POST /api/drive/link/to': async (req, res, me) => {
    const { id, add = [], remove = [] } = await readJson(req, 64_000);
    const row = await ownShare(res, me, id);
    if (!row) return;
    if (!Array.isArray(add) || !Array.isArray(remove) || add.length > MAX_RECIPIENTS || remove.length > MAX_RECIPIENTS) return sendJson(res, 400, { error: 'Invalid share' });
    for (const u of remove) {
      if (typeof u !== 'string' || !USER_RE.test(u)) return sendJson(res, 400, { error: 'Invalid share' });
      if ((await ctx.db.run('delDriveLinkTo', id, u)).changes) sendTo(u, { t: 'drive' });
    }
    const have = new Set((await ctx.db.all('driveLinkRecipients', id)).map((r) => r.recipient));
    for (const a of add) {
      if (typeof a?.u !== 'string' || !USER_RE.test(a.u) || a.u === me || typeof a.wrapped !== 'string' || a.wrapped.length > 400 || !B64_RE.test(a.wrapped)) {
        return sendJson(res, 400, { error: 'Invalid share' });
      }
      if (!(await canChat(me, a.u))) continue; // only friends
      if (!have.has(a.u) && have.size >= MAX_RECIPIENTS) return sendJson(res, 400, { error: `You can share with up to ${MAX_RECIPIENTS} people` });
      await ctx.db.run('putDriveLinkTo', id, a.u, me, a.wrapped, Date.now());
      if (!have.has(a.u)) { have.add(a.u); sendTo(a.u, { t: 'drive', from: me }); }
    }
    sendJson(res, 200, {});
  },

  // What friends shared with me (only while we're still friends).
  'GET /api/drive/shared': async (req, res, me) => {
    const ok = new Map();
    const shares = [];
    for (const r of await ctx.db.all('driveSharedWith', me)) {
      if (!ok.has(r.owner)) ok.set(r.owner, await canChat(r.owner, me));
      if (ok.get(r.owner)) shares.push({ id: r.id, owner: r.owner, wrapped: r.wrapped, updated: Number(r.updated) });
    }
    sendJson(res, 200, { shares });
  },

  // ---------- opening a share (no sign-in needed: the key is in the link) ----------
  'GET /api/drive/public': async (req, res, me, token, url) => {
    if (publicLimit(req)) return sendJson(res, 429, { error: 'Slow down' });
    const id = url.searchParams.get('id');
    const row = typeof id === 'string' && LINK_RE.test(id) ? await ctx.db.get('getDriveLink', id) : null;
    if (!row) return sendJson(res, 404, { error: 'This link doesn’t work any more' });
    sendJson(res, 200, { box: row.box, updated: Number(row.updated) });
  },

  'GET /api/drive/public/chunk': async (req, res, me, token, url) => {
    if (publicLimit(req)) return sendJson(res, 429, { error: 'Slow down' });
    const id = url.searchParams.get('id'), file = fileOf(url), i = pieceOf(url);
    const row = typeof id === 'string' && LINK_RE.test(id) ? await ctx.db.get('getDriveLink', id) : null;
    if (!row || !file || i == null || !row.files.split(',').includes(file)) return sendJson(res, 404, { error: 'File not found' });
    sendChunk(res, await readChunk(row.owner, file, i));
  },

  'POST /api/drive/chunk': async (req, res, me, token, url) => {
    const file = fileOf(url), i = pieceOf(url);
    if (!file || i == null) return sendJson(res, 400, { error: 'Invalid file' });
    const { body } = await readJson(req, MAX_CHUNK + 1000);
    if (typeof body !== 'string' || !body || body.length > MAX_CHUNK || !B64_RE.test(body)) return sendJson(res, 400, { error: 'That piece is too big' });
    const buf = storage ? Buffer.from(body, 'base64') : null;
    const size = buf ? buf.length : body.length;
    const [{ bytes }, { bytes: total }, old] = await Promise.all([ctx.db.get('driveStats', me), ctx.db.get('driveTotal'), ctx.db.get('driveChunkSize', me, file, i)]);
    const was = Number(old?.size ?? 0);
    if (Number(bytes) - was + size > maxEach) return sendJson(res, 400, { error: 'Your Drive is full. Delete some files first.' });
    if (Number(total) - was + size > maxAll) return sendJson(res, 400, { error: 'Drive is full for now. Delete some files first.' });
    let ref = '';
    if (buf) { try { ref = await storage.put(me, file, i, buf); } catch (e) { return unreachable(res, e); } }
    await ctx.db.run('putDriveChunk', me, file, i, buf ? '' : body, size, ref);
    // The piece sent again (an upload tried twice): the copy it replaces goes.
    if (old?.ref && old.ref !== ref) await Promise.resolve().then(() => outside(old.ref).del()).catch(() => {});
    sendJson(res, 200, {});
  },

  // A file deleted for good (or an upload given up): all its pieces go.
  'POST /api/drive/delete': async (req, res, me) => {
    const { file } = await readJson(req, 500);
    if (typeof file !== 'string' || !FILE_RE.test(file)) return sendJson(res, 400, { error: 'Invalid file' });
    try {
      for (const { idx, ref } of await ctx.db.all('driveFileChunks', me, file)) {
        const r = ref || (storage ? 'r2:' + keyOf(me, file, idx) : '');
        if (r) await outside(r).del().catch((e) => { if (!e.setup) throw e; }); // a store no longer set up: nothing to delete there
      }
    } catch (e) { return unreachable(res, e); }
    await ctx.db.run('delDriveFile', me, file);
    sendJson(res, 200, {});
  },
};

/** With outside storage set up: move the pieces kept in the database before, a few at a time. */
export async function moveDriveOut() {
  if (!storage) return 0;
  let moved = 0;
  for (;;) {
    const rows = await ctx.db.all('driveInDb', 20);
    if (!rows.length) break;
    for (const r of rows) {
      const buf = Buffer.from(r.body, 'base64');
      const ref = await storage.put(r.username, r.file, r.idx, buf);
      await ctx.db.run('driveMoved', buf.length, ref, r.username, r.file, r.idx);
      moved++;
    }
  }
  return moved;
}

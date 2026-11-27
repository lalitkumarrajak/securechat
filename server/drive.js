// Drive: your files and folders. Each file is sealed on the device with a random key of its own and
// sent in pieces; the server keeps only those sealed pieces, per account, and never sees a name, a
// folder or a key (those are the file's record, an item of app 'drive', sealed like any other app's).
//
// Where the pieces go: a Google Drive (gdrive.js) when one is set up, else Cloudflare R2 (r2.js), as
// plain bytes; otherwise the database itself, as base64 text. Either way the database keeps a row per
// piece (who, which file, which piece, its size, and where it is: 'gd:<file id>' or 'r2:<key>'), which
// is how space is counted. Pieces still in the database from before move out in the background.
import { B64_RE } from './config.js';
import { ctx } from './context.js';
import { readJson, sendJson } from './http.js';
import { r2FromEnv } from './r2.js';
import { gdriveFromEnv } from './gdrive.js';

const FILE_RE = /^[A-Za-z0-9_-]{8,40}$/;
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
    const row = await ctx.db.get('getDriveChunk', me, file, i);
    if (!row) return sendJson(res, 404, { error: 'File not found' });
    if (row.body) return sendJson(res, 200, { body: row.body }); // still in the database
    let buf;
    try { buf = await outside(row.ref || 'r2:' + keyOf(me, file, i)).get(); } catch (e) { return unreachable(res, e); }
    if (!buf) return sendJson(res, 404, { error: 'File not found' });
    sendJson(res, 200, { body: buf.toString('base64') });
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

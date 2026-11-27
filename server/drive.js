// Drive: your files and folders. Each file is sealed on the device with a random key of its own and
// sent in pieces; the server keeps only those sealed pieces, per account, and never sees a name, a
// folder or a key (those are the file's record, an item of app 'drive', sealed like any other app's).
import { B64_RE } from './config.js';
import { ctx } from './context.js';
import { readJson, sendJson } from './http.js';

const FILE_RE = /^[A-Za-z0-9_-]{8,40}$/;
export const MAX_CHUNK = 2_200_000; // base64 of one sealed piece (1.5 MB of the file)
const MAX_PIECES = 4000;
// All of an account's pieces, as stored (base64: about 4/3 of the files' size). Kept modest by
// default because the pieces live in the database (Atlas's free cluster holds 512 MB in all).
const MAX_BYTES = Number(process.env.DRIVE_MAX_BYTES) || 200e6;

const fileOf = (url) => {
  const f = url.searchParams.get('file');
  return typeof f === 'string' && FILE_RE.test(f) ? f : null;
};
const pieceOf = (url) => {
  const i = Number(url.searchParams.get('i'));
  return Number.isSafeInteger(i) && i >= 0 && i < MAX_PIECES ? i : null;
};

export const routes = {
  // How much space your files use, and how much there is.
  'GET /api/drive/usage': async (req, res, me) => {
    const { bytes } = await ctx.db.get('driveStats', me);
    sendJson(res, 200, { used: Number(bytes), max: MAX_BYTES });
  },

  'GET /api/drive/chunk': async (req, res, me, token, url) => {
    const file = fileOf(url), i = pieceOf(url);
    if (!file || i == null) return sendJson(res, 400, { error: 'Invalid file' });
    const row = await ctx.db.get('getDriveChunk', me, file, i);
    if (!row) return sendJson(res, 404, { error: 'File not found' });
    sendJson(res, 200, { body: row.body });
  },

  'POST /api/drive/chunk': async (req, res, me, token, url) => {
    const file = fileOf(url), i = pieceOf(url);
    if (!file || i == null) return sendJson(res, 400, { error: 'Invalid file' });
    const { body } = await readJson(req, MAX_CHUNK + 1000);
    if (typeof body !== 'string' || !body || body.length > MAX_CHUNK || !B64_RE.test(body)) return sendJson(res, 400, { error: 'That piece is too big' });
    const [{ bytes }, old] = await Promise.all([ctx.db.get('driveStats', me), ctx.db.get('driveChunkSize', me, file, i)]);
    if (Number(bytes) - Number(old?.size ?? 0) + body.length > MAX_BYTES) return sendJson(res, 400, { error: 'Your Drive is full. Delete some files first.' });
    await ctx.db.run('putDriveChunk', me, file, i, body, body.length);
    sendJson(res, 200, {});
  },

  // A file deleted for good (or an upload given up): all its pieces go.
  'POST /api/drive/delete': async (req, res, me) => {
    const { file } = await readJson(req, 500);
    if (typeof file !== 'string' || !FILE_RE.test(file)) return sendJson(res, 400, { error: 'Invalid file' });
    await ctx.db.run('delDriveFile', me, file);
    sendJson(res, 200, {});
  },
};

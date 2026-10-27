// Notes and diary entries. Each is sealed on the device with a key only the account's own devices
// can derive (from its identity key), so the server stores an opaque blob per note (its random id,
// the ciphertext, when it last changed) and hands them to the account's other devices.
// Nobody else can read or even list them. An empty body is a deleted note, kept so every device
// learns of the deletion. Notes aren't messages: they are never purged after RETENTION_DAYS.
import { B64_RE } from './config.js';
import { ctx } from './context.js';
import { readJson, sendJson } from './http.js';
import { sendTo } from './hub.js';

const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;
const MAX_BODY = 120_000; // base64 of a sealed note; the app caps the text well below this
const MAX_NOTES = 10_000;
const MAX_BYTES = Number(process.env.NOTES_MAX_BYTES) || 50e6; // all of an account's notes together
const PAGE = 500;

export const routes = {
  // Notes changed at or after `since` (the `updated` of the last one seen), oldest change first.
  'GET /api/notes': async (req, res, me, token, url) => {
    const since = Number(url.searchParams.get('since') || 0);
    if (!Number.isSafeInteger(since) || since < 0) return sendJson(res, 400, { error: 'Invalid since' });
    const notes = await ctx.db.all('notesSince', me, since, PAGE);
    sendJson(res, 200, { notes, more: notes.length === PAGE });
  },

  'POST /api/notes': async (req, res, me, token) => {
    const { id, body } = await readJson(req, MAX_BODY + 1000);
    if (typeof id !== 'string' || !ID_RE.test(id)) return sendJson(res, 400, { error: 'Invalid note' });
    if (typeof body !== 'string' || body.length > MAX_BODY || (body && !B64_RE.test(body))) return sendJson(res, 400, { error: 'That note is too long' });
    const stats = await ctx.db.get('noteStats', me);
    if (stats.n >= MAX_NOTES && !(await ctx.db.get('getNote', me, id))) return sendJson(res, 400, { error: `You can keep up to ${MAX_NOTES} notes` });
    // Counts the note's old version too when it's being edited: a little strict near the limit, but
    // one query. Deleting (an empty body) is always allowed, so there's a way back under it.
    if (body && Number(stats.bytes) + body.length > MAX_BYTES) return sendJson(res, 400, { error: 'Your notes are using all their space. Delete some first.' });
    // Always later than the account's previous change, so syncing "since the last one" never skips one.
    const updated = Math.max(Date.now(), Number(stats.last) + 1);
    await ctx.db.run('putNote', me, id, body, updated);
    sendTo(me, { t: 'notes' }); // the account's other devices fetch the change
    sendJson(res, 200, { updated });
  },
};

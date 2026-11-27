// Notes and diary entries. Each is sealed on the device with a key only the account's own devices
// can derive (from its identity key), so the server stores an opaque blob per note (its random id,
// the ciphertext, when it last changed) and hands them to the account's other devices.
// Nobody else can read or even list them, unless you share one with a friend: then a copy sealed with
// the key the two of you share is kept for them (shared_notes), and they see it in their diary. An empty body is a deleted note, kept so every device
// learns of the deletion. Notes aren't messages: they are never purged after RETENTION_DAYS.
import { B64_RE } from './config.js';
import { ctx } from './context.js';
import { canChat } from './friends.js';
import { readJson, sendJson } from './http.js';
import { sendTo } from './hub.js';
import { getProfile } from './profiles.js';
import { notify } from './push.js';

const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;
const MAX_BODY = 120_000; // base64 of a sealed note; the app caps the text well below this
const MAX_NOTES = 10_000;
const MAX_BYTES = Number(process.env.NOTES_MAX_BYTES) || 50e6; // all of an account's notes together
const PAGE = 500;
const MAX_SHARED = 20_000;  // copies of your notes held for friends, all together
const MAX_SHARED_BYTES = Number(process.env.SHARED_NOTES_MAX_BYTES) || 50e6;
const USER_RE = /^[a-z0-9_.]{3,24}$/;

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

  // Notes shared with me: each friend's copy for me, sealed with the key we share. Oldest change first;
  // an empty body means they stopped sharing it (or deleted it).
  'GET /api/notes/shared': async (req, res, me, token, url) => {
    const since = Number(url.searchParams.get('since') || 0);
    if (!Number.isSafeInteger(since) || since < 0) return sendJson(res, 400, { error: 'Invalid since' });
    const notes = await ctx.db.all('sharedNotesFor', me, since, PAGE);
    sendJson(res, 200, { notes, more: notes.length === PAGE });
  },

  // Share one of my notes with a friend (a copy sealed for them), update it, or stop sharing (empty body).
  'POST /api/notes/share': async (req, res, me) => {
    const { id, to, body } = await readJson(req, MAX_BODY + 1000);
    if (typeof id !== 'string' || !ID_RE.test(id) || typeof to !== 'string' || !USER_RE.test(to) || to === me) return sendJson(res, 400, { error: 'Invalid note' });
    if (typeof body !== 'string' || body.length > MAX_BODY || (body && !B64_RE.test(body))) return sendJson(res, 400, { error: 'That note is too long' });
    const had = await ctx.db.get('getSharedNote', me, id, to);
    if (!body && !had) return sendJson(res, 200, { updated: 0 }); // was never shared with them
    // Stopping is always allowed (even after unfriending); sharing only with friends.
    if (body && !(await canChat(me, to))) return sendJson(res, 400, { error: 'You can only share notes with friends' });
    const stats = await ctx.db.get('sharedNoteStats', me);
    if (body && !had && stats.n >= MAX_SHARED) return sendJson(res, 400, { error: `You can share up to ${MAX_SHARED} notes` });
    if (body && Number(stats.bytes) + body.length > MAX_SHARED_BYTES) return sendJson(res, 400, { error: 'Your shared notes are using all their space. Stop sharing some first.' });
    // Later than anything already shared with them, so their "since the last one" never skips one.
    const updated = Math.max(Date.now(), Number((await ctx.db.get('sharedNoteLast', to)).last) + 1);
    await ctx.db.run('putSharedNote', me, id, to, body, updated);
    sendTo(to, { t: 'notes' });
    // Newly shared with them (not each edit after): a pop-up if Sanga is open, else a notification.
    // Only who shared it, never what the note says.
    if (body && !Number(had?.live)) {
      const name = (await getProfile(me)).name || me;
      sendTo(to, { t: 'nshare', from: me, name });
      notify(to, { t: 'nshare', from: me, name }, `${to}|n|${me}`, true).catch(() => {});
    }
    sendJson(res, 200, { updated });
  },
};

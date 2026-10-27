// Stories: a photo or a few words that friends can see for 24 hours, like, comment on and be tagged in.
// Each story is sealed on the device with its own random key; the server keeps the ciphertext and
// that key wrapped separately for every friend the owner shared it with (and the owner's own devices),
// so it only ever hands a story to those people and can't read it itself. Comments are sealed with
// the commenter and owner's conversation key, and only the owner and the comment's author get them back.
// Who viewed and who liked are plain usernames: the owner is shown them, like on any other app.
import { B64_RE, USER_RE } from './config.js';
import { ctx } from './context.js';
import { rateLimited, readJson, sendJson } from './http.js';
import { isActive, sendTo } from './hub.js';
import { canChat } from './friends.js';
import { getProfile } from './profiles.js';
import { notify } from './push.js';

export const STORY_MS = 24 * 3600e3;
const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;
const MAX_BODY = 2_200_000;   // base64 of a sealed photo story (the app sends photos of at most ~1.4 MB)
const MAX_KEY = 200;          // a wrapped 32-byte key
const MAX_COMMENT = 4000;
const MAX_AUDIENCE = 1000;
const MAX_ACTIVE = 30;        // stories per person at a time
const MAX_BYTES = Number(process.env.STORIES_MAX_BYTES) || 30e6; // all of a person's current stories
const MAX_COMMENTS = 50;      // per person per story

// The story, if `me` may see it: they were given its key and are still friends with its owner.
async function visible(me, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  const s = await ctx.db.get('getStory', id, Date.now());
  if (!s) return null;
  if (s.owner !== me && (!(await ctx.db.get('getStoryKey', id, me)) || !(await canChat(s.owner, me)))) return null;
  return s;
}

async function removeStory(id) {
  for (const q of ['deleteStoryComments', 'deleteStoryViews', 'deleteStoryKeys', 'deleteStory']) await ctx.db.run(q, id);
}

/** Expired stories go, with their keys, views and comments. */
export async function purgeStories() {
  for (;;) {
    const rows = await ctx.db.all('expiredStories', Date.now());
    for (const r of rows) await removeStory(r.id);
    if (rows.length < 500) return;
  }
}

const nameOf = async (u) => (await getProfile(u)).name || u;

// Tell everyone who can see a story that something about it changed; they refetch.
async function announce(id, owner, extra = {}) {
  for (const { viewer } of await ctx.db.all('storyViewers', id)) sendTo(viewer, { t: 'story', u: owner, ...extra });
}

export const routes = {
  // Every story I may see (mine included), oldest first, with my key for it and whether I've seen it.
  'GET /api/stories': async (req, res, me) => {
    const out = [];
    const ok = new Map();
    for (const r of await ctx.db.all('storiesFor', me, me, Date.now())) {
      if (r.owner !== me) {
        if (!ok.has(r.owner)) ok.set(r.owner, await canChat(r.owner, me));
        if (!ok.get(r.owner)) continue;
      }
      const s = { id: r.id, u: r.owner, ts: Number(r.ts), exp: Number(r.expires), key: r.key, seen: r.seen != null, liked: !!r.liked };
      if (r.owner === me) {
        const views = (await ctx.db.all('storyViews', r.id)).filter((v) => v.viewer !== me);
        s.views = views.filter((v) => v.ts).length;
        s.likes = views.filter((v) => v.liked).length;
      }
      out.push(s);
    }
    sendJson(res, 200, { stories: out });
  },

  'GET /api/stories/body': async (req, res, me, token, url) => {
    const s = await visible(me, url.searchParams.get('id'));
    if (!s) return sendJson(res, 404, { error: 'This story is no longer available' });
    sendJson(res, 200, { body: s.body });
  },

  // keys: [{u, key}] for each friend who may see it, and for me (my other devices).
  // tags: friends tagged in it (they must be among those who can see it); they get a notification.
  'POST /api/stories': async (req, res, me) => {
    if (rateLimited('story:' + me, 20, 3600e3)) return sendJson(res, 429, { error: 'Too many stories for now. Try again later.' });
    const { id, body, keys, tags = [] } = await readJson(req, MAX_BODY + MAX_AUDIENCE * (MAX_KEY + 60) + 2000);
    if (typeof id !== 'string' || !ID_RE.test(id)) return sendJson(res, 400, { error: 'Invalid story' });
    if (typeof body !== 'string' || !body || body.length > MAX_BODY || !B64_RE.test(body)) return sendJson(res, 400, { error: 'That story is too large' });
    if (!Array.isArray(keys) || !keys.length || keys.length > MAX_AUDIENCE + 1) return sendJson(res, 400, { error: 'Invalid story' });
    if (!Array.isArray(tags) || tags.length > 20 || !tags.every((t) => typeof t === 'string' && USER_RE.test(t))) return sendJson(res, 400, { error: 'Invalid tags' });
    const audience = new Map();
    for (const k of keys) {
      if (typeof k?.u !== 'string' || !USER_RE.test(k.u) || typeof k.key !== 'string' || k.key.length > MAX_KEY || !B64_RE.test(k.key)) {
        return sendJson(res, 400, { error: 'Invalid story' });
      }
      if (k.u === me || await canChat(me, k.u)) audience.set(k.u, k.key); // people no longer friends are left out
    }
    if (!audience.has(me)) return sendJson(res, 400, { error: 'Invalid story' });
    const mine = await ctx.db.get('storyCount', me, Date.now());
    if (mine.n >= MAX_ACTIVE) return sendJson(res, 400, { error: `You can have up to ${MAX_ACTIVE} stories at a time. Delete one first.` });
    if (Number(mine.bytes) + body.length > MAX_BYTES) return sendJson(res, 400, { error: 'Your stories are using all their space. Delete one first.' });
    const ts = Date.now();
    if (!(await ctx.db.run('insertStory', id, me, body, ts, ts + STORY_MS)).changes) return sendJson(res, 400, { error: 'Invalid story' });
    for (const [u, key] of audience) await ctx.db.run('insertStoryKey', id, u, key);
    const tagged = [...new Set(tags)].filter((t) => t !== me && audience.has(t));
    for (const u of audience.keys()) sendTo(u, { t: 'story', u: me, ...(tagged.includes(u) && { tag: id }) });
    if (tagged.length) {
      const name = await nameOf(me);
      for (const u of tagged) if (!isActive(u)) notify(u, { t: 'stag', from: me, name }).catch(() => {});
    }
    sendJson(res, 200, { id, ts, exp: ts + STORY_MS });
  },

  'POST /api/stories/delete': async (req, res, me) => {
    const { id } = await readJson(req);
    const s = await visible(me, id);
    if (!s || s.owner !== me) return sendJson(res, 404, { error: 'Story not found' });
    const viewers = await ctx.db.all('storyViewers', id);
    await removeStory(id);
    for (const { viewer } of viewers) sendTo(viewer, { t: 'story', u: me, gone: id });
    sendJson(res, 200, { ok: true });
  },

  'POST /api/stories/view': async (req, res, me) => {
    const { id } = await readJson(req);
    const s = await visible(me, id);
    if (!s) return sendJson(res, 404, { error: 'This story is no longer available' });
    if (s.owner !== me && (await ctx.db.run('viewStory', id, me, Date.now())).changes) sendTo(s.owner, { t: 'story', u: s.owner, act: id });
    sendJson(res, 200, { ok: true });
  },

  'POST /api/stories/like': async (req, res, me) => {
    const { id, on } = await readJson(req);
    const s = await visible(me, id);
    if (!s || s.owner === me) return sendJson(res, 404, { error: 'This story is no longer available' });
    await ctx.db.run('likeStory', id, me, Date.now(), on ? 1 : 0);
    sendTo(s.owner, { t: 'story', u: s.owner, act: id, ...(on && { like: me }) });
    sendTo(me, { t: 'story', u: s.owner }); // my other devices
    sendJson(res, 200, { ok: true });
  },

  // A comment, sealed between its author and the story's owner. Only they see it.
  'POST /api/stories/comment': async (req, res, me) => {
    if (rateLimited('scomment:' + me, 60, 60e3)) return sendJson(res, 429, { error: 'Slow down' });
    const { id, cid, body } = await readJson(req, MAX_COMMENT + 500);
    const s = await visible(me, id);
    if (!s) return sendJson(res, 404, { error: 'This story is no longer available' });
    if (typeof cid !== 'string' || !ID_RE.test(cid) || typeof body !== 'string' || !body || body.length > MAX_COMMENT || !B64_RE.test(body)) {
      return sendJson(res, 400, { error: 'That comment is too long' });
    }
    if ((await ctx.db.get('commentCount', id, me)).n >= MAX_COMMENTS) return sendJson(res, 400, { error: 'You’ve commented a lot on this story already' });
    const ts = Date.now();
    await ctx.db.run('insertComment', cid, id, me, body, ts);
    sendTo(s.owner, { t: 'story', u: s.owner, act: id, ...(s.owner !== me && { cmt: me }) });
    if (s.owner !== me) {
      sendTo(me, { t: 'story', u: s.owner, act: id });
      if (!isActive(s.owner)) notify(s.owner, { t: 'scmt', from: me, name: await nameOf(me) }, `${s.owner}|sc|${me}`).catch(() => {});
    }
    sendJson(res, 200, { ts });
  },

  'POST /api/stories/comment/delete': async (req, res, me) => {
    const { id, cid } = await readJson(req);
    const s = await visible(me, id);
    const c = s && typeof cid === 'string' && await ctx.db.get('getComment', id, cid);
    if (!c || (c.author !== me && s.owner !== me)) return sendJson(res, 404, { error: 'Comment not found' });
    await ctx.db.run('deleteComment', id, cid);
    sendTo(s.owner, { t: 'story', u: s.owner, act: id });
    if (c.author !== s.owner) sendTo(c.author, { t: 'story', u: s.owner, act: id });
    sendJson(res, 200, { ok: true });
  },

  // The owner gets who viewed, who liked and every comment; anyone else, just their own comments.
  'GET /api/stories/activity': async (req, res, me, token, url) => {
    const id = url.searchParams.get('id');
    const s = await visible(me, id);
    if (!s) return sendJson(res, 404, { error: 'This story is no longer available' });
    const comments = (await ctx.db.all('storyComments', id)).filter((c) => s.owner === me || c.author === me)
      .map((c) => ({ id: c.id, u: c.author, b: c.body, ts: Number(c.ts) }));
    if (s.owner !== me) return sendJson(res, 200, { comments });
    const views = (await ctx.db.all('storyViews', id)).filter((v) => v.viewer !== me)
      .map((v) => ({ u: v.viewer, ts: Number(v.ts), liked: !!v.liked }));
    sendJson(res, 200, { views, comments });
  },
};

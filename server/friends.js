// Friend requests and blocking. People can only message, see presence and fetch keys of
// accepted friends whom neither side has blocked. Enforced here, not just in the UI.
import { ctx } from './context.js';
import { USER_RE } from './config.js';
import { rateLimited, readJson, sendJson } from './http.js';
import { sendTo } from './hub.js';
import { avatarVersion, getProfile, profileHooks } from './profiles.js';

const pair = (x, y) => (x < y ? [x, y] : [y, x]);

// Cache of "may these two chat?" so message relaying doesn't query the database every time.
const chatCache = new Map();
const invalidate = (x, y) => chatCache.delete(pair(x, y).join('|'));

export async function canChat(x, y) {
  if (x === y) return false;
  const [a, b] = pair(x, y);
  const key = a + '|' + b;
  let ok = chatCache.get(key);
  if (ok === undefined) {
    const [f, blk] = await Promise.all([ctx.db.get('getFriendship', a, b), ctx.db.get('getBlock', a, b, b, a)]);
    ok = f?.status === 'accepted' && !blk;
    if (chatCache.size > 20000) chatCache.clear();
    chatCache.set(key, ok);
  }
  return ok;
}

const hasBlocked = async (blocker, blocked) => !!(await ctx.db.get('getBlock', blocker, blocked, blocker, blocked));

// How `other` relates to `me`: none | out (I asked) | in (they asked) | friends.
async function relation(me, other) {
  const f = await ctx.db.get('getFriendship', ...pair(me, other));
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friends';
  return f.requester === me ? 'out' : 'in';
}

export async function friendsOf(u) {
  return (await ctx.db.all('listFriendships', u, u))
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.a === u ? f.b : f.a));
}

profileHooks.friendsOf = friendsOf;
profileHooks.canChat = canChat;
profileHooks.canSee = async (user, viewer) => {
  if (await hasBlocked(user, viewer)) return false;
  return (await relation(viewer, user)) !== 'none';
};

async function card(u) {
  const p = await getProfile(u);
  return { u, name: p.name, about: p.about, av: await avatarVersion(u) };
}

// Both sides refetch their friend lists on {t:'fr'}.
function announce(me, other, extra = {}) {
  sendTo(me, { t: 'fr', u: other });
  sendTo(other, { t: 'fr', u: me, ...extra });
}

// Set by push.js so a new request can notify the recipient's phone.
export const friendHooks = { onRequest: async () => {} };

// One-time migration: people who already exchanged messages become friends.
export async function migrateFriends() {
  if (await ctx.db.get('getConfig', 'friends_migrated')) return 0;
  let n = 0;
  for (const { sender, recipient } of await ctx.db.all('chatPairs')) {
    if (sender === recipient) continue;
    const [a, b] = pair(sender, recipient);
    n += (await ctx.db.run('insertFriendship', a, b, 'accepted', sender, Date.now())).changes;
  }
  await ctx.db.run('setConfig', 'friends_migrated', String(Date.now()));
  return n;
}

async function target(req, me) {
  const { u } = await readJson(req);
  if (typeof u !== 'string' || !USER_RE.test(u) || u === me) return null;
  return (await ctx.db.get('getUser', u)) ? u : null;
}

export const routes = {
  'GET /api/friends': async (req, res, me) => {
    const rows = await ctx.db.all('listFriendships', me, me);
    const friends = [], incoming = [], outgoing = [];
    for (const f of rows) {
      const other = f.a === me ? f.b : f.a;
      if (f.status === 'accepted') {
        const user = await ctx.db.get('getUser', other);
        if (user) friends.push({ ...(await card(other)), pub: user.pubkey, since: f.created });
      } else if (f.requester === me) outgoing.push({ ...(await card(other)), ts: f.created });
      else if (!(await hasBlocked(me, other))) incoming.push({ ...(await card(other)), ts: f.created });
    }
    const blocked = (await ctx.db.all('listBlocks', me)).map((r) => r.blocked);
    sendJson(res, 200, { friends, incoming, outgoing, blocked });
  },

  // Search any user to add them. Shows how each result relates to you.
  'GET /api/users': async (req, res, me, token, url) => {
    const term = String(url.searchParams.get('q') || '').toLowerCase().slice(0, 24).replace(/[\\%_]/g, '\\$&');
    if (term.length < 2) return sendJson(res, 200, { users: [] });
    const users = [];
    for (const { username: u } of await ctx.db.all('searchUsers', term + '%', me)) {
      if (await hasBlocked(u, me)) continue; // people who blocked you don't show up
      const rel = (await hasBlocked(me, u)) ? 'blocked' : await relation(me, u);
      const visible = rel !== 'none' && rel !== 'blocked';
      users.push({ u, rel, ...(visible ? await card(u) : { name: '', about: '', av: 0 }) });
    }
    sendJson(res, 200, { users });
  },

  // A friend's public key (to verify it or after it changed).
  'GET /api/key': async (req, res, me, token, url) => {
    const u = String(url.searchParams.get('u') || '');
    const f = USER_RE.test(u) && u !== me ? await ctx.db.get('getFriendship', ...pair(me, u)) : null;
    const user = f?.status === 'accepted' ? await ctx.db.get('getUser', u) : null;
    if (!user) return sendJson(res, 404, { error: 'Not your friend' });
    sendJson(res, 200, { u: user.username, pub: user.pubkey });
  },

  'POST /api/friends/request': async (req, res, me) => {
    if (rateLimited('fr:' + me, 30, 3600e3)) return sendJson(res, 429, { error: 'Too many requests, try later' });
    const u = await target(req, me);
    if (!u) return sendJson(res, 404, { error: 'No such user' });
    if (await hasBlocked(me, u)) return sendJson(res, 409, { error: 'Unblock them first' });
    if (await hasBlocked(u, me)) return sendJson(res, 403, { error: "You can't add this user" });
    const rel = await relation(me, u);
    const [a, b] = pair(me, u);
    if (rel === 'friends') return sendJson(res, 200, { rel });
    if (rel === 'out') return sendJson(res, 200, { rel });
    if (rel === 'in') { // they already asked: accept
      await ctx.db.run('acceptFriendship', Date.now(), a, b, u);
      invalidate(me, u);
      announce(me, u);
      return sendJson(res, 200, { rel: 'friends' });
    }
    await ctx.db.run('insertFriendship', a, b, 'pending', me, Date.now());
    announce(me, u, { req: 1 });
    friendHooks.onRequest(u, me).catch(() => {});
    sendJson(res, 200, { rel: 'out' });
  },

  'POST /api/friends/accept': async (req, res, me) => {
    const u = await target(req, me);
    if (!u) return sendJson(res, 404, { error: 'No such user' });
    const [a, b] = pair(me, u);
    const { changes } = await ctx.db.run('acceptFriendship', Date.now(), a, b, u);
    if (!changes) return sendJson(res, 404, { error: 'No pending request from them' });
    invalidate(me, u);
    announce(me, u);
    sendJson(res, 200, { rel: 'friends' });
  },

  // Decline a request to me, or cancel mine.
  'POST /api/friends/decline': async (req, res, me) => {
    const u = await target(req, me);
    if (!u) return sendJson(res, 404, { error: 'No such user' });
    const [a, b] = pair(me, u);
    const f = await ctx.db.get('getFriendship', a, b);
    if (!f || f.status !== 'pending') return sendJson(res, 404, { error: 'No pending request' });
    await ctx.db.run('deleteFriendship', a, b);
    announce(me, u);
    sendJson(res, 200, { rel: 'none' });
  },

  'POST /api/friends/remove': async (req, res, me) => {
    const u = await target(req, me);
    if (!u) return sendJson(res, 404, { error: 'No such user' });
    const [a, b] = pair(me, u);
    await ctx.db.run('deleteFriendship', a, b);
    invalidate(me, u);
    announce(me, u);
    sendJson(res, 200, { rel: 'none' });
  },

  // Blocking keeps the friendship (so unblocking restores it) but stops all contact.
  'POST /api/friends/block': async (req, res, me) => {
    const u = await target(req, me);
    if (!u) return sendJson(res, 404, { error: 'No such user' });
    await ctx.db.run('insertBlock', me, u, Date.now());
    const [a, b] = pair(me, u);
    const f = await ctx.db.get('getFriendship', a, b);
    if (f?.status === 'pending') await ctx.db.run('deleteFriendship', a, b);
    invalidate(me, u);
    announce(me, u);
    sendJson(res, 200, { rel: 'blocked' });
  },

  'POST /api/friends/unblock': async (req, res, me) => {
    const u = await target(req, me);
    if (!u) return sendJson(res, 404, { error: 'No such user' });
    await ctx.db.run('deleteBlock', me, u);
    invalidate(me, u);
    announce(me, u);
    sendJson(res, 200, { rel: await relation(me, u) });
  },
};

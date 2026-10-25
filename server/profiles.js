// Display name, about, privacy settings, per-chat mutes and profile photos.
// None of this is end-to-end encrypted (like WhatsApp's profile info); messages are.
import { ctx } from './context.js';
import { B64_RE, USER_RE } from './config.js';
import { readJson, sendBody, sendJson } from './http.js';
import { online, send, sendTo, broadcastPresence, isShownOnline, hooks } from './hub.js';

const DEFAULT_PRIVACY = { lastSeen: true, receipts: true };
const cache = new Map(); // username -> parsed profile

const parse = (s, d) => { try { return { ...d, ...JSON.parse(s) }; } catch { return { ...d }; } };

export async function getProfile(u) {
  let p = cache.get(u);
  if (!p) {
    const row = await ctx.db.get('getProfile', u);
    p = {
      name: row?.name || '',
      about: row?.about || '',
      privacy: parse(row?.privacy, DEFAULT_PRIVACY),
      mutes: parse(row?.mutes, {}),
    };
    if (cache.size > 5000) cache.clear();
    cache.set(u, p);
  }
  return p;
}

async function saveProfile(u, p) {
  await ctx.db.run('setProfile', u, p.name, p.about, JSON.stringify(p.privacy), JSON.stringify(p.mutes));
  cache.set(u, p);
}

export async function avatarVersion(u) {
  return (await ctx.db.get('avatarVer', u))?.ver || 0;
}

// WhatsApp-style reciprocity: if either side turns a setting off, neither sees it.
export async function lastSeenHidden(a, b) {
  const [pa, pb] = await Promise.all([getProfile(a), getProfile(b)]);
  return pa.privacy.lastSeen === false || pb.privacy.lastSeen === false;
}
export async function receiptsHidden(a, b) {
  const [pa, pb] = await Promise.all([getProfile(a), getProfile(b)]);
  return pa.privacy.receipts === false || pb.privacy.receipts === false;
}

export async function isMuted(user, peer) {
  const until = (await getProfile(user)).mutes[peer];
  return until === -1 || (typeof until === 'number' && until > Date.now());
}

// Set by friends.js (avoids an import cycle). canSee: may see photo/name (friends or a pending
// request); canChat: may message and see presence (accepted friends, nobody blocked).
// inGameTogether is set by games.js: people in the same game see each other's photo.
export const profileHooks = { friendsOf: async () => [], canSee: async () => false, canChat: async () => false, inGameTogether: () => false, shareGroup: async () => false };

async function presenceFor(user, viewer) {
  const av = await avatarVersion(user);
  if (viewer !== user && await lastSeenHidden(user, viewer)) return { t: 'pres', u: user, on: false, ls: 0, hid: true, av };
  const on = isShownOnline(user);
  const ls = on ? 0 : ((await ctx.db.get('getUser', user))?.last_seen || 0);
  return { t: 'pres', u: user, on, ls, av };
}
hooks.presenceFor = async (user, viewer) => {
  if (viewer !== user && !(await profileHooks.canChat(user, viewer))) return null;
  return presenceFor(user, viewer);
};
export { presenceFor };

// Tell friends (and my other devices) that my profile changed, so they refetch it.
async function announceProfile(me) {
  sendTo(me, { t: 'prof', u: me });
  for (const f of await profileHooks.friendsOf(me)) sendTo(f, { t: 'prof', u: me });
}

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export function imageType(b) {
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.toString('latin1', 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export const routes = {
  'GET /api/me': async (req, res, me) => {
    const p = await getProfile(me);
    const encPriv = (await ctx.db.get('getUser', me))?.enc_priv; // your own encrypted key backup
    sendJson(res, 200, { u: me, name: p.name, about: p.about, privacy: p.privacy, mutes: p.mutes, av: await avatarVersion(me), encPriv });
  },

  'POST /api/profile': async (req, res, me) => {
    const body = await readJson(req);
    const p = structuredClone(await getProfile(me));
    if ('name' in body) p.name = clean(body.name, 40);
    if ('about' in body) p.about = clean(body.about, 140);
    const privacyChanged = body.privacy && typeof body.privacy === 'object';
    if (privacyChanged) {
      for (const k of Object.keys(DEFAULT_PRIVACY)) {
        if (typeof body.privacy[k] === 'boolean') p.privacy[k] = body.privacy[k];
      }
    }
    await saveProfile(me, p);
    await announceProfile(me);
    if (privacyChanged) {
      await broadcastPresence(me);
      // Reciprocity: what I can see of others changed too.
      for (const ws of online.get(me) || []) {
        for (const u of ws.watching) {
          const frame = await hooks.presenceFor(u, me);
          if (frame) send(ws, frame);
        }
      }
    }
    sendJson(res, 200, { name: p.name, about: p.about, privacy: p.privacy });
  },

  // until: 0 = unmute, -1 = always, otherwise a timestamp.
  'POST /api/mute': async (req, res, me) => {
    const { u, until } = await readJson(req);
    if (typeof u !== 'string' || !(USER_RE.test(u) || /^g:[A-Za-z0-9_-]{12}$/.test(u)) || !Number.isSafeInteger(until) || until < -1) {
      return sendJson(res, 400, { error: 'Invalid mute' });
    }
    const p = structuredClone(await getProfile(me));
    if (until === 0) delete p.mutes[u]; else p.mutes[u] = until;
    for (const [k, v] of Object.entries(p.mutes)) if (v !== -1 && v < Date.now()) delete p.mutes[k];
    await saveProfile(me, p);
    sendTo(me, { t: 'prof', u: me });
    sendJson(res, 200, { mutes: p.mutes });
  },

  // Profile photos are small square images resized on the device.
  'POST /api/avatar': async (req, res, me) => {
    const { img } = await readJson(req, 200_000);
    if (img === null) {
      await ctx.db.run('deleteAvatar', me);
    } else {
      if (typeof img !== 'string' || img.length > 180_000 || !B64_RE.test(img)) return sendJson(res, 400, { error: 'Invalid image' });
      const data = Buffer.from(img, 'base64');
      const type = imageType(data);
      if (!type) return sendJson(res, 400, { error: 'Use a JPEG, PNG or WebP image' });
      await ctx.db.run('setAvatar', me, data, type, Date.now());
    }
    const pres = await presenceFor(me, me);
    sendTo(me, pres); // my other devices
    await broadcastPresence(me);
    sendJson(res, 200, { av: pres.av });
  },

  'GET /api/avatar': async (req, res, me, token, url) => {
    const u = String(url.searchParams.get('u') || '');
    if (u !== me && !profileHooks.inGameTogether(u, me) && !(await profileHooks.canSee(u, me)) && !(await profileHooks.shareGroup(u, me))) return sendJson(res, 404, { error: 'No photo' });
    const row = await ctx.db.get('getAvatar', u);
    if (!row) return sendJson(res, 404, { error: 'No photo' });
    sendBody(req, res, { body: Buffer.from(row.data), type: row.type, etag: `"${row.ver}"`, cache: 'private, no-cache' });
  },
};

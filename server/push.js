// Web Push: notifies a phone when the app is closed. Notifications carry only the sender's name,
// never message content, which stays end-to-end encrypted.
import webpush from 'web-push';
import { ctx } from './context.js';
import { config } from './config.js';
import { readJson, sendJson } from './http.js';
import { getProfile, isMuted } from './profiles.js';
import { friendHooks } from './friends.js';

let publicKey = null;

// VAPID keys come from the environment, or are generated once and kept in the database.
export async function initPush() {
  let keys = config.vapid.publicKey && config.vapid.privateKey ? config.vapid : null;
  if (!keys) {
    const row = await ctx.db.get('getConfig', 'vapid');
    keys = row ? JSON.parse(row.value) : webpush.generateVAPIDKeys();
    if (!row) await ctx.db.run('setConfig', 'vapid', JSON.stringify(keys));
  }
  const subject = config.publicUrl.startsWith('https://') ? config.publicUrl : 'mailto:chattrix@localhost';
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  publicKey = keys.publicKey;
}

// Only real push services, so the server can't be used to make requests to arbitrary hosts.
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/, /(^|\.)wns2-[a-z0-9-]+\.notify\.windows\.com$/];
function allowedEndpoint(s) {
  try {
    const url = new URL(s);
    if (url.protocol !== 'https:') return false;
    return process.env.PUSH_ALLOW_ANY_HOST === '1' || PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch { return false; }
}

const lastSent = new Map(); // "to|kind|from" -> ts, so a burst of messages makes one notification

export async function notify(user, payload, coalesceKey) {
  if (!publicKey) return;
  if (coalesceKey) {
    const now = Date.now();
    if (now - (lastSent.get(coalesceKey) || 0) < 4000) return;
    lastSent.set(coalesceKey, now);
    if (lastSent.size > 10000) lastSent.clear();
  }
  const subs = await ctx.db.all('pushSubsFor', user);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, JSON.stringify(payload),
        { TTL: 86400, urgency: 'high' });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await ctx.db.run('deletePushSub', s.endpoint);
      else console.error('push failed', err.statusCode || err.message);
    }
  }));
}

export async function notifyMessage(to, from) {
  if (await isMuted(to, from)) return;
  const name = (await getProfile(from)).name || from;
  await notify(to, { t: 'msg', from, name }, `${to}|m|${from}`);
}

friendHooks.onRequest = async (to, from) => {
  const name = (await getProfile(from)).name || from;
  await notify(to, { t: 'fr', from, name }, `${to}|f|${from}`);
};

export const routes = {
  'GET /api/push/key': async (req, res) => sendJson(res, 200, { key: publicKey }),

  'POST /api/push/subscribe': async (req, res, me) => {
    const { sub } = await readJson(req);
    const ok = sub && typeof sub.endpoint === 'string' && sub.endpoint.length < 1000 && allowedEndpoint(sub.endpoint) &&
      typeof sub.keys?.p256dh === 'string' && sub.keys.p256dh.length < 200 &&
      typeof sub.keys?.auth === 'string' && sub.keys.auth.length < 100;
    if (!ok) return sendJson(res, 400, { error: 'Invalid subscription' });
    // An endpoint already registered to another account stays theirs: otherwise anyone who learned it
    // could cut that browser off from its account's notifications and send it their own. (Signing out
    // unsubscribes the browser, so the next account to sign in there gets a new endpoint.)
    const { changes } = await ctx.db.run('setPushSub', sub.endpoint, me, JSON.stringify({ p256dh: sub.keys.p256dh, auth: sub.keys.auth }), Date.now());
    if (!changes) return sendJson(res, 409, { error: 'This browser is set up for notifications for another account' });
    sendJson(res, 200, { ok: true });
  },

  'POST /api/push/unsubscribe': async (req, res, me) => {
    const { endpoint } = await readJson(req);
    if (typeof endpoint === 'string') await ctx.db.run('deletePushSubOf', endpoint, me); // only my own
    sendJson(res, 200, { ok: true });
  },
};

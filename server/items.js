// The other apps' records (the calendar's events, holidays and fast log; later others). Like notes,
// each is sealed on the device with a key only the account's own devices can derive, so the server
// keeps an opaque blob per record (its random id, the ciphertext, when it last changed), per app,
// and hands them to the account's other devices. An empty body is a deleted record, kept so every
// device learns of the deletion.
import { B64_RE } from './config.js';
import { ctx } from './context.js';
import { readJson, sendJson } from './http.js';
import { sendTo } from './hub.js';

export const ITEM_APPS = ['calendar'];
const ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const MAX_BODY = 60_000;
const MAX_ITEMS = 20_000;
const MAX_BYTES = Number(process.env.ITEMS_MAX_BYTES) || 30e6; // per app, all of an account's records
const PAGE = 500;

const appOf = (url) => {
  const app = url.searchParams.get('app');
  return ITEM_APPS.includes(app) ? app : null;
};

export const routes = {
  // Records changed at or after `since` (the `updated` of the last one seen), oldest change first.
  'GET /api/items': async (req, res, me, token, url) => {
    const app = appOf(url);
    const since = Number(url.searchParams.get('since') || 0);
    if (!app) return sendJson(res, 400, { error: 'Unknown app' });
    if (!Number.isSafeInteger(since) || since < 0) return sendJson(res, 400, { error: 'Invalid since' });
    const items = await ctx.db.all('itemsSince', me, app, since, PAGE);
    sendJson(res, 200, { items, more: items.length === PAGE });
  },

  'POST /api/items': async (req, res, me, token, url) => {
    const app = appOf(url);
    if (!app) return sendJson(res, 400, { error: 'Unknown app' });
    const { id, body } = await readJson(req, MAX_BODY + 1000);
    if (typeof id !== 'string' || !ID_RE.test(id)) return sendJson(res, 400, { error: 'Invalid record' });
    if (typeof body !== 'string' || body.length > MAX_BODY || (body && !B64_RE.test(body))) return sendJson(res, 400, { error: 'That is too long' });
    const stats = await ctx.db.get('itemStats', me, app);
    if (stats.n >= MAX_ITEMS && !(await ctx.db.get('getItem', me, app, id))) return sendJson(res, 400, { error: `You can keep up to ${MAX_ITEMS} of these` });
    // Deleting (an empty body) is always allowed, so there's a way back under the limit.
    if (body && Number(stats.bytes) + body.length > MAX_BYTES) return sendJson(res, 400, { error: 'This app is using all its space. Delete some first.' });
    // Always later than the account's previous change, so syncing "since the last one" never skips one.
    const updated = Math.max(Date.now(), Number(stats.last) + 1);
    await ctx.db.run('putItem', me, app, id, body, updated);
    sendTo(me, { t: app }); // the account's other devices fetch the change
    sendJson(res, 200, { updated });
  },
};

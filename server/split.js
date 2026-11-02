// Split: shared expenses between friends. End-to-end encrypted: each group has a random key that
// only its members' devices hold (wrapped for each member with the key they share with whoever added
// them). The server keeps who is in a group, plus sealed records (the group's name and people, each
// expense and settlement) and sealed bill photos, and lets only members read or write them.
// The creator's own copy of the key is wrapped with their own key (`wrapper` is themselves); that
// is how the creator is told apart from the others.
import { B64_RE } from './config.js';
import { ctx } from './context.js';
import { canChat } from './friends.js';
import { readJson, sendJson } from './http.js';
import { sendTo } from './hub.js';

const GID_RE = /^[A-Za-z0-9_-]{12,40}$/;
const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
const MAX_RECORD = 60_000;
const MAX_BILL = 2_500_000;          // one sealed bill photo (base64 text)
const MAX_RECORDS = 20_000;          // per group
const MAX_BYTES = Number(process.env.SPLIT_MAX_BYTES) || 30e6;       // records per group
const MAX_BILL_BYTES = Number(process.env.SPLIT_MAX_BILL_BYTES) || 200e6; // bills per group
const MAX_MEMBERS = 50;
const MAX_GROUPS = 100;              // per person
const PAGE = 500;

const memberNames = async (gid) => (await ctx.db.all('splitMembers', gid)).map((m) => m.username);
const tell = async (gid, extra = []) => {
  for (const u of new Set([...(await memberNames(gid)), ...extra])) sendTo(u, { t: 'split', g: gid });
};
const validKey = (w) => typeof w === 'string' && w.length > 20 && w.length < 400 && B64_RE.test(w);

/** The caller's membership of ?gid=, or null after answering 404 (a stranger learns nothing about groups). */
async function member(res, me, gid) {
  if (typeof gid !== 'string' || !GID_RE.test(gid)) { sendJson(res, 400, { error: 'Invalid group' }); return null; }
  const m = await ctx.db.get('splitMember', gid, me);
  if (!m) { sendJson(res, 404, { error: 'Group not found' }); return null; }
  return m;
}

export const routes = {
  // Every group I'm in: my wrapped key and who is in it.
  'GET /api/split': async (req, res, me) => {
    const mine = await ctx.db.all('splitGroupsFor', me);
    const groups = await Promise.all(mine.map(async (g) => ({
      gid: g.gid, wrapper: g.wrapper, wrapped: g.wrapped,
      members: (await ctx.db.all('splitMembers', g.gid)).map((m) => ({ u: m.username, owner: m.wrapper === m.username })),
    })));
    sendJson(res, 200, { groups });
  },

  // A new group; the creator is its first member.
  'POST /api/split/create': async (req, res, me) => {
    const { gid, wrapped } = await readJson(req, 2000);
    if (typeof gid !== 'string' || !GID_RE.test(gid) || !validKey(wrapped)) return sendJson(res, 400, { error: 'Invalid group' });
    if ((await ctx.db.all('splitMembers', gid)).length) return sendJson(res, 400, { error: 'Invalid group' });
    if ((await ctx.db.all('splitGroupsFor', me)).length >= MAX_GROUPS) return sendJson(res, 400, { error: `You can be in up to ${MAX_GROUPS} groups` });
    await ctx.db.run('addSplitMember', gid, me, me, wrapped, Date.now());
    sendJson(res, 200, {});
  },

  // Add a friend. The caller sends the group key wrapped for them.
  'POST /api/split/add': async (req, res, me) => {
    const { gid, u, wrapped } = await readJson(req, 2000);
    if (!(await member(res, me, gid))) return;
    if (typeof u !== 'string' || !validKey(wrapped)) return sendJson(res, 400, { error: 'Invalid request' });
    if (!(await canChat(me, u))) return sendJson(res, 400, { error: 'You can only add your friends' });
    if ((await ctx.db.all('splitGroupsFor', u)).length >= MAX_GROUPS) return sendJson(res, 400, { error: 'They are in too many groups' });
    const members = await memberNames(gid);
    if (members.includes(u)) return sendJson(res, 200, {});
    if (members.length >= MAX_MEMBERS) return sendJson(res, 400, { error: `A group can have up to ${MAX_MEMBERS} people` });
    await ctx.db.run('addSplitMember', gid, u, me, wrapped, Date.now());
    await tell(gid);
    sendJson(res, 200, {});
  },

  // Leave a group, or (the creator only) remove someone. An empty group is deleted with all it holds.
  'POST /api/split/remove': async (req, res, me) => {
    const { gid, u } = await readJson(req, 500);
    const mine = await member(res, me, gid);
    if (!mine) return;
    const who = u || me;
    if (who !== me && mine.wrapper !== me) return sendJson(res, 403, { error: 'Only the person who made the group can remove people' });
    const before = await memberNames(gid);
    if (!before.includes(who)) return sendJson(res, 200, {});
    await ctx.db.run('delSplitMember', gid, who);
    if (before.length === 1) await Promise.all(['delSplitRecords', 'delSplitBills', 'delSplitMembers'].map((q) => ctx.db.run(q, gid)));
    await tell(gid, [who]);
    sendJson(res, 200, {});
  },

  // Sealed records changed at or after `since`, oldest first. An empty body is a deleted record.
  'GET /api/split/records': async (req, res, me, token, url) => {
    const gid = url.searchParams.get('gid');
    const since = Number(url.searchParams.get('since') || 0);
    if (!(await member(res, me, gid))) return;
    if (!Number.isSafeInteger(since) || since < 0) return sendJson(res, 400, { error: 'Invalid since' });
    const items = await ctx.db.all('splitSince', gid, since, PAGE);
    sendJson(res, 200, { items, more: items.length === PAGE });
  },

  'POST /api/split/records': async (req, res, me, token, url) => {
    const gid = url.searchParams.get('gid');
    if (!(await member(res, me, gid))) return;
    const { id, body } = await readJson(req, MAX_RECORD + 1000);
    if (typeof id !== 'string' || !ID_RE.test(id)) return sendJson(res, 400, { error: 'Invalid record' });
    if (typeof body !== 'string' || body.length > MAX_RECORD || (body && !B64_RE.test(body))) return sendJson(res, 400, { error: 'That is too long' });
    const stats = await ctx.db.get('splitStats', gid);
    if (stats.n >= MAX_RECORDS && !(await ctx.db.get('getSplitRecord', gid, id))) return sendJson(res, 400, { error: 'This group has reached its limit' });
    if (body && Number(stats.bytes) + body.length > MAX_BYTES) return sendJson(res, 400, { error: 'This group is out of space' });
    // Always later than the group's previous change, so "since the last one" never skips one.
    const updated = Math.max(Date.now(), Number(stats.last) + 1);
    await ctx.db.run('putSplitRecord', gid, id, body, updated);
    await tell(gid);
    sendJson(res, 200, { updated });
  },

  // Sealed bill photos are fetched one at a time, only when someone opens a bill.
  'GET /api/split/bill': async (req, res, me, token, url) => {
    const gid = url.searchParams.get('gid'), id = url.searchParams.get('id');
    if (!(await member(res, me, gid))) return;
    if (!id || !ID_RE.test(id)) return sendJson(res, 400, { error: 'Invalid bill' });
    const row = await ctx.db.get('getSplitBill', gid, id);
    if (!row) return sendJson(res, 404, { error: 'Bill not found' });
    sendJson(res, 200, { body: row.body });
  },

  'POST /api/split/bill': async (req, res, me, token, url) => {
    const gid = url.searchParams.get('gid');
    if (!(await member(res, me, gid))) return;
    const { id, body } = await readJson(req, MAX_BILL + 1000);
    if (typeof id !== 'string' || !ID_RE.test(id)) return sendJson(res, 400, { error: 'Invalid bill' });
    if (typeof body !== 'string' || !body || body.length > MAX_BILL || !B64_RE.test(body)) return sendJson(res, 400, { error: 'That bill is too big' });
    const stats = await ctx.db.get('splitBillStats', gid);
    if (Number(stats.bytes) + body.length > MAX_BILL_BYTES) return sendJson(res, 400, { error: 'This group is out of space for bills' });
    await ctx.db.run('putSplitBill', gid, id, body);
    sendJson(res, 200, {});
  },

  'POST /api/split/bill/delete': async (req, res, me, token, url) => {
    const gid = url.searchParams.get('gid');
    if (!(await member(res, me, gid))) return;
    const { id } = await readJson(req, 500);
    if (typeof id !== 'string' || !ID_RE.test(id)) return sendJson(res, 400, { error: 'Invalid bill' });
    await ctx.db.run('delSplitBill', gid, id);
    sendJson(res, 200, {});
  },
};

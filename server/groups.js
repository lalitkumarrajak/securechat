// Groups: up to 50 people, end-to-end encrypted. The server knows who's in each group and stores
// each group message once (addressed to "g:<id>"); members sync the messages sent after they
// joined. Message keys never reach the server: each member's app makes its own sending key for
// the group and hands it to the others inside ordinary pairwise-encrypted messages ("gkey"),
// replacing it whenever someone leaves or is removed (the group's "epoch" goes up).
//
// Membership changes are announced as small unencrypted system rows ("sys:{…}"), like the
// server-visible facts they are: who added or removed whom.
import crypto from 'node:crypto';
import { B64_RE } from './config.js';
import { ctx, nextSeq } from './context.js';
import { readJson, rateLimited, sendBody, sendJson } from './http.js';
import { isActive, sendTo } from './hub.js';
import { canChat } from './friends.js';
import { getProfile, imageType, isMuted, profileHooks } from './profiles.js';
import { notify } from './push.js';

export const MAX_MEMBERS = 50;
const ID_RE = /^[A-Za-z0-9_-]{12}$/;
export const GROUP_PEER_RE = /^g:[A-Za-z0-9_-]{12}$/;
export const isGroupPeer = (s) => typeof s === 'string' && GROUP_PEER_RE.test(s);

const newId = () => crypto.randomBytes(9).toString('base64url');
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const memberOf = (gid, u) => ctx.db.get('getMember', gid, u);
export const shareGroup = async (a, b) => !!(await ctx.db.get('shareGroup', a, b));
profileHooks.shareGroup = shareGroup;
export const memberNames = async (gid) => (await ctx.db.all('groupMembers', gid)).map((m) => m.username);

const rowOut = (r) => ({ id: r.id, cid: r.cid, f: r.sender, to: r.recipient, b: r.body, ts: r.ts, s: r.status, seq: r.seq });

/** Deliver a stored group row to every member's open apps (except the sending socket). */
export async function fanout(row, except) {
  const frame = { t: 'm', ...rowOut(row) };
  for (const u of await memberNames(row.recipient.slice(2))) sendTo(u, frame, except);
}

/** Push notifications for a group message, to members who aren't looking at the app. */
export async function notifyGroup(gid, from, mentioned = []) {
  const g = await ctx.db.get('getGroup', gid);
  if (!g) return;
  const name = (await getProfile(from)).name || from;
  for (const u of await memberNames(gid)) {
    if (u === from || isActive(u)) continue;
    const tagged = mentioned.includes(u);
    if (!tagged && await isMuted(u, 'g:' + gid)) continue;
    notify(u, { t: 'gmsg', from, name, group: g.name, peer: 'g:' + gid, ...(tagged && { mention: 1 }) }, `${u}|g|${gid}`).catch(() => {});
  }
}

// A visible note in the chat ("Lalit added Rakhi"), sent to everyone in the group.
async function systemNote(gid, actor, ev) {
  const cid = 'sys' + newId();
  await ctx.db.run('insertMsg', nextSeq(), cid, actor, 'g:' + gid, 'sys:' + JSON.stringify(ev), Date.now());
  await fanout(await ctx.db.get('getMsgByCid', actor, cid));
}

// Tell members (and anyone just removed) to refresh this group.
async function changed(gid, extra = []) {
  for (const u of new Set([...(await memberNames(gid)), ...extra])) sendTo(u, { t: 'grp', id: gid });
}

async function groupOut(g, viewer) {
  const rows = await ctx.db.all('groupMembers', g.id);
  const me = rows.find((r) => r.username === viewer);
  const members = await Promise.all(rows.map(async (r) => ({
    u: r.username, n: (await getProfile(r.username)).name || '', pub: r.pubkey, admin: !!r.admin, joined: Number(r.joined),
  })));
  return {
    id: g.id, name: g.name, about: g.about, creator: g.creator, created: Number(g.created), epoch: Number(g.epoch),
    adminsOnly: !!g.admins_only, photo: Number(g.photo_ver), members, admin: !!me?.admin,
    ...(me?.admin && g.link && { link: g.link }),
  };
}

// Loads the group and checks the caller's role; answers the request itself on failure.
async function load(res, me, id, { admin = false } = {}) {
  const g = typeof id === 'string' && ID_RE.test(id) ? await ctx.db.get('getGroup', id) : null;
  const m = g && await memberOf(g.id, me);
  if (!g || !m) { sendJson(res, 404, { error: 'Group not found' }); return null; }
  if (admin && !m.admin) { sendJson(res, 403, { error: 'Only group admins can do that' }); return null; }
  return g;
}

async function addPeople(g, users) {
  const seq = ctx.seq; // they'll see messages sent from now on
  const now = Date.now();
  for (const u of users) await ctx.db.run('addMember', g.id, u, 0, now, seq);
}

const blockedBetween = async (a, b) => !!(await ctx.db.get('getBlock', a, b, b, a));

export const routes = {
  'GET /api/groups': async (req, res, me) => {
    const groups = await ctx.db.all('groupsOf', me);
    sendJson(res, 200, { groups: await Promise.all(groups.map((g) => groupOut(g, me))) });
  },

  'POST /api/groups': async (req, res, me) => {
    if (rateLimited('newgroup:' + me, 20, 3600e3)) return sendJson(res, 429, { error: 'Slow down' });
    const { name, about, members } = await readJson(req);
    const title = str(name, 60);
    if (!title) return sendJson(res, 400, { error: 'Give the group a name' });
    const list = Array.isArray(members) ? [...new Set(members)].filter((u) => u !== me) : [];
    if (list.length > MAX_MEMBERS - 1) return sendJson(res, 400, { error: `A group can have up to ${MAX_MEMBERS} people` });
    for (const u of list) if (typeof u !== 'string' || !(await canChat(me, u))) return sendJson(res, 400, { error: 'You can only add your friends' });
    const id = newId();
    await ctx.db.run('insertGroup', id, title, str(about, 300), me, Date.now(), '');
    await ctx.db.run('addMember', id, me, 1, Date.now(), ctx.seq);
    const g = await ctx.db.get('getGroup', id);
    await addPeople(g, list);
    await systemNote(id, me, { e: 'create', name: title, ...(list.length && { u: list }) });
    await changed(id);
    sendJson(res, 200, { group: await groupOut(g, me) });
  },

  'POST /api/groups/update': async (req, res, me) => {
    const { id, name, about, adminsOnly } = await readJson(req);
    const g = await load(res, me, id, { admin: true });
    if (!g) return;
    const next = {
      name: name === undefined ? g.name : str(name, 60), about: about === undefined ? g.about : str(about, 300),
      admins_only: adminsOnly === undefined ? g.admins_only : (adminsOnly ? 1 : 0),
    };
    if (!next.name) return sendJson(res, 400, { error: 'Give the group a name' });
    await ctx.db.run('updateGroup', next.name, next.about, next.admins_only, g.id);
    if (next.name !== g.name) await systemNote(g.id, me, { e: 'name', name: next.name });
    if (next.admins_only !== g.admins_only) await systemNote(g.id, me, { e: 'adminsOnly', on: !!next.admins_only });
    if (next.about !== g.about) await systemNote(g.id, me, { e: 'about' });
    await changed(g.id);
    sendJson(res, 200, { group: await groupOut(await ctx.db.get('getGroup', g.id), me) });
  },

  'POST /api/groups/add': async (req, res, me) => {
    const { id, users } = await readJson(req);
    const g = await load(res, me, id, { admin: true });
    if (!g) return;
    const current = new Set(await memberNames(g.id));
    const list = Array.isArray(users) ? [...new Set(users)].filter((u) => !current.has(u)) : [];
    if (!list.length) return sendJson(res, 400, { error: 'Pick someone to add' });
    if (current.size + list.length > MAX_MEMBERS) return sendJson(res, 400, { error: `A group can have up to ${MAX_MEMBERS} people` });
    for (const u of list) if (typeof u !== 'string' || !(await canChat(me, u))) return sendJson(res, 400, { error: 'You can only add your friends' });
    await addPeople(g, list);
    await systemNote(g.id, me, { e: 'add', u: list });
    await changed(g.id);
    sendJson(res, 200, { group: await groupOut(g, me) });
  },

  'POST /api/groups/remove': async (req, res, me) => {
    const { id, u } = await readJson(req);
    const g = await load(res, me, id, { admin: true });
    if (!g) return;
    if (u === me || !(await memberOf(g.id, u))) return sendJson(res, 400, { error: 'Not in this group' });
    await ctx.db.run('removeMember', g.id, u);
    await ctx.db.run('bumpEpoch', g.id); // their keys stop working for new messages
    await systemNote(g.id, me, { e: 'remove', u: [u] });
    await changed(g.id, [u]);
    sendJson(res, 200, { group: await groupOut(await ctx.db.get('getGroup', g.id), me) });
  },

  'POST /api/groups/admin': async (req, res, me) => {
    const { id, u, on } = await readJson(req);
    const g = await load(res, me, id, { admin: true });
    if (!g) return;
    if (!(await memberOf(g.id, u))) return sendJson(res, 400, { error: 'Not in this group' });
    await ctx.db.run('setAdmin', on ? 1 : 0, g.id, u);
    await systemNote(g.id, me, { e: on ? 'admin' : 'unadmin', u: [u] });
    await changed(g.id);
    sendJson(res, 200, { group: await groupOut(g, me) });
  },

  'POST /api/groups/leave': async (req, res, me) => {
    const { id } = await readJson(req);
    const g = await load(res, me, id);
    if (!g) return;
    await ctx.db.run('removeMember', g.id, me);
    const left = await ctx.db.all('groupMembers', g.id);
    if (!left.length) {
      await ctx.db.run('deleteGroup', g.id);
      await ctx.db.run('deleteGroupPhoto', g.id);
    } else {
      if (!left.some((m) => m.admin)) { // someone has to be in charge: the longest-standing member
        await ctx.db.run('setAdmin', 1, g.id, left[0].username);
        await systemNote(g.id, left[0].username, { e: 'admin', u: [left[0].username], auto: true });
      }
      await ctx.db.run('bumpEpoch', g.id);
      await systemNote(g.id, me, { e: 'left' });
    }
    await changed(g.id, [me]);
    sendJson(res, 200, { ok: true });
  },

  // Invite link: admins see it; "reset" makes a new one (the old stops working), "off" disables it.
  'POST /api/groups/link': async (req, res, me) => {
    const { id, action } = await readJson(req);
    const g = await load(res, me, id, { admin: true });
    if (!g) return;
    let link = g.link;
    if (action === 'off') link = '';
    else if (action === 'reset' || !link) link = crypto.randomBytes(12).toString('base64url');
    if (link !== g.link) await ctx.db.run('setGroupLink', link, g.id);
    sendJson(res, 200, { link });
  },

  'GET /api/groups/preview': async (req, res, me, token, url) => {
    const code = String(url.searchParams.get('code') || '');
    const g = /^[A-Za-z0-9_-]{16}$/.test(code) ? await ctx.db.get('groupByLink', code) : null;
    if (!g) return sendJson(res, 404, { error: 'This invite link isn’t valid any more' });
    const names = await memberNames(g.id);
    sendJson(res, 200, { id: g.id, name: g.name, about: g.about, count: names.length, member: names.includes(me) });
  },

  'POST /api/groups/join': async (req, res, me) => {
    if (rateLimited('joingroup:' + me, 30, 3600e3)) return sendJson(res, 429, { error: 'Slow down' });
    const { code } = await readJson(req);
    const g = typeof code === 'string' && /^[A-Za-z0-9_-]{16}$/.test(code) ? await ctx.db.get('groupByLink', code) : null;
    if (!g) return sendJson(res, 404, { error: 'This invite link isn’t valid any more' });
    const names = await memberNames(g.id);
    if (!names.includes(me)) {
      if (names.length >= MAX_MEMBERS) return sendJson(res, 400, { error: 'This group is full' });
      for (const u of names) if (await blockedBetween(me, u)) return sendJson(res, 403, { error: 'You can’t join this group' });
      await addPeople(g, [me]);
      await systemNote(g.id, me, { e: 'joined' });
      await changed(g.id);
    }
    sendJson(res, 200, { group: await groupOut(g, me) });
  },

  'GET /api/groups/photo': async (req, res, me, token, url) => {
    const id = String(url.searchParams.get('id') || '');
    if (!ID_RE.test(id) || !(await memberOf(id, me))) return sendJson(res, 404, { error: 'No photo' });
    const row = await ctx.db.get('getGroupPhoto', id);
    if (!row) return sendJson(res, 404, { error: 'No photo' });
    sendBody(req, res, { body: Buffer.from(row.data), type: row.type, etag: `"${row.ver}"`, cache: 'private, no-cache' });
  },

  'POST /api/groups/photo': async (req, res, me) => {
    const { id, img } = await readJson(req, 200_000);
    const g = await load(res, me, id, { admin: true });
    if (!g) return;
    const ver = img === null ? 0 : Date.now();
    if (img === null) await ctx.db.run('deleteGroupPhoto', g.id);
    else {
      if (typeof img !== 'string' || img.length > 180_000 || !B64_RE.test(img)) return sendJson(res, 400, { error: 'Invalid image' });
      const data = Buffer.from(img, 'base64');
      const type = imageType(data);
      if (!type) return sendJson(res, 400, { error: 'Use a JPEG, PNG or WebP image' });
      await ctx.db.run('setGroupPhoto', g.id, data, type, ver);
    }
    await ctx.db.run('setGroupPhotoVer', ver, g.id);
    await systemNote(g.id, me, { e: 'photo', on: !!ver });
    await changed(g.id);
    sendJson(res, 200, { photo: ver });
  },
};

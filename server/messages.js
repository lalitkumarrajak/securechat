// WebSocket handlers: relay encrypted messages, receipts, deletes, typing and presence.
// The server only ever sees ciphertext. Reactions, edits and pins are encrypted messages too;
// the client marks them "quiet" (q) so they don't trigger push notifications.
import { ctx, nextSeq } from './context.js';
import { B64_RE, CID_RE, MAX_BODY, USER_RE, config } from './config.js';
import { send, sendTo, watch, isActive, refreshPresence, hooks } from './hub.js';
import { canChat } from './friends.js';
import { receiptsHidden } from './profiles.js';
import { notifyMessage } from './push.js';

// A row as a client sees it. Read receipts are masked if either side turned them off.
async function rowOut(r, viewer) {
  let s = r.status;
  if (s === 2 && r.sender === viewer && await receiptsHidden(r.sender, r.recipient)) s = 1;
  return { id: r.id, cid: r.cid, f: r.sender, to: r.recipient, b: r.body, ts: r.ts, s, seq: r.seq };
}

const idList = (ids, max) => (Array.isArray(ids) && ids.length <= max ? ids.filter(Number.isSafeInteger) : null);

export const handlers = {
  async sync(ws, m) {
    const after = Number.isSafeInteger(m.after) ? m.after : 0;
    // Page by row count and payload size so a slow link gets small, steady batches.
    const rows = await ctx.db.all('syncMsgs', after, ws.user, ws.user, ws.user, 200);
    const msgs = [];
    let bytes = 0;
    for (const r of rows) {
      msgs.push(await rowOut(r, ws.user));
      bytes += r.body.length;
      if (bytes > 512_000) break;
    }
    send(ws, { t: 'batch', msgs, more: msgs.length < rows.length || rows.length === 200 });
  },

  async msg(ws, m) {
    if (typeof m.cid !== 'string' || !CID_RE.test(m.cid)) return send(ws, { t: 'err', e: 'bad cid' });
    if (typeof m.to !== 'string' || !USER_RE.test(m.to) || !(await canChat(ws.user, m.to))) {
      return send(ws, { t: 'err', cid: m.cid, e: 'not-friends' });
    }
    if (typeof m.b !== 'string' || m.b.length > MAX_BODY || !B64_RE.test(m.b)) return send(ws, { t: 'err', cid: m.cid, e: 'Bad message' });
    const res = await ctx.db.run('insertMsg', nextSeq(), m.cid, ws.user, m.to, m.b, Date.now());
    const row = await ctx.db.get('getMsgByCid', ws.user, m.cid);
    send(ws, { t: 'ack', cid: row.cid, id: row.id, ts: row.ts, s: row.status, seq: row.seq });
    if (res.changes === 0) return; // retransmit of a message we already have
    sendTo(m.to, { t: 'm', ...(await rowOut(row, m.to)) });
    sendTo(ws.user, { t: 'm', ...(await rowOut(row, ws.user)) }, ws); // sender's other devices
    if (!m.q && !isActive(m.to)) notifyMessage(m.to, ws.user).catch((err) => console.error('push', err.message));
  },

  async rcpt(ws, m) {
    const s = m.s === 2 ? 2 : 1;
    const ids = idList(m.ids, 500);
    if (!ids) return;
    const bySender = new Map();
    await ctx.db.transaction(async (tx) => {
      for (const id of ids) {
        const r = await tx.get('setStatus', s, nextSeq(), id, ws.user, s);
        if (!r) continue;
        if (!bySender.has(r.sender)) bySender.set(r.sender, []);
        bySender.get(r.sender).push({ id: r.id, s: r.status, seq: r.seq });
      }
    });
    for (const [sender, items] of bySender) {
      const hide = s === 2 && await receiptsHidden(sender, ws.user);
      sendTo(sender, { t: 'st', items: hide ? items.map((i) => ({ ...i, s: 1 })) : items });
      sendTo(ws.user, { t: 'st', items }, ws);
    }
  },

  // Delete for everyone: only your own messages, only within the time limit.
  async del(ws, m) {
    const ids = idList(m.ids, 100);
    if (!ids) return;
    const minTs = Date.now() - config.deleteWindowMs;
    const done = [], failed = [];
    for (const id of ids) {
      const r = await ctx.db.get('deleteForAll', nextSeq(), id, ws.user, minTs);
      if (!r) { failed.push(id); continue; }
      done.push(r);
      sendTo(r.recipient, { t: 'gone', items: [{ id: r.id, seq: r.seq }] });
    }
    if (done.length) sendTo(ws.user, { t: 'gone', items: done.map((r) => ({ id: r.id, seq: r.seq })) });
    send(ws, { t: 'delr', ok: done.map((r) => r.id), failed });
  },

  // Delete for me: hidden for my devices only; the other person keeps it.
  async hide(ws, m) {
    const ids = idList(m.ids, 500);
    if (!ids) return;
    const ts = Date.now();
    const hidden = [];
    for (const id of ids) {
      const r = await ctx.db.get('getMsgById', id);
      if (!r || (r.sender !== ws.user && r.recipient !== ws.user)) continue;
      await ctx.db.run('hideMsg', id, ws.user, ts);
      hidden.push(id);
    }
    if (hidden.length) sendTo(ws.user, { t: 'hid', ids: hidden, ts });
  },

  // Catch up on "delete for me" done on other devices while this one was offline.
  async hidden(ws, m) {
    const since = Number.isSafeInteger(m.since) ? m.since : 0;
    const rows = await ctx.db.all('hiddenSince', ws.user, since);
    send(ws, { t: 'hid', ids: rows.map((r) => Number(r.msg_id)), ts: rows.length ? rows[rows.length - 1].ts : since });
  },

  async typ(ws, m) {
    if (typeof m.to === 'string' && isActive(m.to) && await canChat(ws.user, m.to)) {
      sendTo(m.to, { t: 'typ', f: ws.user, r: m.r === 1 ? 1 : 0 }); // r: recording a voice message
    }
  },

  async watch(ws, m) {
    if (typeof m.u !== 'string' || !USER_RE.test(m.u) || !(await canChat(ws.user, m.u))) return;
    watch(ws, m.u);
    const frame = await hooks.presenceFor(m.u, ws.user);
    if (frame) send(ws, frame);
  },

  // The tab became visible (on) or hidden (off).
  async act(ws, m) {
    ws.active = !!m.on;
    await refreshPresence(ws.user);
  },

  async p(ws) { send(ws, { t: 'P' }); },
};

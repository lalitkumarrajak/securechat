// Reminders (the calendar's, for now): the account's devices work out when to notify and send the
// server the list of upcoming ones, each with its title sealed with a key only those devices (and
// their service worker) can derive. At the time, the server sends a push carrying the sealed title;
// the phone unseals it and shows it. The server learns when, never what.
//
// A device sends the whole list (replacing the previous one) whenever events change, and again now
// and then so recurring ones keep coming. A reminder is sent once and then forgotten.
import { B64_RE } from './config.js';
import { ctx } from './context.js';
import { readJson, sendJson } from './http.js';
import { sendTo } from './hub.js';
import { notify } from './push.js';

const MAX_REMINDERS = 500;
const MAX_BODY = 1500; // a sealed title and time
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SCAN_MS = Number(process.env.REMINDER_SCAN_MS) || 20e3;
const LATE_MS = 6 * 3600e3; // the server was down at the time: still worth sending this late

export const routes = {
  // Replace this account's upcoming reminders: { list: [{ id, at, b }] }.
  'POST /api/reminders': async (req, res, me) => {
    const { list } = await readJson(req, MAX_REMINDERS * (MAX_BODY + 200) + 1000);
    if (!Array.isArray(list) || list.length > MAX_REMINDERS) return sendJson(res, 400, { error: `Up to ${MAX_REMINDERS} reminders` });
    const now = Date.now();
    for (const r of list) {
      if (!r || typeof r.id !== 'string' || !ID_RE.test(r.id) || !Number.isSafeInteger(r.at) || r.at < now - 60e3 || r.at > now + 400 * 86400e3
        || typeof r.b !== 'string' || !r.b || r.b.length > MAX_BODY || !B64_RE.test(r.b)) return sendJson(res, 400, { error: 'Invalid reminder' });
    }
    await ctx.db.run('clearReminders', me);
    for (const r of list) await ctx.db.run('putReminder', me, r.id, r.at, r.b);
    sendJson(res, 200, { ok: true, n: list.length });
  },
};

/** Send the reminders that are due. */
export async function sendDue(now = Date.now()) {
  for (;;) {
    const due = await ctx.db.all('dueReminders', now, 200);
    for (const r of due) {
      await ctx.db.run('deleteReminder', r.username, r.id);
      if (now - r.at > LATE_MS) continue;
      sendTo(r.username, { t: 'remind', id: r.id, b: r.body }); // an open Sanga shows it itself
      notify(r.username, { t: 'remind', id: r.id, b: r.body }).catch(() => {});
    }
    if (due.length < 200) return;
  }
}

export function startReminders() {
  return setInterval(() => sendDue().catch((e) => console.error('reminders', e.message)), SCAN_MS).unref();
}

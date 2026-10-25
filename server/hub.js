// Connected sockets, presence and fan-out.
//
// Presence is activity-based: a user is online only while at least one of their tabs is visible
// and its JavaScript keeps sending heartbeats. An open socket alone isn't enough, because phones
// keep sockets of backgrounded or "closed" tabs alive and the browser answers protocol pings
// itself, which used to leave people "online" forever.
import { config } from './config.js';
import { ctx } from './context.js';

export const online = new Map();   // username -> Set<ws> (authenticated sockets)
export const watchers = new Map(); // username -> Set<ws> subscribed to their presence
const shownOnline = new Set();     // users whose last broadcast state was "online"

// Set by index.js to avoid import cycles: (user, viewer) -> presence frame or null.
export const hooks = { presenceFor: null };

export const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
export const sendTo = (user, obj, except) => {
  for (const ws of online.get(user) || []) if (ws !== except) send(ws, obj);
};

export function isActive(user) {
  const now = Date.now();
  for (const ws of online.get(user) || []) {
    if (ws.active && now - ws.beat < config.presenceTimeoutMs) return true;
  }
  return false;
}
export const isShownOnline = (user) => shownOnline.has(user);

// Recompute a user's online state and tell watchers if it changed.
export async function refreshPresence(user) {
  const on = isActive(user);
  if (on === shownOnline.has(user)) return;
  if (on) shownOnline.add(user);
  else {
    shownOnline.delete(user);
    await ctx.db.run('touchUser', Date.now(), user);
  }
  await broadcastPresence(user);
}

export async function broadcastPresence(user) {
  for (const ws of watchers.get(user) || []) {
    const frame = await hooks.presenceFor(user, ws.user);
    if (frame) send(ws, frame);
  }
}

export function addSocket(ws) {
  if (!online.has(ws.user)) online.set(ws.user, new Set());
  online.get(ws.user).add(ws);
}

export function removeSocket(ws) {
  for (const u of ws.watching) watchers.get(u)?.delete(ws);
  const set = online.get(ws.user);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) online.delete(ws.user);
}

export function watch(ws, user) {
  if (ws.watching.size >= 100 && !ws.watching.has(user)) {
    const oldest = ws.watching.values().next().value;
    ws.watching.delete(oldest);
    watchers.get(oldest)?.delete(ws);
  }
  ws.watching.add(user);
  if (!watchers.has(user)) watchers.set(user, new Set());
  watchers.get(user).add(ws);
}

// Sockets whose JavaScript stopped sending heartbeats (tab frozen, phone asleep) go offline.
export function startPresenceSweep() {
  return setInterval(() => {
    for (const user of [...shownOnline]) {
      refreshPresence(user).catch((err) => console.error('presence sweep failed', err.message));
    }
  }, config.presenceSweepMs).unref();
}

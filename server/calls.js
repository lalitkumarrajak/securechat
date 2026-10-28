// Voice and video calls between friends, two of them or a small group. The audio and video go
// directly between the phones over WebRTC (encrypted by WebRTC itself): in a group call every phone
// connects to every other one, so a call has at most MAX_MEMBERS people. This only relays the setup
// messages. Those are sealed with each pair's conversation key, so the server can't swap in its own
// keys and listen in, and why everyone in a call must be friends with everyone else in it.
//
// A call rings every device of the person called, including ones that connect while it rings (a
// phone opened from the "incoming call" notification); the first to answer takes it and the others
// stop ringing. Unanswered calls end after RING_MS. Someone on a call can ring more friends into it
// ("cadd"); when one answers, the others already on it are told ("cjoin") and connect to them.
//
// Calls live only in memory, so they are bounded: a person can be on MAX_PER_USER calls at once
// (ringing or answered) and the server on MAX_CALLS; an answered call drops its sealed offers, and is
// forgotten once no member's connection has been back for DROP_MS.
import crypto from 'node:crypto';
import { B64_RE, USER_RE } from './config.js';
import { rateLimited, sendJson } from './http.js';
import { isActive, online, send, sendTo } from './hub.js';
import { canChat } from './friends.js';
import { getProfile } from './profiles.js';
import { notify } from './push.js';

const RING_MS = Number(process.env.CALL_RING_MS) || 45e3;
const GRACE_MS = Number(process.env.CALL_GRACE_MS) || 5000; // a caller's reload or network blip
const DROP_MS = Number(process.env.CALL_DROP_MS) || 60e3;   // everyone gone from an answered call
const MAX_CALLS = Number(process.env.CALL_MAX) || 10_000;
const MAX_PER_USER = 2; // e.g. one call, and one more ringing that they may switch to
export const MAX_MEMBERS = 4; // every phone sends to every other: more than this is too much for phones
const MAX_SIGNAL = 20_000; // a sealed offer or answer (SDP); candidates are far smaller
const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;

// id -> { id, from, video, answered, timer, ts, members: Map<user, Member> }
// Member: { u, ws (their device on the call), in (answered), by (who rang them), offer (sealed, while ringing), timer }
const calls = new Map();
export const activeCalls = calls; // tests

const okBody = (b) => typeof b === 'string' && b.length > 0 && b.length <= MAX_SIGNAL && B64_RE.test(b);
const live = (ws) => ws && ws.readyState === 1;
const inside = (c) => [...c.members.values()].filter((x) => x.in);

// Every device of everyone in it hears that it ended (devices not on the call ignore it), except
// the one that ended it.
function end(c, reason, byWs) {
  if (!calls.delete(c.id)) return;
  clearTimeout(c.timer);
  for (const x of c.members.values()) { clearTimeout(x.timer); sendTo(x.u, { t: 'cend', id: c.id, r: reason }, byWs); }
}

// Once answered, each person talks to one device; if its connection dropped, to whichever of their
// devices is connected (the client reconnects and picks the call back up).
function toMember(x, frame) { if (live(x.ws)) send(x.ws, frame); else sendTo(x.u, frame); }
const toOthers = (c, u, frame) => { for (const x of inside(c)) if (x.u !== u) toMember(x, frame); };

const ringFrame = (c, x) => ({
  t: 'call', id: c.id, f: x.by, v: c.video ? 1 : 0, b: x.offer, ts: c.ts,
  ...(c.members.size > 2 && { m: inside(c).map((y) => y.u).filter((u) => u !== x.by) }), // the others already on it
});

const callsOf = (u) => { let n = 0; for (const c of calls.values()) if (c.members.has(u)) n++; return n; };

/** Ring someone into a call; they have RING_MS to answer. */
function ring(c, u, by, offer) {
  const x = { u, ws: null, in: false, by, offer, timer: 0 };
  c.members.set(u, x);
  x.timer = setTimeout(() => {
    if (c.members.get(u) !== x || x.in) return;
    if (!c.answered) { end(c, 'missed'); notifyCall(u, c.from, { t: 'missed', v: c.video ? 1 : 0 }); return; }
    leave(c, x, 'missed');
    notifyCall(u, by, { t: 'missed', v: c.video ? 1 : 0 });
  }, RING_MS);
  sendTo(u, ringFrame(c, x));
  if (!isActive(u)) notifyCall(u, by, { t: 'call', v: c.video ? 1 : 0 });
}

/** Someone leaves (or never answered): the others are told; with one person left, it's over. */
function leave(c, x, reason, byWs) {
  clearTimeout(x.timer);
  c.members.delete(x.u);
  sendTo(x.u, { t: 'cend', id: c.id, r: x.in ? 'ended' : reason }, byWs); // stops ringing on their other devices
  if (inside(c).length <= 1) return end(c, x.in ? 'ended' : reason, byWs); // anyone still ringing stops too
  toOthers(c, x.u, { t: 'cleft', id: c.id, u: x.u, r: reason });
}

export const handlers = {
  // Ring someone: { id, to, v (video), b (sealed offer) }.
  async call(ws, m) {
    if (rateLimited('call:' + ws.user, 20, 60e3)) return send(ws, { t: 'cend', id: m.id, r: 'failed' });
    if (typeof m.id !== 'string' || !ID_RE.test(m.id) || calls.has(m.id) || !okBody(m.b)) return;
    if (typeof m.to !== 'string' || !USER_RE.test(m.to) || !(await canChat(ws.user, m.to))) return send(ws, { t: 'cend', id: m.id, r: 'failed' });
    if (calls.size >= MAX_CALLS || callsOf(ws.user) >= MAX_PER_USER) return send(ws, { t: 'cend', id: m.id, r: 'failed' });
    if (callsOf(m.to) >= MAX_PER_USER) return send(ws, { t: 'cend', id: m.id, r: 'busy' });
    if (calls.has(m.id)) return; // taken while we checked they're friends
    const c = { id: m.id, from: ws.user, video: !!m.v, answered: false, ts: Date.now(), timer: 0, members: new Map() };
    c.members.set(ws.user, { u: ws.user, ws, in: true, by: null, offer: null, timer: 0 });
    calls.set(c.id, c);
    ring(c, m.to, ws.user, m.b);
    send(ws, { t: 'cring', id: c.id, on: online.has(m.to) }); // "Ringing" vs "Calling"
  },

  // Ring one more friend into a call I'm on: { id, to, b (sealed offer from me to them) }.
  async cadd(ws, m) {
    const c = calls.get(m.id);
    const me = c?.members.get(ws.user);
    if (!me?.in || !c.answered || !okBody(m.b) || typeof m.to !== 'string' || !USER_RE.test(m.to)) return;
    const no = (r) => send(ws, { t: 'cnot', id: c.id, u: m.to, r });
    if (rateLimited('cadd:' + ws.user, 20, 60e3)) return no('failed');
    if (c.members.has(m.to)) return no('already');
    if (c.members.size >= MAX_MEMBERS) return no('full');
    for (const x of c.members.values()) if (!(await canChat(x.u, m.to))) return no(x.u === ws.user ? 'failed' : 'notfriends');
    if (callsOf(m.to) >= MAX_PER_USER) return no('busy');
    if (calls.get(c.id) !== c || c.members.has(m.to) || c.members.size >= MAX_MEMBERS) return; // changed while we checked
    me.ws = ws;
    ring(c, m.to, ws.user, m.b);
    send(ws, { t: 'cring', id: c.id, u: m.to, on: online.has(m.to) });
    toOthers(c, ws.user, { t: 'cinv', id: c.id, u: m.to, by: ws.user });
  },

  // Answer on this device: { id, b (sealed answer, for whoever rang me) }.
  async cans(ws, m) {
    const c = calls.get(m.id);
    const x = c?.members.get(ws.user);
    if (!x || !okBody(m.b) || !x.by) return;
    if (x.in) return send(ws, { t: 'cend', id: c.id, r: 'elsewhere' });
    x.in = true;
    x.ws = ws;
    x.offer = null; // only needed to ring devices; it can be most of MAX_SIGNAL
    clearTimeout(x.timer);
    if (!c.answered) {
      c.answered = true;
      c.timer = setTimeout(() => calls.delete(c.id), 12 * 3600e3); // forgotten calls don't pile up
    }
    const by = c.members.get(x.by);
    if (by) toMember(by, { t: 'cans', id: c.id, b: m.b, f: x.u });
    sendTo(x.u, { t: 'cend', id: c.id, r: 'elsewhere' }, ws);
    // Everyone else already on it connects to the newcomer.
    for (const y of inside(c)) if (y.u !== x.u && y.u !== x.by) toMember(y, { t: 'cjoin', id: c.id, u: x.u });
  },

  // Network details and later renegotiation, to one member: { id, b, k: 'ice' | 'offer' | 'answer', to? }.
  // Without `to` (a two-person call), to the other one.
  async csig(ws, m) {
    const c = calls.get(m.id);
    const x = c?.members.get(ws.user);
    if (!x?.in || !c.answered || !okBody(m.b) || !['ice', 'offer', 'answer'].includes(m.k)) return;
    const others = inside(c).filter((y) => y.u !== ws.user);
    const y = typeof m.to === 'string' ? others.find((o) => o.u === m.to) : others.length === 1 ? others[0] : null;
    if (!y) return;
    x.ws = ws;
    toMember(y, { t: 'csig', id: c.id, k: m.k, b: m.b, f: ws.user });
  },

  // Hang up, leave, cancel, decline or "busy": { id, r }.
  async cend(ws, m) {
    const c = calls.get(m.id);
    const x = c?.members.get(ws.user);
    if (!x) return;
    const r = ['ended', 'declined', 'busy', 'failed'].includes(m.r) ? m.r : 'ended';
    if (x.in && x.ws && ws !== x.ws && live(x.ws)) return; // a device that isn't the one on the call
    if (!c.answered && x.u === c.from) { // the caller gave up before anyone answered
      end(c, 'cancelled', ws);
      for (const y of c.members.values()) if (!y.in) notifyCall(y.u, c.from, { t: 'missed', v: c.video ? 1 : 0 });
      return;
    }
    if (!c.answered) return end(c, r, ws); // the one called declined or is busy
    leave(c, x, r, ws);
  },

  // This device reconnected during a call it's on: route the call's messages to it again.
  async cre(ws, m) {
    const c = calls.get(m.id);
    const x = c?.members.get(ws.user);
    if (!x) return send(ws, { t: 'cend', id: m.id, r: 'ended' });
    if (x.in) x.ws = ws;
  },
};

/** A device signed in: if someone is calling this person, ring it too. */
export function onConnect(ws) {
  for (const c of calls.values()) {
    const x = c.members.get(ws.user);
    if (x && !x.in) send(ws, ringFrame(c, x));
  }
}

/** A device went away. A call it was placing and nobody answered yet is cancelled; in an answered
 *  call, someone whose connection doesn't come back has left, and a call nobody's connection comes
 *  back to is forgotten (its devices may still be talking directly, but can't hang up or
 *  renegotiate through here any more, and the client ends it). */
export function onClose(ws) {
  for (const c of calls.values()) {
    const x = [...c.members.values()].find((y) => y.ws === ws);
    if (!x) continue;
    if (c.answered && x.in) {
      setTimeout(() => {
        if (calls.get(c.id) !== c || c.members.get(x.u) !== x || live(x.ws)) return;
        if (!inside(c).some((y) => live(y.ws))) end(c, 'ended');
        else if (c.members.size > 2) leave(c, x, 'ended');
      }, DROP_MS).unref?.();
    }
    if (!c.answered && x.u === c.from) {
      // Give a reload or a quick network blip a moment to come back.
      setTimeout(() => {
        if (calls.get(c.id) === c && !c.answered && !live(x.ws)) {
          end(c, 'cancelled');
          for (const y of c.members.values()) if (!y.in) notifyCall(y.u, c.from, { t: 'missed', v: c.video ? 1 : 0 });
        }
      }, GRACE_MS).unref?.();
    }
  }
}

async function notifyCall(to, from, payload) {
  try {
    const name = (await getProfile(from)).name || from;
    await notify(to, { ...payload, from, name });
  } catch (err) { console.error('push', err.message); }
}

// ---------- ICE servers ----------
// STUN finds each phone's public address; most calls connect with that alone. Phones behind strict
// networks (many mobile carriers) also need a TURN relay, configured with one of:
//   TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL   a fixed account (e.g. Metered, Twilio, your own)
//   TURN_URLS + TURN_SECRET                       your own coturn with use-auth-secret
//   CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN   Cloudflare Realtime TURN
const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
let cfCache = { at: 0, servers: null };

async function turnServers(me) {
  const env = process.env;
  const urls = (env.TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (urls.length && env.TURN_SECRET) {
    const username = `${Math.floor(Date.now() / 1000) + 12 * 3600}:${me}`;
    const credential = crypto.createHmac('sha1', env.TURN_SECRET).update(username).digest('base64');
    return [{ urls, username, credential }];
  }
  if (urls.length && env.TURN_USERNAME) return [{ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL || '' }];
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) {
    if (Date.now() - cfCache.at < 3600e3 && cfCache.servers) return cfCache.servers;
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 6 * 3600 }), signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('turn ' + res.status);
    const { iceServers } = await res.json();
    cfCache = { at: Date.now(), servers: Array.isArray(iceServers) ? iceServers : [iceServers] };
    return cfCache.servers;
  }
  return [];
}

export const routes = {
  'GET /api/ice': async (req, res, me) => {
    let turn = [];
    try { turn = await turnServers(me); } catch (err) { console.error('turn servers', err.message); }
    sendJson(res, 200, { iceServers: [...STUN, ...turn], relay: turn.length > 0 });
  },
};

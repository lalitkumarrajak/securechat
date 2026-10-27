// Voice and video calls between two friends. The audio and video go directly between the two
// phones over WebRTC (encrypted by WebRTC itself); this only relays the setup messages. Those are
// sealed with the pair's conversation key, so the server can't swap in its own keys and listen in.
//
// A call rings every device of the person called, including ones that connect while it rings (a
// phone opened from the "incoming call" notification); the first to answer takes it and the others
// stop ringing. Unanswered calls end after RING_MS.
//
// Calls live only in memory, so they are bounded: a person can be on MAX_PER_USER calls at once
// (ringing or answered) and the server on MAX_CALLS; an answered call drops its sealed offer, and is
// forgotten once neither side's connection has been back for DROP_MS.
import crypto from 'node:crypto';
import { B64_RE, USER_RE } from './config.js';
import { rateLimited, sendJson } from './http.js';
import { isActive, online, send, sendTo } from './hub.js';
import { canChat } from './friends.js';
import { getProfile } from './profiles.js';
import { notify } from './push.js';

const RING_MS = Number(process.env.CALL_RING_MS) || 45e3;
const GRACE_MS = Number(process.env.CALL_GRACE_MS) || 5000; // a caller's reload or network blip
const DROP_MS = Number(process.env.CALL_DROP_MS) || 60e3;   // both sides gone from an answered call
const MAX_CALLS = Number(process.env.CALL_MAX) || 10_000;
const MAX_PER_USER = 2; // e.g. one call, and one more ringing that they may switch to
const MAX_SIGNAL = 20_000; // a sealed offer or answer (SDP); candidates are far smaller
const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;

// id -> { id, from, to, video, offer, fromWs, toWs, answered, timer, ts }
const calls = new Map();
export const activeCalls = calls; // tests

const okBody = (b) => typeof b === 'string' && b.length > 0 && b.length <= MAX_SIGNAL && B64_RE.test(b);

// Every device of both people hears that it ended (devices not on the call ignore it), except the
// one that ended it.
function end(c, reason, byWs) {
  if (!calls.delete(c.id)) return;
  clearTimeout(c.timer);
  const frame = { t: 'cend', id: c.id, r: reason };
  sendTo(c.from, frame, byWs);
  sendTo(c.to, frame, byWs);
}

// Once answered, each side talks to one device; if its connection dropped, to whichever of that
// person's devices is connected (the client reconnects and picks the call back up).
const live = (ws) => ws && ws.readyState === 1;
function toCaller(c, frame) { if (live(c.fromWs)) send(c.fromWs, frame); else sendTo(c.from, frame); }
function toCallee(c, frame) { if (live(c.toWs)) send(c.toWs, frame); else sendTo(c.to, frame); }

const ringFrame = (c) => ({ t: 'call', id: c.id, f: c.from, v: c.video ? 1 : 0, b: c.offer, ts: c.ts });

const callsOf = (u) => { let n = 0; for (const c of calls.values()) if (c.from === u || c.to === u) n++; return n; };

const party = (ws, c) => (c ? (ws.user === c.from ? 'from' : ws.user === c.to ? 'to' : null) : null);

export const handlers = {
  // Ring someone: { id, to, v (video), b (sealed offer) }.
  async call(ws, m) {
    if (rateLimited('call:' + ws.user, 20, 60e3)) return send(ws, { t: 'cend', id: m.id, r: 'failed' });
    if (typeof m.id !== 'string' || !ID_RE.test(m.id) || calls.has(m.id) || !okBody(m.b)) return;
    if (typeof m.to !== 'string' || !USER_RE.test(m.to) || !(await canChat(ws.user, m.to))) return send(ws, { t: 'cend', id: m.id, r: 'failed' });
    if (calls.size >= MAX_CALLS || callsOf(ws.user) >= MAX_PER_USER) return send(ws, { t: 'cend', id: m.id, r: 'failed' });
    if (callsOf(m.to) >= MAX_PER_USER) return send(ws, { t: 'cend', id: m.id, r: 'busy' });
    if (calls.has(m.id)) return; // taken while we checked they're friends
    const c = { id: m.id, from: ws.user, to: m.to, video: !!m.v, offer: m.b, fromWs: ws, toWs: null, answered: false, ts: Date.now() };
    c.timer = setTimeout(() => {
      end(c, 'missed');
      notifyCall(c.to, c.from, { t: 'missed', v: c.video ? 1 : 0 });
    }, RING_MS);
    calls.set(c.id, c);
    sendTo(c.to, ringFrame(c));
    send(ws, { t: 'cring', id: c.id, on: online.has(c.to) }); // "Ringing" vs "Calling"
    if (!isActive(c.to)) notifyCall(c.to, c.from, { t: 'call', v: c.video ? 1 : 0 });
  },

  // Answer on this device: { id, b (sealed answer) }.
  async cans(ws, m) {
    const c = calls.get(m.id);
    if (party(ws, c) !== 'to' || !okBody(m.b)) return;
    if (c.answered) return send(ws, { t: 'cend', id: c.id, r: 'elsewhere' });
    c.answered = true;
    c.toWs = ws;
    c.offer = null; // only needed to ring devices; it can be most of MAX_SIGNAL
    clearTimeout(c.timer);
    c.timer = setTimeout(() => calls.delete(c.id), 12 * 3600e3); // forgotten calls don't pile up
    toCaller(c, { t: 'cans', id: c.id, b: m.b });
    sendTo(c.to, { t: 'cend', id: c.id, r: 'elsewhere' }, ws);
  },

  // Network details and later renegotiation, either way: { id, b, k: 'ice' | 'offer' | 'answer' | 'ctl' }.
  async csig(ws, m) {
    const c = calls.get(m.id);
    const who = party(ws, c);
    if (!who || !c.answered || !okBody(m.b) || !['ice', 'offer', 'answer'].includes(m.k)) return;
    if (who === 'from') { c.fromWs = ws; toCallee(c, { t: 'csig', id: c.id, k: m.k, b: m.b }); }
    else { c.toWs = ws; toCaller(c, { t: 'csig', id: c.id, k: m.k, b: m.b }); }
  },

  // Hang up, cancel, decline or "busy": { id, r }.
  async cend(ws, m) {
    const c = calls.get(m.id);
    const who = party(ws, c);
    if (!who) return;
    const r = ['ended', 'declined', 'busy', 'failed'].includes(m.r) ? m.r : 'ended';
    if (who === 'to' && c.answered && ws !== c.toWs && live(c.toWs)) return; // a device that didn't take the call
    end(c, !c.answered && who === 'from' ? 'cancelled' : r, ws);
    if (who === 'from' && !c.answered) notifyCall(c.to, c.from, { t: 'missed', v: c.video ? 1 : 0 });
  },

  // This device reconnected during a call it's on: route the call's messages to it again.
  async cre(ws, m) {
    const c = calls.get(m.id);
    const who = party(ws, c);
    if (!who) return send(ws, { t: 'cend', id: m.id, r: 'ended' });
    if (who === 'from') c.fromWs = ws;
    else if (c.answered) c.toWs = ws;
  },
};

/** A device signed in: if someone is calling this person, ring it too. */
export function onConnect(ws) {
  for (const c of calls.values()) if (c.to === ws.user && !c.answered) send(ws, ringFrame(c));
}

/** A device went away. A call it was placing and nobody answered yet is cancelled; an answered call
 *  that neither side's connection comes back to is forgotten (its devices may still be talking
 *  directly, but can't hang up or renegotiate through here any more, and the client ends it). */
export function onClose(ws) {
  for (const c of calls.values()) {
    if (c.answered && (c.fromWs === ws || c.toWs === ws)) {
      setTimeout(() => {
        if (calls.get(c.id) === c && !live(c.fromWs) && !live(c.toWs)) end(c, 'ended');
      }, DROP_MS).unref?.();
    }
    if (c.fromWs === ws && !c.answered) {
      // Give a reload or a quick network blip a moment to come back.
      setTimeout(() => {
        if (calls.get(c.id) === c && !c.answered && !live(c.fromWs)) {
          end(c, 'cancelled');
          notifyCall(c.to, c.from, { t: 'missed', v: c.video ? 1 : 0 });
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

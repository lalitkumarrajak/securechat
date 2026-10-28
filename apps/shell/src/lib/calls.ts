// Voice and video calls with friends, over WebRTC: the sound and picture go directly between the
// devices, encrypted by WebRTC. A group call (up to four people) is a direct connection between every
// pair. Setting each one up goes through the server, sealed with that pair's conversation key, so the
// server can't put itself in the middle.
// Whoever placed the call writes it into the chat afterwards ("Missed voice call", "Video call · 3:24").
import { create } from 'zustand';
import { toast } from 'sonner';
import * as C from '@sanga/crypto';
import { api, frameHooks, myName, peerKey, peerKeyChanged, readyHooks, sendContent, sendFrame } from './engine';
import { getApp } from '../state/app';
import { useStories } from './stories';
import { displayName, isGroup, type CallStatus } from './types';

export const MAX_PEOPLE = 4; // the server's limit too: every phone sends to every other one

export type Phase = 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';
/** Someone else on the call. */
export interface Member {
  u: string;
  state: 'ringing' | 'connecting' | 'connected' | 'reconnecting';
  muted?: boolean; camOff?: boolean; sharing?: boolean;
}
export interface Call {
  id: string;
  peer: string;            // who I called, or who rang me
  video: boolean; out: boolean; phase: Phase;
  members: Member[];       // everyone else on it (or being rung into it)
  ringing?: boolean;       // placing it: their phone is reachable ("Ringing…" rather than "Calling…")
  started?: number;        // when it connected
  muted: boolean; camOff: boolean; facing: 'user' | 'environment';
  sharing?: boolean;       // my screen instead of my camera
  ended?: string;          // why it ended, shown for a moment
}
interface CallStore {
  call: Call | null; local: MediaStream | null; screen: MediaStream | null; minimized: boolean;
  remotes: Record<string, MediaStream>; // each member's sound and picture
}
export const useCall = create<CallStore>(() => ({ call: null, local: null, screen: null, minimized: false, remotes: {} }));

const set = (patch: Partial<Call>) => useCall.setState((s) => (s.call ? { call: { ...s.call, ...patch } } : {}));
const cur = () => useCall.getState().call;
const member = (u: string) => cur()?.members.find((x) => x.u === u);
function setMember(u: string, patch: Partial<Member>) {
  useCall.setState((s) => {
    if (!s.call) return {};
    const has = s.call.members.some((x) => x.u === u);
    const members = has ? s.call.members.map((x) => (x.u === u ? { ...x, ...patch } : x)) : [...s.call.members, { u, state: 'connecting' as const, ...patch }];
    return { call: { ...s.call, members } };
  });
}
function dropMember(u: string) {
  useCall.setState((s) => {
    if (!s.call) return {};
    const remotes = { ...s.remotes };
    delete remotes[u];
    return { call: { ...s.call, members: s.call.members.filter((x) => x.u !== u) }, remotes };
  });
}
/** Whether this is (or has become) a call with more than one other person. */
export const isGroupCall = (c: Call) => c.members.length > 1;

// ---------- one connection per person ----------
interface Link {
  u: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  answered: boolean;                 // setup is done: send network details straight away
  outIce: RTCIceCandidateInit[];     // gathered before that
  inIce: RTCIceCandidateInit[];      // arrived before we could use them
  screenSender: RTCRtpSender | null; // a voice call has no video to swap: sharing adds one
  drop: number;
}

// Per-call internals that the screen doesn't need.
let R = fresh();
function fresh() {
  return {
    links: new Map<string, Link>(),
    offer: '',                               // incoming: their sealed-and-opened offer
    from: '',                                // incoming: who rang me
    timers: [] as number[],
    screen: null as MediaStreamTrack | null, // the screen being shared
  };
}
const anyAnswered = () => [...R.links.values()].some((l) => l.answered);

// ---------- sealing the setup messages ----------
// Bound to who sends it to whom, the call and what it is, so nothing can be replayed elsewhere.
async function seal(peer: string, id: string, kind: string, obj: unknown) {
  return C.encryptMessage(await peerKey(peer), obj, myName(), peer, `call|${id}|${kind}`);
}
async function unseal(peer: string, id: string, kind: string, b: string) {
  return C.decryptMessage(await peerKey(peer), b, peer, myName(), `call|${id}|${kind}`);
}

// An offer carries when it was made, so one the server held back or replays later doesn't ring.
// Phones' clocks can be minutes apart (set by hand, no network time), so allow 10 minutes either
// way: still useless for replaying a call afterwards. (Ringing itself stops after 45 s on the server.)
const OFFER_MAX_AGE = 10 * 60e3;
const isFresh = (at: unknown) => typeof at === 'number' && Math.abs(Date.now() - at) <= OFFER_MAX_AGE;

let ice: { at: number; servers: RTCIceServer[] } | null = null;
async function iceServers() {
  if (!ice || Date.now() - ice.at > 10 * 60e3) {
    try { ice = { at: Date.now(), servers: (await api<{ iceServers: RTCIceServer[] }>('/api/ice')).iceServers }; }
    catch { return ice?.servers || [{ urls: 'stun:stun.l.google.com:19302' }]; }
  }
  return ice.servers;
}

async function getMedia(video: boolean, facing: 'user' | 'environment' = 'user') {
  let s: MediaStream;
  try {
    s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      // Modest resolution: smooth on slow mobile data, and phones' screens are small anyway.
      video: video ? { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } : false,
    });
  } catch (e) {
    const name = (e as Error).name;
    const what = video ? 'camera and microphone' : 'microphone';
    throw new Error(name === 'NotAllowedError' ? `Allow ${what} access to make calls` : name === 'NotFoundError' ? `No ${video ? 'camera' : 'microphone'} found` : `Couldn’t start your ${what}`);
  }
  // Some browsers hand back just the microphone when the camera is blocked.
  if (video && !s.getVideoTracks().length) {
    s.getTracks().forEach((t) => t.stop());
    throw new Error('Allow camera access for video calls');
  }
  return s;
}

const supported = () => typeof RTCPeerConnection === 'function' && !!navigator.mediaDevices?.getUserMedia;

/** The connection to one person, with my microphone (and camera, or screen) on it. */
async function link(id: string, u: string) {
  const pc = new RTCPeerConnection({ iceServers: await iceServers() });
  const l: Link = { u, pc, dc: null, answered: false, outIce: [], inIce: [], screenSender: null, drop: 0 };
  R.links.get(u)?.pc.close();
  R.links.set(u, l);
  const local = useCall.getState().local;
  if (local) for (const t of local.getTracks()) pc.addTrack(t, local);
  if (R.screen) { // sharing already: they see the screen too
    const v = pc.getSenders().find((x) => x.track?.kind === 'video');
    if (v) await v.replaceTrack(R.screen);
    else l.screenSender = pc.addTrack(R.screen, useCall.getState().screen!);
  }
  pc.onicecandidate = (e) => {
    if (!e.candidate || cur()?.id !== id) return;
    const c = e.candidate.toJSON();
    if (l.answered) void sendIce(id, u, c); else l.outIce.push(c);
  };
  pc.ontrack = (e) => {
    useCall.setState((s) => {
      const stream = s.remotes[u] || new MediaStream();
      if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track);
      return { remotes: { ...s.remotes, [u]: new MediaStream(stream.getTracks()) } };
    });
  };
  pc.ondatachannel = (e) => wire(l, e.channel);
  pc.onconnectionstatechange = () => {
    if (cur()?.id !== id || R.links.get(u) !== l) return;
    const s = pc.connectionState;
    clearTimeout(l.drop);
    if (s === 'connected') {
      stopTone();
      setMember(u, { state: 'connected' });
      const c = cur()!;
      set({ phase: 'active', ...(!c.started && { started: Date.now() }) });
    } else if (s === 'disconnected') {
      setMember(u, { state: 'reconnecting' });
      l.drop = window.setTimeout(() => { if (pc.connectionState !== 'connected') lost(u); }, 20_000);
    } else if (s === 'failed') lost(u);
  };
  return l;
}

/** The connection to one person is gone: in a group call they drop out; otherwise the call ends. */
function lost(u: string) {
  const c = cur();
  if (!c) return;
  if (isGroupCall(c)) { unlink(u); if (!R.links.size) finish('ok', 'Connection lost'); return; }
  finish(c.started ? 'ok' : 'failed', c.started ? 'Connection lost' : 'Couldn’t connect');
}

function unlink(u: string) {
  const l = R.links.get(u);
  if (l) { clearTimeout(l.drop); l.pc.close(); R.links.delete(u); }
  dropMember(u);
}

async function sendIce(id: string, u: string, c: RTCIceCandidateInit) {
  sendFrame({ t: 'csig', id, k: 'ice', to: u, b: await seal(u, id, 'ice', c) });
}
function flushIce(id: string, l: Link) {
  for (const c of l.outIce.splice(0)) void sendIce(id, l.u, c);
}

// Mute, camera and screen state, straight to the other phones.
function wire(l: Link, dc: RTCDataChannel) {
  l.dc = dc;
  dc.onopen = () => sendState();
  dc.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      setMember(l.u, { muted: m.mic === false, camOff: m.cam === false, sharing: m.screen === true });
    } catch { /* ignore */ }
  };
}
function sendState() {
  const c = cur();
  if (!c) return;
  const msg = JSON.stringify({ mic: !c.muted, cam: !c.camOff, screen: !!c.sharing });
  for (const l of R.links.values()) if (l.dc?.readyState === 'open') l.dc.send(msg);
}

/** Start the connection to someone: my offer, for the server to pass on. */
async function offerTo(id: string, u: string) {
  const l = await link(id, u);
  wire(l, l.pc.createDataChannel('state'));
  const offer = await l.pc.createOffer();
  await l.pc.setLocalDescription(offer);
  return { l, sdp: offer.sdp };
}

// ---------- placing, answering, ending ----------
export async function startCall(peer: string, video: boolean) {
  if (cur()) { toast('You’re already on a call'); return; }
  if (isGroup(peer)) return;
  if (!supported()) { toast.error('Calls don’t work in this browser'); return; }
  if (!getApp().friends[peer]) { toast.error('You can only call friends'); return; }
  if (await peerKeyChanged(peer)) { toast.warning('Calling is paused', { description: 'This contact’s security code changed. Verify it first.' }); return; }
  if (getApp().conn !== 'online') { toast.error('You’re offline', { description: 'Connect to the internet to call.' }); return; }
  const id = C.randomId(18);
  useCall.setState({ call: { id, peer, video, out: true, phase: 'outgoing', members: [{ u: peer, state: 'ringing' }], muted: false, camOff: false, facing: 'user' }, minimized: false, remotes: {} });
  try {
    const local = await getMedia(video);
    if (cur()?.id !== id) { local.getTracks().forEach((t) => t.stop()); return; } // hung up meanwhile
    useCall.setState({ local });
    const { sdp } = await offerTo(id, peer);
    if (cur()?.id !== id) return;
    if (!sendFrame({ t: 'call', id, to: peer, v: video ? 1 : 0, b: await seal(peer, id, 'offer', { sdp, at: Date.now() }) })) throw new Error('You’re offline');
    startTone('ringback');
    R.timers.push(window.setTimeout(() => { if (cur()?.id === id && !anyAnswered()) { sendFrame({ t: 'cend', id, r: 'ended' }); finish('missed', 'No answer'); } }, 60_000));
  } catch (e) {
    toast.error((e as Error).message);
    finish('failed', null);
  }
}

/** Ring one more friend into the call I'm on. */
export async function addToCall(u: string) {
  const c = cur();
  if (!c || c.phase !== 'active' || c.members.some((x) => x.u === u)) return;
  if (c.members.length + 1 >= MAX_PEOPLE) { toast(`A call can have up to ${MAX_PEOPLE} people`); return; }
  if (!getApp().friends[u]) return;
  if (await peerKeyChanged(u)) { toast.warning('Calling is paused', { description: 'This contact’s security code changed. Verify it first.' }); return; }
  setMember(u, { state: 'ringing' });
  try {
    const { sdp } = await offerTo(c.id, u);
    if (cur()?.id !== c.id) return;
    sendFrame({ t: 'cadd', id: c.id, to: u, b: await seal(u, c.id, 'offer', { sdp, at: Date.now() }) });
  } catch { unlink(u); toast.error('Couldn’t add them to the call'); }
}

export async function accept() {
  const c = cur();
  if (!c || c.phase !== 'incoming') return;
  set({ phase: 'connecting' });
  stopTone();
  try {
    const local = await getMedia(c.video);
    if (cur()?.id !== c.id) { local.getTracks().forEach((t) => t.stop()); return; }
    useCall.setState({ local });
    const l = await link(c.id, R.from);
    await l.pc.setRemoteDescription({ type: 'offer', sdp: R.offer });
    const answer = await l.pc.createAnswer();
    await l.pc.setLocalDescription(answer);
    sendFrame({ t: 'cans', id: c.id, b: await seal(R.from, c.id, 'answer', { sdp: answer.sdp }) });
    l.answered = true;
    flushIce(c.id, l);
    setMember(R.from, { state: 'connecting' });
  } catch (e) {
    toast.error((e as Error).message);
    sendFrame({ t: 'cend', id: c.id, r: 'failed' });
    finish('failed', null);
  }
}

export function decline() {
  const c = cur();
  if (!c || c.phase !== 'incoming') return;
  sendFrame({ t: 'cend', id: c.id, r: 'declined' });
  finish('declined', null);
}

/** Hang up, or leave a group call (or cancel a call that hasn't been answered yet). */
export function hangUp() {
  const c = cur();
  if (!c || c.phase === 'ended') return;
  if (c.phase === 'incoming') return decline();
  sendFrame({ t: 'cend', id: c.id, r: 'ended' });
  finish(anyAnswered() ? 'ok' : 'cancelled', isGroupCall(c) ? 'You left the call' : 'Call ended');
}

/** The call is over: release the microphone and camera, log it, show why for a moment. */
function finish(st: CallStatus, label: string | null) {
  const c = cur();
  if (!c || c.phase === 'ended') return;
  stopTone();
  for (const t of R.timers) clearTimeout(t);
  for (const l of R.links.values()) { clearTimeout(l.drop); l.pc.close(); }
  useCall.getState().local?.getTracks().forEach((t) => t.stop());
  R.screen?.stop();
  if (c.out) {
    const dur = st === 'ok' && c.started ? Math.round((Date.now() - c.started) / 1000) : 0;
    sendContent(c.peer, { type: 'call', v: c.video, dur, st }, undefined, true).catch(() => {});
  }
  R = fresh();
  const gone = { local: null, screen: null, remotes: {}, minimized: false };
  if (!label) { useCall.setState({ call: null, ...gone }); return; }
  if (c.phase !== 'incoming') playEnd();
  useCall.setState({ call: { ...c, phase: 'ended', ended: label }, ...gone });
  window.setTimeout(() => { if (cur()?.id === c.id) useCall.setState({ call: null }); }, 1800);
}

// ---------- in a call ----------
export function toggleMute() {
  const c = cur();
  if (!c) return;
  useCall.getState().local?.getAudioTracks().forEach((t) => { t.enabled = c.muted; });
  set({ muted: !c.muted });
  sendState();
}

export function toggleCamera() {
  const c = cur();
  if (!c?.video) return;
  useCall.getState().local?.getVideoTracks().forEach((t) => { t.enabled = c.camOff; });
  set({ camOff: !c.camOff });
  sendState();
}

/** Front or back camera. */
export async function switchCamera() {
  const c = cur();
  const local = useCall.getState().local;
  if (!c?.video || !local || !R.links.size) return;
  const facing = c.facing === 'user' ? 'environment' : 'user';
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing }, width: { ideal: 640 }, height: { ideal: 480 } } });
    const track = s.getVideoTracks()[0];
    track.enabled = !c.camOff;
    if (!R.screen) for (const l of R.links.values()) await l.pc.getSenders().find((x) => x.track?.kind === 'video')?.replaceTrack(track);
    for (const t of local.getVideoTracks()) { t.stop(); local.removeTrack(t); }
    local.addTrack(track);
    useCall.setState({ local: new MediaStream(local.getTracks()) });
    set({ facing });
  } catch { toast('This device has only one camera'); }
}

// ---------- sharing the screen ----------
// Computers only (phones' browsers can't). In a video call the screen takes the camera's place; a
// voice call gets a video track for it, agreed with the other phone through the server like the
// setup was. Sharing ends from the call screen, or from the browser's own "Stop sharing".
export const canShareScreen = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

const videoSender = (l: Link) => l.screenSender ?? l.pc.getSenders().find((x) => x.track?.kind === 'video') ?? null;

export async function shareScreen() {
  const c = cur();
  if (!c || c.phase !== 'active' || !R.links.size || c.sharing || !canShareScreen()) return;
  let s: MediaStream;
  try { s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false }); }
  catch (e) { if ((e as Error).name !== 'NotAllowedError') toast.error('Couldn’t share your screen'); return; }
  const track = s.getVideoTracks()[0];
  if (!track || cur()?.id !== c.id) { s.getTracks().forEach((t) => t.stop()); return; }
  track.contentHint = 'detail'; // text stays sharp rather than smooth
  track.onended = () => void stopSharing();
  R.screen = track;
  useCall.setState({ screen: s });
  for (const l of R.links.values()) {
    try {
      const sender = videoSender(l);
      if (sender) await sender.replaceTrack(track);
      else { l.screenSender = l.pc.addTrack(track, s); await renegotiate(c.id, l); }
    } catch { /* that one doesn't see it */ }
  }
  set({ sharing: true });
  sendState();
}

export async function stopSharing() {
  const t = R.screen;
  if (!t) return;
  R.screen = null;
  t.onended = null;
  t.stop();
  const cam = useCall.getState().local?.getVideoTracks()[0] ?? null;
  for (const l of R.links.values()) await videoSender(l)?.replaceTrack(l.screenSender ? null : cam).catch(() => {});
  useCall.setState({ screen: null });
  set({ sharing: false });
  sendState();
}

/** Agree on a changed connection (a screen added to a voice call): a new offer, sealed like the first. */
async function renegotiate(id: string, l: Link) {
  const offer = await l.pc.createOffer();
  await l.pc.setLocalDescription(offer);
  sendFrame({ t: 'csig', id, k: 'offer', to: l.u, b: await seal(l.u, id, 'reoffer', { sdp: offer.sdp }) });
}

export const setMinimized = (minimized: boolean) => useCall.setState({ minimized });

// ---------- from the server ----------
frameHooks.call = async (m: { id: string; f: string; v: number; b: string; m?: string[] }) => {
  const c = cur();
  if (c?.id === m.id) return; // rang again after reconnecting
  if (c) { sendFrame({ t: 'cend', id: m.id, r: 'busy' }); return; }
  if (!supported() || !getApp().friends[m.f] || await peerKeyChanged(m.f)) { sendFrame({ t: 'cend', id: m.id, r: 'failed' }); return; }
  let offer: { sdp?: string; at?: number };
  try { offer = await unseal(m.f, m.id, 'offer', m.b); } catch { sendFrame({ t: 'cend', id: m.id, r: 'failed' }); return; }
  if (!isFresh(offer?.at)) { sendFrame({ t: 'cend', id: m.id, r: 'failed' }); return; }
  if (cur() || typeof offer?.sdp !== 'string') return;
  R = fresh();
  R.offer = offer.sdp;
  R.from = m.f;
  const others = (Array.isArray(m.m) ? m.m : []).filter((u) => typeof u === 'string' && u !== m.f && u !== myName()).slice(0, MAX_PEOPLE);
  useCall.setState({
    call: { id: m.id, peer: m.f, video: !!m.v, out: false, phase: 'incoming', members: [{ u: m.f, state: 'connecting' }, ...others.map((u) => ({ u, state: 'connecting' as const }))], muted: false, camOff: false, facing: 'user' },
    minimized: false, remotes: {},
  });
  useStories.setState({ viewer: null }); // full screen too: the call goes on top
  startTone('ring');
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
    const name = displayName(getApp().friends[m.f], m.f);
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(name, {
      body: `Incoming ${others.length ? 'group ' : ''}${m.v ? 'video' : 'voice'} call`, icon: '/icon-192.png', tag: 'call-' + m.f, requireInteraction: true, data: { peer: m.f },
    })).catch(() => {});
  }
};

frameHooks.cring = (m: { id: string; on: boolean; u?: string }) => { if (cur()?.id === m.id && !m.u) set({ ringing: m.on }); };

// Someone I rang answered.
frameHooks.cans = async (m: { id: string; b: string; f?: string }) => {
  const c = cur();
  const u = m.f || c?.peer;
  const l = u ? R.links.get(u) : undefined;
  if (!c || c.id !== m.id || !u || !l || l.answered) return;
  try {
    const { sdp } = await unseal(u, c.id, 'answer', m.b);
    await l.pc.setRemoteDescription({ type: 'answer', sdp });
  } catch {
    if (isGroupCall(c)) { unlink(u); return; }
    sendFrame({ t: 'cend', id: c.id, r: 'failed' }); finish('failed', 'Couldn’t connect'); return;
  }
  l.answered = true;
  stopTone();
  setMember(u, { state: 'connecting' });
  if (c.phase === 'outgoing') set({ phase: 'connecting' });
  flushIce(c.id, l);
  for (const cand of l.inIce.splice(0)) l.pc.addIceCandidate(cand).catch(() => {});
};

// Someone else rang a friend in, and they answered: connect to them.
frameHooks.cjoin = async (m: { id: string; u: string }) => {
  const c = cur();
  if (!c || c.id !== m.id || c.phase === 'ended' || m.u === myName() || R.links.has(m.u)) return;
  if (!getApp().friends[m.u] || await peerKeyChanged(m.u)) return;
  setMember(m.u, { state: 'connecting' });
  try {
    const { sdp } = await offerTo(c.id, m.u);
    sendFrame({ t: 'csig', id: c.id, k: 'offer', to: m.u, b: await seal(m.u, c.id, 'reoffer', { sdp }) });
  } catch { unlink(m.u); }
};

// Someone else is ringing a friend in.
frameHooks.cinv = (m: { id: string; u: string }) => {
  const c = cur();
  if (c?.id === m.id && c.phase !== 'ended' && m.u !== myName() && !member(m.u)) setMember(m.u, { state: 'ringing' });
};

// Couldn't ring them in.
frameHooks.cnot = (m: { id: string; u: string; r: string }) => {
  const c = cur();
  if (c?.id !== m.id) return;
  unlink(m.u);
  const name = displayName(getApp().friends[m.u], m.u);
  toast(m.r === 'notfriends' ? `${name} isn’t friends with everyone on the call` : m.r === 'full' ? `A call can have up to ${MAX_PEOPLE} people`
    : m.r === 'busy' ? `${name} is on another call` : `Couldn’t add ${name}`);
};

// Someone left (or didn't answer).
frameHooks.cleft = (m: { id: string; u: string; r: string }) => {
  const c = cur();
  if (c?.id !== m.id) return;
  const was = member(m.u);
  unlink(m.u);
  const name = displayName(getApp().friends[m.u], m.u);
  if (m.r === 'declined') toast(`${name} declined`);
  else if (m.r === 'missed') toast(`${name} didn’t answer`);
  else if (m.r === 'busy') toast(`${name} is on another call`);
  else if (was?.state !== 'ringing') toast(`${name} left the call`);
};

frameHooks.csig = async (m: { id: string; k: string; b: string; f?: string }) => {
  const c = cur();
  const u = m.f || c?.peer;
  if (!c || c.id !== m.id || !u) return;
  if (m.k === 'offer' || m.k === 'answer') return changed(c, u, m.k, m.b);
  const l = R.links.get(u);
  if (m.k !== 'ice' || !l) return;
  let cand: RTCIceCandidateInit;
  try { cand = await unseal(u, c.id, 'ice', m.b); } catch { return; }
  if (l.pc.remoteDescription) l.pc.addIceCandidate(cand).catch(() => {});
  else l.inIce.push(cand);
};

/** An offer or answer outside the ringing: someone joining connects to me, or a connection changes
 *  (a screen shared). If both change it at once, one of the two (always the same one) gives way,
 *  then tries again. */
async function changed(c: Call, u: string, k: 'offer' | 'answer', b: string) {
  let d: { sdp?: string };
  try { d = await unseal(u, c.id, 're' + k, b); } catch { return; }
  if (typeof d?.sdp !== 'string') return;
  let l = R.links.get(u);
  try {
    if (k === 'answer') {
      if (!l || l.pc.signalingState !== 'have-local-offer') return;
      await l.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
      if (!l.answered) { l.answered = true; flushIce(c.id, l); for (const cand of l.inIce.splice(0)) l.pc.addIceCandidate(cand).catch(() => {}); }
      return;
    }
    if (!l) { // a newcomer's connection, from someone already on the call
      if (c.phase === 'incoming' || c.phase === 'ended' || !getApp().friends[u] || await peerKeyChanged(u)) return;
      l = await link(c.id, u);
      setMember(u, { state: 'connecting' });
    }
    const clash = l.pc.signalingState !== 'stable';
    const polite = myName() > u;
    if (clash && !polite) return; // mine wins; theirs follows
    if (clash) await l.pc.setLocalDescription({ type: 'rollback' });
    await l.pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
    const answer = await l.pc.createAnswer();
    await l.pc.setLocalDescription(answer);
    sendFrame({ t: 'csig', id: c.id, k: 'answer', to: u, b: await seal(u, c.id, 'reanswer', { sdp: answer.sdp }) });
    if (!l.answered) { l.answered = true; flushIce(c.id, l); }
    if (clash) await renegotiate(c.id, l);
  } catch { /* the call carries on as it was */ }
}

frameHooks.cend = (m: { id: string; r: string }) => {
  const c = cur();
  if (!c || c.id !== m.id || c.phase === 'ended') return;
  switch (m.r) {
    case 'elsewhere': return finish('ok', null); // answered on another of my devices
    case 'declined': return finish('declined', 'Declined');
    case 'busy': return finish('busy', 'Busy on another call');
    case 'missed': return finish('missed', c.out ? 'No answer' : 'Missed call');
    case 'cancelled': return finish('cancelled', 'Missed call');
    case 'failed': return finish('failed', 'Call failed');
    default: return finish(anyAnswered() ? 'ok' : 'cancelled', 'Call ended');
  }
};

// Reconnected during a call: tell the server this device is still on it.
readyHooks.push(() => {
  const c = cur();
  if (c && c.phase !== 'ended' && c.phase !== 'incoming') sendFrame({ t: 'cre', id: c.id });
});
// Closing the app hangs up (capture: before the engine closes the connection on the same event).
window.addEventListener('pagehide', (e) => { if (!e.persisted) hangUp(); }, { capture: true });

// ---------- sounds ----------
let audio: AudioContext | null = null;
let tone = 0;
let vibrating = false;
function beep(freqs: number[], len: number, vol: number) {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const t = audio.currentTime;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + len - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    g.connect(audio.destination);
    for (const f of freqs) {
      const o = audio.createOscillator();
      o.frequency.value = f;
      o.connect(g);
      o.start(t);
      o.stop(t + len);
    }
  } catch { /* no audio */ }
}
function startTone(kind: 'ring' | 'ringback') {
  stopTone();
  const play = kind === 'ring'
    ? () => { beep([480, 620], 0.4, 0.12); window.setTimeout(() => beep([480, 620], 0.4, 0.12), 550); }
    : () => beep([440, 480], 1.2, 0.05);
  play();
  tone = window.setInterval(play, kind === 'ring' ? 2500 : 4000);
  if (kind === 'ring' && 'vibrate' in navigator) {
    vibrating = true;
    try { navigator.vibrate([700, 500, 700, 500, 700, 500, 700, 500, 700]); } catch { /* not allowed */ }
  }
}
function stopTone() {
  clearInterval(tone);
  tone = 0;
  if (vibrating) { vibrating = false; try { navigator.vibrate(0); } catch { /* ignore */ } }
}
const playEnd = () => { beep([480], 0.15, 0.08); window.setTimeout(() => beep([380], 0.25, 0.08), 180); };

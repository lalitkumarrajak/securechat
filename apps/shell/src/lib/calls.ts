// Voice and video calls with a friend, over WebRTC: the sound and picture go directly between the two
// devices, encrypted by WebRTC. Setting the call up goes through the server, sealed with the pair's
// conversation key, so the server can't put itself in the middle.
// Whoever placed the call writes it into the chat afterwards ("Missed voice call", "Video call · 3:24").
import { create } from 'zustand';
import { toast } from 'sonner';
import * as C from '@sanga/crypto';
import { api, frameHooks, myName, peerKey, peerKeyChanged, readyHooks, sendContent, sendFrame } from './engine';
import { getApp } from '../state/app';
import { useStories } from './stories';
import { displayName, isGroup, type CallStatus } from './types';

export type Phase = 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';
export interface Call {
  id: string; peer: string; video: boolean; out: boolean; phase: Phase;
  ringing?: boolean;       // placing it: their phone is reachable ("Ringing…" rather than "Calling…")
  started?: number;        // when it connected
  muted: boolean; camOff: boolean; facing: 'user' | 'environment';
  remoteMuted?: boolean; remoteCamOff?: boolean;
  reconnecting?: boolean;
  ended?: string;          // why it ended, shown for a moment
}
interface CallStore { call: Call | null; local: MediaStream | null; remote: MediaStream | null; minimized: boolean }
export const useCall = create<CallStore>(() => ({ call: null, local: null, remote: null, minimized: false }));

const set = (patch: Partial<Call>) => useCall.setState((s) => (s.call ? { call: { ...s.call, ...patch } } : {}));
const cur = () => useCall.getState().call;

// Per-call internals that the screen doesn't need.
let R = fresh();
function fresh() {
  return {
    pc: null as RTCPeerConnection | null,
    dc: null as RTCDataChannel | null,
    offer: '',                                 // incoming: their sealed-and-opened offer
    answered: false,                           // setup is done: send network details straight away
    outIce: [] as RTCIceCandidateInit[],       // gathered before that
    inIce: [] as RTCIceCandidateInit[],        // arrived before we could use them
    timers: [] as number[],
  };
}

// ---------- sealing the setup messages ----------
// Bound to who sends it to whom, the call and what it is, so nothing can be replayed elsewhere.
async function seal(peer: string, id: string, kind: string, obj: unknown) {
  return C.encryptMessage(await peerKey(peer), obj, myName(), peer, `call|${id}|${kind}`);
}
async function unseal(peer: string, id: string, kind: string, b: string) {
  return C.decryptMessage(await peerKey(peer), b, peer, myName(), `call|${id}|${kind}`);
}

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

async function makePc(id: string, peer: string) {
  const pc = new RTCPeerConnection({ iceServers: await iceServers() });
  R.pc = pc;
  pc.onicecandidate = (e) => {
    if (!e.candidate || cur()?.id !== id) return;
    const c = e.candidate.toJSON();
    if (R.answered) void sendIce(id, peer, c); else R.outIce.push(c);
  };
  pc.ontrack = (e) => {
    const stream = useCall.getState().remote || new MediaStream();
    if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track);
    useCall.setState({ remote: new MediaStream(stream.getTracks()) });
  };
  pc.ondatachannel = (e) => wireChannel(e.channel);
  let drop = 0;
  pc.onconnectionstatechange = () => {
    if (cur()?.id !== id) return;
    const s = pc.connectionState;
    clearTimeout(drop);
    if (s === 'connected') {
      stopTone();
      const c = cur()!;
      set({ phase: 'active', reconnecting: false, ...(!c.started && { started: Date.now() }) });
    } else if (s === 'disconnected') {
      set({ reconnecting: true });
      drop = window.setTimeout(() => { if (pc.connectionState !== 'connected') finish('ok', 'Connection lost'); }, 20_000);
    } else if (s === 'failed') {
      finish(cur()?.started ? 'ok' : 'failed', cur()?.started ? 'Connection lost' : 'Couldn’t connect');
    }
  };
  return pc;
}

async function sendIce(id: string, peer: string, c: RTCIceCandidateInit) {
  sendFrame({ t: 'csig', id, k: 'ice', b: await seal(peer, id, 'ice', c) });
}
function flushIce(id: string, peer: string) {
  for (const c of R.outIce.splice(0)) void sendIce(id, peer, c);
}

// Mute and camera state, straight to the other phone.
function wireChannel(dc: RTCDataChannel) {
  R.dc = dc;
  dc.onopen = () => sendState();
  dc.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      set({ remoteMuted: m.mic === false, remoteCamOff: m.cam === false });
    } catch { /* ignore */ }
  };
}
function sendState() {
  const c = cur();
  if (c && R.dc?.readyState === 'open') R.dc.send(JSON.stringify({ mic: !c.muted, cam: !c.camOff }));
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
  useCall.setState({ call: { id, peer, video, out: true, phase: 'outgoing', muted: false, camOff: false, facing: 'user' }, minimized: false });
  try {
    const local = await getMedia(video);
    if (cur()?.id !== id) { local.getTracks().forEach((t) => t.stop()); return; } // hung up meanwhile
    useCall.setState({ local });
    const pc = await makePc(id, peer);
    for (const t of local.getTracks()) pc.addTrack(t, local);
    wireChannel(pc.createDataChannel('state'));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (cur()?.id !== id) return;
    if (!sendFrame({ t: 'call', id, to: peer, v: video ? 1 : 0, b: await seal(peer, id, 'offer', { sdp: offer.sdp }) })) throw new Error('You’re offline');
    startTone('ringback');
    R.timers.push(window.setTimeout(() => { if (cur()?.id === id && !R.answered) { sendFrame({ t: 'cend', id, r: 'ended' }); finish('missed', 'No answer'); } }, 60_000));
  } catch (e) {
    toast.error((e as Error).message);
    finish('failed', null);
  }
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
    const pc = await makePc(c.id, c.peer);
    for (const t of local.getTracks()) pc.addTrack(t, local);
    await pc.setRemoteDescription({ type: 'offer', sdp: R.offer });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendFrame({ t: 'cans', id: c.id, b: await seal(c.peer, c.id, 'answer', { sdp: answer.sdp }) });
    R.answered = true;
    flushIce(c.id, c.peer);
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

/** Hang up (or cancel a call that hasn't been answered yet). */
export function hangUp() {
  const c = cur();
  if (!c || c.phase === 'ended') return;
  if (c.phase === 'incoming') return decline();
  sendFrame({ t: 'cend', id: c.id, r: 'ended' });
  finish(R.answered ? 'ok' : 'cancelled', 'Call ended');
}

/** The call is over: release the microphone and camera, log it, show why for a moment. */
function finish(st: CallStatus, label: string | null) {
  const c = cur();
  if (!c || c.phase === 'ended') return;
  stopTone();
  for (const t of R.timers) clearTimeout(t);
  R.pc?.close();
  useCall.getState().local?.getTracks().forEach((t) => t.stop());
  if (c.out) {
    const dur = st === 'ok' && c.started ? Math.round((Date.now() - c.started) / 1000) : 0;
    sendContent(c.peer, { type: 'call', v: c.video, dur, st }, undefined, true).catch(() => {});
  }
  R = fresh();
  if (!label) { useCall.setState({ call: null, local: null, remote: null, minimized: false }); return; }
  if (c.phase !== 'incoming') playEnd();
  useCall.setState({ call: { ...c, phase: 'ended', ended: label }, local: null, remote: null, minimized: false });
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
  if (!c?.video || !local || !R.pc) return;
  const facing = c.facing === 'user' ? 'environment' : 'user';
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing }, width: { ideal: 640 }, height: { ideal: 480 } } });
    const track = s.getVideoTracks()[0];
    track.enabled = !c.camOff;
    const sender = R.pc.getSenders().find((x) => x.track?.kind === 'video');
    await sender?.replaceTrack(track);
    for (const t of local.getVideoTracks()) { t.stop(); local.removeTrack(t); }
    local.addTrack(track);
    useCall.setState({ local: new MediaStream(local.getTracks()) });
    set({ facing });
  } catch { toast('This device has only one camera'); }
}

export const setMinimized = (minimized: boolean) => useCall.setState({ minimized });

// ---------- from the server ----------
frameHooks.call = async (m: { id: string; f: string; v: number; b: string }) => {
  const c = cur();
  if (c?.id === m.id) return; // rang again after reconnecting
  if (c) { sendFrame({ t: 'cend', id: m.id, r: 'busy' }); return; }
  if (!supported() || !getApp().friends[m.f] || await peerKeyChanged(m.f)) { sendFrame({ t: 'cend', id: m.id, r: 'failed' }); return; }
  let offer: { sdp?: string };
  try { offer = await unseal(m.f, m.id, 'offer', m.b); } catch { sendFrame({ t: 'cend', id: m.id, r: 'failed' }); return; }
  if (cur() || typeof offer?.sdp !== 'string') return;
  R = fresh();
  R.offer = offer.sdp;
  useCall.setState({ call: { id: m.id, peer: m.f, video: !!m.v, out: false, phase: 'incoming', muted: false, camOff: false, facing: 'user' }, minimized: false });
  useStories.setState({ viewer: null }); // full screen too: the call goes on top
  startTone('ring');
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
    const name = displayName(getApp().friends[m.f], m.f);
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(name, {
      body: `Incoming ${m.v ? 'video' : 'voice'} call`, icon: '/icon-192.png', tag: 'call-' + m.f, requireInteraction: true, data: { peer: m.f },
    })).catch(() => {});
  }
};

frameHooks.cring = (m: { id: string; on: boolean }) => { if (cur()?.id === m.id) set({ ringing: m.on }); };

frameHooks.cans = async (m: { id: string; b: string }) => {
  const c = cur();
  if (!c?.out || c.id !== m.id || !R.pc || R.answered) return;
  try {
    const { sdp } = await unseal(c.peer, c.id, 'answer', m.b);
    await R.pc.setRemoteDescription({ type: 'answer', sdp });
  } catch { sendFrame({ t: 'cend', id: c.id, r: 'failed' }); finish('failed', 'Couldn’t connect'); return; }
  R.answered = true;
  stopTone();
  set({ phase: 'connecting' });
  flushIce(c.id, c.peer);
  for (const cand of R.inIce.splice(0)) R.pc.addIceCandidate(cand).catch(() => {});
};

frameHooks.csig = async (m: { id: string; k: string; b: string }) => {
  const c = cur();
  if (!c || c.id !== m.id || !R.pc || m.k !== 'ice') return;
  let cand: RTCIceCandidateInit;
  try { cand = await unseal(c.peer, c.id, 'ice', m.b); } catch { return; }
  if (R.pc.remoteDescription) R.pc.addIceCandidate(cand).catch(() => {});
  else R.inIce.push(cand);
};

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
    default: return finish(R.answered ? 'ok' : 'cancelled', 'Call ended');
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

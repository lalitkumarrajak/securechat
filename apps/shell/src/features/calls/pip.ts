// The call in a small floating window (picture in picture), like WhatsApp: it stays over other apps while
// you leave Sanga, showing their video, or for a voice call their photo, name and how long it's been.
//
// Browsers only open one from a <video>: their video goes straight in; otherwise a small picture drawn
// on a canvas does. It opens from the button on the call screen, and by itself on leaving Sanga where
// the browser allows it (Chrome's automatic picture in picture for calls, Safari's autopictureinpicture).
// From the window you can mute, turn the camera off and hang up, where the browser shows those buttons.
import { hangUp, isGroupCall, toggleCamera, toggleMute, useCall, type Call } from '../../lib/calls';
import { getApp } from '../../state/app';
import { displayName } from '../../lib/types';
import { t } from '@sanga/i18n';
import { showsVideo, status } from './call-screen/helpers';

const W = 360, H = 480;
let video: HTMLVideoElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let drawn: MediaStream | null = null;
let timer = 0;
const photos = new Map<string, HTMLImageElement>();

export const canPip = () => typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && !!document.pictureInPictureEnabled;
const inPip = () => !!video && document.pictureInPictureElement === video;
const live = (c: Call | null): c is Call => !!c && c.phase !== 'ended' && c.phase !== 'incoming';

function el() {
  if (video) return video;
  video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.autoplay = true;
  video.setAttribute('autopictureinpicture', ''); // Safari: goes small by itself when you leave
  video.setAttribute('aria-hidden', 'true');
  video.dataset.callPip = '';
  Object.assign(video.style, { position: 'fixed', bottom: '0', left: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none' });
  document.body.appendChild(video);
  video.addEventListener('leavepictureinpicture', () => { if (!live(useCall.getState().call)) stop(); });
  return video;
}

function photo(u: string) {
  const url = getApp().avatars[u];
  if (!url) return null;
  let img = photos.get(url);
  if (!img) { img = new Image(); img.src = url; photos.set(url, img); }
  return img.complete && img.naturalWidth ? img : null;
}
const hue = (name: string) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };

/** The voice-call picture: their photo (or initial), name and the call's time. */
function draw() {
  const c = useCall.getState().call;
  if (!c || !canvas) return;
  const g = canvas.getContext('2d');
  if (!g) return;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f2b2a'); bg.addColorStop(1, '#05100f');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const group = isGroupCall(c);
  const friends = getApp().friends;
  const name = group ? t('Group call · {n} people', { n: c.members.length + 1 }) : displayName(friends[c.peer], c.peer);
  const r = 70, cx = W / 2, cy = 190;
  const img = group ? null : photo(c.peer);
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); g.clip();
  if (img) {
    const s = Math.max((2 * r) / img.naturalWidth, (2 * r) / img.naturalHeight);
    g.drawImage(img, cx - (img.naturalWidth * s) / 2, cy - (img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  } else {
    g.fillStyle = `hsl(${hue(c.peer)} 45% 48%)`; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    g.fillStyle = '#fff'; g.font = '600 60px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(group ? String(c.members.length + 1) : (name[0] ?? '?').toUpperCase(), cx, cy + 3);
  }
  g.restore();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '600 26px system-ui, sans-serif';
  g.fillText(name.length > 22 ? name.slice(0, 21) + '…' : name, cx, 310, W - 32);
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '20px system-ui, sans-serif';
  g.fillText(status(c, Date.now()), cx, 345, W - 32);
  if (c.muted) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '18px system-ui, sans-serif'; g.fillText(t('Muted'), cx, 380); }
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = '15px system-ui, sans-serif';
  g.fillText(t('🔒 End-to-end encrypted'), cx, H - 28, W - 32);
}

/** What the window shows now: their video when there is one, else the drawn picture. */
function source(): MediaStream | null {
  const { call: c, remotes } = useCall.getState();
  if (!live(c)) return null;
  const them = c.members[0];
  if (!isGroupCall(c) && them && c.phase === 'active' && showsVideo(c, them, remotes[them.u])) return new MediaStream(remotes[them.u].getVideoTracks());
  if (!canvas) { canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; }
  draw();
  drawn ??= canvas.captureStream(4);
  return drawn;
}

let shown = '';
function refresh() {
  if (!video) return;
  const s = source();
  if (!s) return;
  const id = s === drawn ? 'drawn' : s.getVideoTracks()[0]?.id ?? '';
  if (id !== shown) { shown = id; video.srcObject = s; void video.play().catch(() => {}); }
}

function startDrawing() {
  if (timer) return;
  timer = window.setInterval(() => { if (useCall.getState().call) { draw(); refresh(); } }, 1000);
}
function stop() {
  clearInterval(timer); timer = 0; shown = '';
  if (video) { video.srcObject = null; }
  drawn?.getTracks().forEach((tr) => tr.stop()); drawn = null;
}

/** Puts the call in the small window. From a tap (the browser wants one), or when leaving Sanga if allowed. */
export async function enterPip() {
  if (!canPip() || !live(useCall.getState().call)) return false;
  const v = el();
  startDrawing(); refresh();
  if (v.readyState < 1) await new Promise((r) => { v.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 1500); });
  try { await v.requestPictureInPicture(); return true; } catch { return false; }
}
export function exitPip() {
  if (inPip()) void document.exitPictureInPicture().catch(() => {});
}

// Ready while a call is on: the hidden <video> playing (Safari needs that to go small by itself), the
// media buttons the browser shows in the window, and Chrome's own "going small" when you leave.
function setHandler(action: string, fn: (() => void) | null) {
  try { navigator.mediaSession?.setActionHandler(action as MediaSessionAction, fn); } catch { /* not supported here */ }
}
let armed = false;
useCall.subscribe((s) => {
  const c = s.call;
  if (live(c)) {
    if (!canPip()) return;
    if (!armed) {
      armed = true;
      el(); startDrawing(); refresh();
      setHandler('enterpictureinpicture', () => void enterPip());
      setHandler('togglemicrophone', toggleMute);
      setHandler('togglecamera', () => { if (useCall.getState().call?.video) toggleCamera(); });
      setHandler('hangup', hangUp);
    } else refresh();
    const ms = navigator.mediaSession as MediaSession & { setMicrophoneActive?: (on: boolean) => void; setCameraActive?: (on: boolean) => void };
    try { ms.setMicrophoneActive?.(!c.muted); ms.setCameraActive?.(c.video && !c.camOff); } catch { /* ignore */ }
  } else if (armed) {
    armed = false;
    exitPip(); stop();
    for (const a of ['enterpictureinpicture', 'togglemicrophone', 'togglecamera']) setHandler(a, null);
  }
});

// Leaving Sanga during a call: try to go small (works where the browser lets a page do it without a tap).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && armed && !inPip()) void enterPip();
  if (document.visibilityState === 'visible' && inPip()) exitPip(); // back in Sanga: the full call screen again
});

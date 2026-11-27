// Songs on stories: a 30-second preview found by search (played from Apple's CDN), or a part you pick
// of a song from your phone or your Drive, made into a small clip that travels inside the sealed story.
import { api } from './engine';
import { t } from '@sanga/i18n';

export interface Song { title: string; artist: string; src: string; art?: string }
export interface SongHit extends Song { id: string }

export const CLIP_SECONDS = 20;
const CLIP_RATE = 22050;               // mono 16-bit: ~880 KB for 20 s
const MAX_CLIP_SRC = 1_300_000;        // characters of the clip's data URL

const PREVIEW_SRC = /^https:\/\/(audio-ssl\.itunes\.apple\.com|[a-z0-9.-]+\.mzstatic\.com)\//;
const ART_SRC = /^https:\/\/[a-z0-9.-]+\.mzstatic\.com\//;

/** What a friend's app sent: only Apple's preview hosts or a small audio clip play. */
export function validSong(o: any): Song | undefined {
  if (!o || typeof o !== 'object' || typeof o.src !== 'string') return undefined;
  const ok = PREVIEW_SRC.test(o.src) || (o.src.length <= MAX_CLIP_SRC && o.src.startsWith('data:audio/wav;base64,'));
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 100) : '';
  if (!ok || !title) return undefined;
  return {
    title, artist: typeof o.artist === 'string' ? o.artist.trim().slice(0, 100) : '', src: o.src,
    ...(typeof o.art === 'string' && ART_SRC.test(o.art) && { art: o.art }),
  };
}

export const searchSongs = (q: string) => api<{ songs: SongHit[] }>('/api/songs?q=' + encodeURIComponent(q)).then((r) => r.songs);

/** An audio file, opened to pick a part of it. */
export async function decodeSong(file: Blob): Promise<AudioBuffer> {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AC();
  try { return await ctx.decodeAudioData(await file.arrayBuffer()); }
  catch { throw new Error(t('That file can’t be played. Try an MP3, M4A or WAV.')); }
  finally { void ctx.close(); }
}

/** A song's title from its file name. */
export const songTitle = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim().slice(0, 100) || t('My song');

/** `CLIP_SECONDS` of the song from `start` (seconds), as a small mono WAV clip, gently faded in and out. */
export async function clipFrom(decoded: AudioBuffer, start: number, title: string, artist = ''): Promise<Song> {
  const from = Math.max(0, Math.min(start, Math.max(0, decoded.duration - 1)));
  const seconds = Math.min(CLIP_SECONDS, decoded.duration - from);
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * CLIP_RATE)), CLIP_RATE); // mixes down to mono
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start(0, from, seconds);
  const pcm = (await off.startRendering()).getChannelData(0);
  return { title: title.trim().slice(0, 100) || t('My song'), artist: artist.trim().slice(0, 100), src: wavDataUrl(pcm, from > 0) };
}

/** How loud each of `n` stretches of the song is (0–1), to draw it. */
export function peaks(decoded: AudioBuffer, n: number): number[] {
  const ch = decoded.getChannelData(0), step = Math.max(1, Math.floor(ch.length / n)), out: number[] = [];
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = i * step, e = Math.min(ch.length, j + step); j < e; j += 16) m = Math.max(m, Math.abs(ch[j]));
    out.push(m);
  }
  const top = Math.max(...out, 0.01);
  return out.map((v) => v / top);
}

function wavDataUrl(pcm: Float32Array, fadeIn = false) {
  const data = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
  data.setUint32(24, CLIP_RATE, true); data.setUint32(28, CLIP_RATE * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, pcm.length * 2, true);
  const fade = Math.min(pcm.length, Math.round(CLIP_RATE * 0.4)); // ease out the end, so the cut doesn't click
  const rise = fadeIn ? Math.min(pcm.length, Math.round(CLIP_RATE * 0.15)) : 0; // and in, when it starts mid-song
  for (let i = 0; i < pcm.length; i++) {
    const g = Math.min(i >= pcm.length - fade ? (pcm.length - i) / fade : 1, i < rise ? i / rise : 1);
    data.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i] * g)) * 32767), true);
  }
  let bin = '';
  const bytes = new Uint8Array(data.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'data:audio/wav;base64,' + btoa(bin);
}

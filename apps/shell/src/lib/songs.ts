// Songs on stories: a 30-second preview found by search (played from Apple's CDN), or the first
// seconds of a file from your phone, made into a small clip that travels inside the sealed story.
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

/** The first seconds of an audio file as a small mono WAV clip. */
export async function clipFromFile(file: File): Promise<Song> {
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AC();
  let decoded: AudioBuffer;
  try { decoded = await ctx.decodeAudioData(await file.arrayBuffer()); }
  catch { throw new Error(t('That file can’t be played. Try an MP3, M4A or WAV.')); }
  finally { void ctx.close(); }

  const seconds = Math.min(CLIP_SECONDS, decoded.duration);
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * CLIP_RATE)), CLIP_RATE); // mixes down to mono
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);

  const title = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim().slice(0, 100) || t('My song');
  return { title, artist: '', src: wavDataUrl(pcm) };
}

function wavDataUrl(pcm: Float32Array) {
  const data = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
  data.setUint32(24, CLIP_RATE, true); data.setUint32(28, CLIP_RATE * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, pcm.length * 2, true);
  const fade = Math.min(pcm.length, Math.round(CLIP_RATE * 0.4)); // ease out the end, so the cut doesn't click
  for (let i = 0; i < pcm.length; i++) {
    const g = i >= pcm.length - fade ? (pcm.length - i) / fade : 1;
    data.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i] * g)) * 32767), true);
  }
  let bin = '';
  const bytes = new Uint8Array(data.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'data:audio/wav;base64,' + btoa(bin);
}

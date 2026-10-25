// Voice notes: Opus at ~16 kbps (about 20 KB per 10 s), with a waveform measured while recording.
export const MAX_VOICE_SEC = 120;
const BARS = 48;

export interface Recording { src: string; dur: number; peaks: number[] }

const pickMime = () =>
  ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']
    .find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';

const blobToDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(b);
});

/** Squash a long list of levels into `n` bars, normalised to 0–1. */
export function downsample(levels: number[], n = BARS) {
  if (!levels.length) return Array(n).fill(0.05);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * levels.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / n));
    out.push(Math.max(...levels.slice(a, b)));
  }
  const max = Math.max(...out, 0.01);
  return out.map((v) => Math.round(Math.max(0.05, v / max) * 100) / 100);
}

export class VoiceRecorder {
  private rec?: MediaRecorder;
  private stream?: MediaStream;
  private ctx?: AudioContext;
  private chunks: Blob[] = [];
  private levels: number[] = [];
  private timer = 0;
  private started = 0;
  onLevel?: (level: number, elapsed: number) => void;
  onLimit?: () => void;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mimeType = pickMime();
    this.rec = new MediaRecorder(this.stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: 16000 });
    this.chunks = [];
    this.levels = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start(250);
    this.started = performance.now();
    this.ctx = new AudioContext();
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 512;
    this.ctx.createMediaStreamSource(this.stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    this.timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      const level = Math.sqrt(sum / buf.length);
      this.levels.push(level);
      const elapsed = (performance.now() - this.started) / 1000;
      this.onLevel?.(level, elapsed);
      if (elapsed >= MAX_VOICE_SEC) this.onLimit?.();
    }, 100);
  }

  private cleanup() {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
  }

  async stop(): Promise<Recording | null> {
    const rec = this.rec;
    if (!rec || rec.state === 'inactive') { this.cleanup(); return null; }
    const done = new Promise((r) => (rec.onstop = r));
    rec.stop();
    await done;
    this.cleanup();
    const dur = Math.min(MAX_VOICE_SEC, (performance.now() - this.started) / 1000);
    if (dur < 0.5) return null; // too short to be intentional
    const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
    return { src: await blobToDataUrl(blob), dur: Math.round(dur * 10) / 10, peaks: downsample(this.levels) };
  }

  cancel() {
    if (this.rec && this.rec.state !== 'inactive') { this.rec.onstop = null; this.rec.stop(); }
    this.cleanup();
  }
}

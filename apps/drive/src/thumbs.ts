// Small pictures of a file for the list (made on this device when it's uploaded, kept in the file's
// sealed record), and HEIC photos turned into JPEG so the browser can show them.
import { isHeic, kindOf } from './kinds';

const THUMB = 360;      // longest side, in pixels
const MAX_LEN = 36_000; // characters of the data URL: it has to fit in the file's record

function draw(src: CanvasImageSource, w: number, h: number): string | undefined {
  if (!w || !h) return undefined;
  for (const [side, q] of [[THUMB, 0.72], [260, 0.6], [180, 0.5]] as const) {
    const scale = Math.min(1, side / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    let url = c.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', q);
    if (url.length <= MAX_LEN) return url;
  }
  return undefined;
}

/** A HEIC photo as a JPEG the browser can show. */
export async function fromHeic(blob: Blob): Promise<Blob> {
  const { heicTo } = await import('heic-to/csp');
  return heicTo({ blob, type: 'image/jpeg', quality: 0.92 });
}

export interface Thumb { thumb?: string; w?: number; h?: number; pages?: number; duration?: number }

/** A picture of the file and what's known about it, or nothing (never throws). */
export async function makeThumb(file: Blob, mime: string, name: string): Promise<Thumb> {
  try {
    const k = kindOf(mime, name);
    if (k === 'image') return await imageThumb(isHeic(mime, name) ? await fromHeic(file) : file);
    if (k === 'video') return await videoThumb(file);
    if (k === 'pdf') return await pdfThumb(file);
  } catch { /* no picture (or a locked PDF): the list shows the kind's icon */ }
  return {};
}

async function imageThumb(file: Blob): Promise<Thumb> {
  const bmp = await createImageBitmap(file);
  try { return { thumb: draw(bmp, bmp.width, bmp.height), w: bmp.width, h: bmp.height }; } finally { bmp.close(); }
}

function videoThumb(file: Blob) {
  return new Promise<Thumb>((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const timer = setTimeout(() => done(), 15_000);
    const done = (x: Thumb = {}) => { clearTimeout(timer); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); resolve(x); };
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
    v.onseeked = () => done({ thumb: draw(v, v.videoWidth, v.videoHeight), w: v.videoWidth, h: v.videoHeight, duration: Number.isFinite(v.duration) ? Math.round(v.duration) : undefined });
    v.onerror = () => done();
  });
}

/** pdf.js (downloaded the first time a PDF is shown) opening the bytes; `password` for a locked one. */
export async function loadPdf(data: ArrayBuffer, password?: string) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  return pdfjs.getDocument({ data: new Uint8Array(data), password });
}

async function pdfThumb(file: Blob): Promise<Thumb> {
  const task = await loadPdf(await file.arrayBuffer());
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const view = page.getViewport({ scale: Math.min(2, (THUMB * 1.5) / vp.width) });
    const c = document.createElement('canvas');
    c.width = Math.round(view.width);
    c.height = Math.round(view.height);
    await page.render({ canvas: c, viewport: view }).promise;
    return { thumb: draw(c, c.width, c.height), pages: doc.numPages };
  } finally { void task.destroy(); }
}

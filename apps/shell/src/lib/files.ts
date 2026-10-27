// Files are sent inside the encrypted message, with a preview made on the sender's device:
// the first page of a PDF, a frame of a video, or the start of a text file.
import { unb64 } from '@sanga/crypto';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface FileContent { name: string; size: number; mime: string; src: string; thumb?: string; text?: string; pages?: number }

const readAsDataUrl = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as string);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(b);
});

function canvasThumb(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, max = 480) {
  const scale = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  draw(ctx, c.width, c.height);
  const url = c.toDataURL('image/webp', 0.7);
  return url.startsWith('data:image/webp') ? url : c.toDataURL('image/jpeg', 0.7);
}

async function pdfPreview(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const scale = Math.min(2, 480 / vp.width);
  const view = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.round(view.width);
  c.height = Math.round(Math.min(view.height, view.width * 1.1)); // top of the first page
  await page.render({ canvas: c, viewport: view }).promise;
  const thumb = canvasThumb((ctx, w, h) => ctx.drawImage(c, 0, 0, w, h), c.width, c.height);
  const pages = doc.numPages;
  await task.destroy();
  return { thumb, pages };
}

function videoThumb(src: string) {
  return new Promise<string | undefined>((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = src;
    const done = (t?: string) => { v.removeAttribute('src'); v.load(); resolve(t); };
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => done(canvasThumb((ctx, w, h) => ctx.drawImage(v, 0, 0, w, h), v.videoWidth || 320, v.videoHeight || 180));
    v.onerror = () => done();
    setTimeout(() => done(), 5000);
  });
}

export async function prepareFile(file: File): Promise<FileContent> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`Files can be up to ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  const mime = file.type || 'application/octet-stream';
  const src = await readAsDataUrl(file);
  const out: FileContent = { name: file.name.slice(0, 200) || 'file', size: file.size, mime, src };
  try {
    if (mime === 'application/pdf' || /\.pdf$/i.test(file.name)) Object.assign(out, await pdfPreview(file));
    else if (mime.startsWith('video/')) out.thumb = await videoThumb(src);
    else if (mime.startsWith('text/') || /\.(txt|md|csv|json|log)$/i.test(file.name)) out.text = (await file.slice(0, 2000).text()).slice(0, 400);
  } catch { /* send without a preview */ }
  return out;
}

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** A short label for the file type, e.g. PDF, DOCX, MP4. */
export const fileExt = (name: string, mime: string) =>
  (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] || mime.split('/')[1] || 'file').toUpperCase().slice(0, 5);

// Decoded by hand: fetch() on a data: URL is blocked by the connect-src 'self' policy.
function dataUrlBlob(src: string) {
  const comma = src.indexOf(',');
  return new Blob([unb64(src.slice(comma + 1)) as Uint8Array<ArrayBuffer>], { type: src.slice(5, comma).replace(/;base64$/, '') });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Download a data: URL as a file (via a blob, which works for large files on phones). */
export const downloadDataUrl = (src: string, name: string) => downloadBlob(dataUrlBlob(src), name);

/** Save photos to the device. On phones this opens the share sheet, whose "Save Image" puts them
 *  in the gallery (a plain download there ends up in Files, if anywhere); elsewhere they download. */
export async function savePhotos(photos: { src: string; ts: number }[]) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const files = photos.map(({ src, ts }, i) => {
    const blob = dataUrlBlob(src);
    const d = new Date(ts);
    const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const name = `Sanga ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}${photos.length > 1 ? ` (${i + 1})` : ''}.${ext}`;
    return new File([blob], name, { type: blob.type });
  });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files })) {
    try { await navigator.share({ files }); return; }
    catch (e) { if ((e as Error).name === 'AbortError') return; } // closed the share sheet
  }
  // Several downloads at once get blocked by some browsers, so they go one after another.
  for (const [i, f] of files.entries()) setTimeout(() => downloadBlob(f, f.name), i * 250);
}

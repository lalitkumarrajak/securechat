import { toast } from 'sonner';

// Photos are downscaled and re-encoded on the device before encryption: a 4 MB camera
// photo typically becomes 100–250 KB, which matters a lot on slow connections.
export async function compressImage(file: Blob, maxDim = 1280) {
  const bmp = await decode(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  if ('close' in bmp) bmp.close();
  let src = '';
  for (const q of [0.72, 0.55, 0.4]) {
    src = canvas.toDataURL('image/webp', q);
    if (!src.startsWith('data:image/webp')) src = canvas.toDataURL('image/jpeg', q);
    if (src.length < 1_100_000) break;
  }
  if (src.length > 1_400_000) throw new Error('That photo is too large');
  return { src, w, h };
}

/** The part of a photo to keep, in the photo's own pixels (a square). */
export interface Crop { x: number; y: number; side: number }

/** Profile photo: the chosen square (centre by default), shrunk to 512 px (usually 25–60 KB). Returns base64. */
export async function squarePhoto(file: Blob, crop?: Crop, size = 512) {
  const bmp = await decode(file);
  const side = crop?.side ?? Math.min(bmp.width, bmp.height);
  const x = crop?.x ?? (bmp.width - side) / 2;
  const y = crop?.y ?? (bmp.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(size, Math.round(side));
  const g = canvas.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, x, y, side, side, 0, 0, canvas.width, canvas.height);
  if ('close' in bmp) bmp.close();
  let url = '';
  for (const q of [0.85, 0.7, 0.55, 0.4]) { // the server takes up to 180 000 base64 characters
    url = canvas.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', q);
    if (url.length < 170_000) break;
  }
  if (url.length >= 170_000 && size > 256) return squarePhoto(file, crop, 256); // a very detailed photo: smaller still
  return url.slice(url.indexOf(',') + 1);
}

/** Decodes a photo. Some phones' photos (very large ones) only open through an <img>, and HEIC/HEIF
 *  camera photos (iPhones, many Android phones) are converted first where the browser can't open them. */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try { return await createImageBitmap(file); } catch { /* try an <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    if (await isHeic(file)) return createImageBitmap(await fromHeic(file));
    throw new Error(UNREADABLE);
  } finally { URL.revokeObjectURL(url); }
}

const UNREADABLE = 'Couldn’t open that photo. Try another one, or take a screenshot of it and use that.';
const PHOTO_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|hif|tiff?)$/i;

/** HEIC/HEIF files say so in their first bytes ("ftypheic", "ftypmif1", …). */
async function isHeic(file: Blob) {
  const head = new TextDecoder().decode(await file.slice(4, 12).arrayBuffer());
  return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(head);
}

/** Converts a HEIC/HEIF photo to JPEG on the device. The converter (~3 MB) only loads when needed. */
async function fromHeic(file: Blob) {
  try {
    const { heicTo } = await import('heic-to/csp');
    return await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
  } catch { throw new Error('Couldn’t convert that HEIC photo. Try another one, or take a screenshot of it and use that.'); }
}

/** Is this a photo? Phones sometimes leave the type empty for HEIC camera photos. */
export async function isPhoto(file: File) {
  return file.type.startsWith('image/') || PHOTO_EXT.test(file.name) || (await isHeic(file));
}

/** A photo this browser can show (for the crop screen): HEIC/HEIF is converted to JPEG if needed. */
export async function readablePhoto(file: File): Promise<File> {
  if (!(await isHeic(file))) return file;
  try { (await createImageBitmap(file)).close(); return file; } catch { /* convert it */ }
  const jpeg = await fromHeic(file);
  return new File([jpeg], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
}

/** A picked photo, ready for the crop screen: HEIC is converted first, with a toast while it works. */
export async function pickPhoto(file: File): Promise<File | null> {
  if (!(await isPhoto(file))) { toast.error('Choose a photo'); return null; }
  const t = (await isHeic(file)) ? toast.loading('Preparing photo…') : undefined;
  try { const f = await readablePhoto(file); toast.dismiss(t); return f; }
  catch (e) { toast.error((e as Error).message, { id: t }); return null; }
}

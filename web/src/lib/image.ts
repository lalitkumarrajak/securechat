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
  for (const q of [0.85, 0.7, 0.55]) { // the server takes up to 180 000 base64 characters
    url = canvas.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', q);
    if (url.length < 170_000) break;
  }
  return url.slice(url.indexOf(',') + 1);
}

/** Decodes a photo. Some phones' photos (very large, or HEIC from iPhones) only open through an <img>. */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try { return await createImageBitmap(file); } catch { /* try an <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('Couldn’t open that photo. Try a JPEG or PNG, or take a screenshot of it and use that.');
  } finally { URL.revokeObjectURL(url); }
}

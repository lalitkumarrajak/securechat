// Photos are downscaled and re-encoded on the device before encryption: a 4 MB camera
// photo typically becomes 100–250 KB, which matters a lot on slow connections.
export async function compressImage(file: Blob, maxDim = 1280) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  let src = '';
  for (const q of [0.72, 0.55, 0.4]) {
    src = canvas.toDataURL('image/webp', q);
    if (!src.startsWith('data:image/webp')) src = canvas.toDataURL('image/jpeg', q);
    if (src.length < 1_100_000) break;
  }
  if (src.length > 1_400_000) throw new Error('That photo is too large');
  return { src, w, h };
}

/** Profile photo: centre-crop to a square and shrink to 320 px (usually 10–25 KB). Returns base64. */
export async function squarePhoto(file: Blob, size = 320) {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error("Couldn't read that image"); }
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close?.();
  let url = canvas.toDataURL('image/webp', 0.8);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.85);
  return url.slice(url.indexOf(',') + 1);
}

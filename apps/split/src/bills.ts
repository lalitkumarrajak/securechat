// Bill photos: made small on this device before they are sealed and sent (a phone photo is several MB).
import * as C from '@sanga/crypto';
import { t } from '@sanga/i18n';

export interface Bill { mime: string; data: string } // data: base64

const MAX_BYTES = 700_000;      // after shrinking
const MAX_PDF_BYTES = 900_000;
export const ACCEPT = 'image/' + '*,application/pdf'; // in two parts: the i18n checker would read a slash-star as a comment

const toB64 = async (blob: Blob) => C.b64(new Uint8Array(await blob.arrayBuffer()));

async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error(t('This photo can’t be read here. Try a JPEG or PNG.'));
  let edge = 1600;
  for (let attempt = 0; attempt < 5; attempt++) {
    const k = Math.min(1, edge / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * k));
    canvas.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; // transparent PNGs become white, not black, as a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.72 - attempt * 0.08));
    if (blob && blob.size <= MAX_BYTES) { bmp.close?.(); return blob; }
    edge = Math.round(edge * 0.75);
  }
  bmp.close?.();
  throw new Error(t('That photo is too big to attach.'));
}

/** A picked file as a bill ready to seal: photos are resized to JPEG, PDFs must already be small. */
export async function prepareBill(file: File): Promise<Bill> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error(t('That PDF is too big. Attach a photo or a smaller PDF.'));
    return { mime: 'application/pdf', data: await toB64(file) };
  }
  if (!file.type.startsWith('image/')) throw new Error(t('Attach a photo or a PDF.'));
  const blob = await shrink(file);
  return { mime: 'image/jpeg', data: await toB64(blob) };
}

export const billUrl = (b: Bill) => URL.createObjectURL(new Blob([C.unb64(b.data) as BlobPart], { type: b.mime }));

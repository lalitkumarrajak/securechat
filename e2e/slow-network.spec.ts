// A weak phone signal (e2e/slow-proxy.mjs between the browser and the server): Chat still works, and a
// text sent right after a photo arrives long before the photo (big frames go in pieces, server/parts.js).
import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { slowProxy } from './slow-proxy.mjs';
import { bubble, makeFriends, phone, signUp, uname, PHONE } from './helpers';
const PORT = Number(process.env.E2E_PORT || 4321);
const NET = { rttMs: Number(process.env.RTT || 1000), kbps: Number(process.env.KBPS || 256) };

// A photo that doesn't compress well (noise), like a real camera photo.
function noisePng(w: number, h: number) {
  const raw = crypto.randomBytes((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const crc = (buf: Buffer) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('on a slow link a text sent after a photo arrives first', async ({ browser }) => {
  test.setTimeout(600_000);
  const FAST = { rttMs: 0, kbps: 1e6 };
  const pa = slowProxy({ listen: 4400, target: { port: PORT }, ...FAST });
  const pb = slowProxy({ listen: 4401, target: { port: PORT }, ...FAST });
  const A = await phone(browser, uname('slowa'), { ...PHONE, baseURL: 'http://localhost:4400' });
  const B = await phone(browser, uname('slowb'), { ...PHONE, baseURL: 'http://localhost:4401' });
  await signUp(A); await signUp(B);
  await makeFriends(A, B);
  await A.page.getByRole('button', { name: new RegExp(B.u) }).first().click();
  await B.page.getByRole('button', { name: new RegExp(A.u) }).first().click();
  pa.setNet(NET); pb.setNet(NET);
  const box = A.page.getByRole('textbox', { name: /message/i }).last();
  await box.fill('warm up'); await A.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(bubble(B, 'warm up')).toBeVisible({ timeout: 60_000 });
  // The photo, then a text straight after it.
  await A.page.locator('input[data-kind="gallery"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: noisePng(1600, 1200) });
  await A.page.getByRole('button', { name: 'Send photo' }).click();
  const t0 = Date.now();
  await box.fill('sent after the photo'); await A.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(bubble(B, 'sent after the photo')).toBeVisible({ timeout: 300_000 });
  const text = Date.now() - t0;
  await expect(B.page.locator('img[alt="Photo"]').last()).toBeVisible({ timeout: 300_000 });
  const photo = Date.now() - t0;
  const size = await A.page.evaluate(() => [...document.querySelectorAll('img[alt="Photo"]')].map((i) => (i as HTMLImageElement).src.length).pop());
  console.log('SLOWCHAT', JSON.stringify({ net: NET, photoBytes: size, textArrivedMs: text, photoArrivedMs: photo, errors: [...A.errors, ...B.errors].slice(0, 5) }));
  expect(text).toBeLessThan(photo);
  await A.ctx.close(); await B.ctx.close(); await pa.close(); await pb.close();
});

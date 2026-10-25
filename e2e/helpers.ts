import { expect, type Browser, type BrowserContext, type CDPSession, type Locator, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const PASSWORD = 'correct horse battery';
const run = crypto.randomBytes(2).toString('hex');
export const uname = (base: string) => `${base}${run}`;

export const PHONE = { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export interface Phone { ctx: BrowserContext; page: Page; cdp: CDPSession; errors: string[]; u: string }

/** A fresh "phone": its own browser context (separate storage), touch screen, console error capture. */
export async function phone(browser: Browser, u: string, opts: object = PHONE): Promise<Phone> {
  const ctx = await browser.newContext(opts);
  const p = { ctx, errors: [] as string[], u } as Phone;
  await newTab(p);
  return p;
}

/** Open a new tab for this phone (same storage, so still signed in) and make it the current one. */
export async function newTab(p: Phone) {
  p.page = await p.ctx.newPage();
  p.page.on('pageerror', (e) => p.errors.push('pageerror: ' + e.message));
  p.page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_INTERNET_DISCONNECTED/.test(m.text())) p.errors.push(m.text()); });
  p.cdp = await p.ctx.newCDPSession(p.page);
}

export async function signUp(p: Phone) {
  await p.page.goto('/');
  await p.page.getByRole('tab', { name: 'Create account' }).click();
  const form = p.page.getByRole('tabpanel');
  await form.getByLabel('Username').fill(p.u);
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await form.getByLabel('Confirm password').fill(PASSWORD);
  await form.getByRole('button', { name: 'Create account' }).click();
  await expect(p.page.getByRole('heading', { name: 'Chattrix', level: 1 })).toBeVisible({ timeout: 20_000 });
}

export async function signIn(p: Phone) {
  await p.page.goto('/');
  const form = p.page.getByRole('tabpanel');
  await form.getByLabel('Username').fill(p.u);
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(p.page.getByRole('heading', { name: 'Chattrix', level: 1 })).toBeVisible({ timeout: 20_000 });
}

async function center(l: Locator) {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const touch = (p: Phone, type: string, points: { x: number; y: number }[]) =>
  p.cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: points });

export async function longPress(p: Phone, l: Locator, ms = 700) {
  await l.scrollIntoViewIfNeeded();
  const c = await center(l);
  await touch(p, 'touchStart', [c]);
  await p.page.waitForTimeout(ms);
  await touch(p, 'touchEnd', []);
}

export async function swipeRight(p: Phone, l: Locator, dist = 110) {
  await l.scrollIntoViewIfNeeded();
  const c = await center(l);
  const x0 = c.x - 60;
  await touch(p, 'touchStart', [{ x: x0, y: c.y }]);
  for (let i = 1; i <= 10; i++) {
    await touch(p, 'touchMove', [{ x: x0 + (dist * i) / 10, y: c.y }]);
    await p.page.waitForTimeout(16);
  }
  await touch(p, 'touchEnd', []);
}

export const bubble = (p: Phone, text: string | RegExp) => p.page.locator('[data-k]').filter({ hasText: text }).last();

/** A real 400×300 PNG (colour gradient) to send as a photo. */
export function testPng(w = 400, h = 300) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3;
    raw[o] = (x * 255) / w; raw[o + 1] = 140; raw[o + 2] = (y * 255) / h;
  }
  const crc = (buf: Buffer) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

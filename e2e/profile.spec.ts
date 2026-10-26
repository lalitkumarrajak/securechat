// End-to-end: cropping and viewing profile photos, search highlighting, replying with the
// keyboard already focused, keeping messages above the keyboard, and the privacy screen.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { bubble, longPress, phone, signUp, swipeRight, testPng, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let P: Phone, Q: Phone;
const box = (p: Phone) => p.page.getByRole('textbox', { name: 'Message' });
const blurred = (l: import('@playwright/test').Locator) => l.evaluate((el) => getComputedStyle(el).filter.includes('blur'));

test.beforeAll(async ({ browser }) => {
  [P, Q] = await Promise.all([phone(browser, uname('pia')), phone(browser, uname('quinn'))]);
});
test.afterAll(async () => { for (const p of [P, Q]) await p?.ctx.close(); });

test('set up: two friends with a few messages', async () => {
  await Promise.all([signUp(P), signUp(Q)]);
  await P.page.getByRole('button', { name: 'Friends' }).click();
  await P.page.getByRole('tab', { name: 'Add' }).click();
  await P.page.getByPlaceholder('Search by username').fill(Q.u);
  await P.page.locator('li').filter({ hasText: '@' + Q.u }).getByRole('button', { name: 'Add' }).click();
  await P.page.keyboard.press('Escape');
  await Q.page.getByRole('button', { name: 'Friends' }).click();
  await Q.page.locator('li').filter({ hasText: P.u }).getByRole('button', { name: 'Accept' }).click();
  await expect(Q.page.getByText(`You and ${P.u} are now friends`)).toBeVisible();
  await Q.page.keyboard.press('Escape');
  await Q.page.locator('aside').getByRole('button', { name: new RegExp(P.u) }).first().click(); // "Say hi to your friend"
  for (let i = 1; i <= 14; i++) {
    await box(Q).fill(i === 7 ? 'Want a banana split later?' : `Message number ${i}`);
    await Q.page.getByRole('button', { name: 'Send' }).tap();
  }
  await expect(bubble(Q, 'Message number 14')).toBeVisible();
  await P.page.locator('aside li').filter({ hasText: Q.u }).click();
  await expect(bubble(P, 'Message number 14')).toBeVisible();
});

test('profile photo: choose the part to keep, then view it', async () => {
  await P.page.getByRole('button', { name: 'Back' }).click(); // to the chat list
  await P.page.getByRole('button', { name: 'Profile and settings' }).click();
  await P.page.getByRole('button', { name: new RegExp(P.u) }).first().click(); // the profile row
  await P.page.locator('input[type=file][accept="image/*"]').first().setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: testPng(400, 300) });
  const crop = P.page.getByRole('dialog', { name: 'Profile photo' });
  await expect(crop).toBeVisible();
  // Drag the photo all the way right, so its left (least red) side ends up in the circle
  const stage = crop.getByRole('img', { name: 'Photo to crop' });
  const b = (await stage.boundingBox())!;
  await P.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await P.page.mouse.down();
  await P.page.mouse.move(b.x + b.width, b.y + b.height / 2, { steps: 5 });
  await P.page.mouse.up();
  await crop.getByRole('button', { name: 'Use photo' }).click();
  await expect(P.page.getByText('Profile photo updated').first()).toBeVisible();

  const view = P.page.getByRole('button', { name: 'View profile photo' });
  await expect(view.locator('img')).toBeVisible();
  const red = await view.locator('img').evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i];
    return { avg: sum / (d.length / 4), w: c.width };
  });
  expect(red.w).toBe(300); // the whole height of the photo, at full resolution
  expect(red.avg).toBeLessThan(110); // a centre crop would average ~128

  await view.click();
  await expect(P.page.getByRole('dialog', { name: 'Photo' }).locator('img')).toBeVisible();
  await P.page.keyboard.press('Escape');
  await P.page.keyboard.press('Escape');
  await P.page.locator('aside li').filter({ hasText: Q.u }).click();
});

test("friends' profiles: tap their photo, or Contact info in the chat menu", async () => {
  await P.page.getByRole('button', { name: 'Back' }).click(); // to the chat list
  await P.page.getByRole('button', { name: `${Q.u}’s profile` }).click();
  const card = P.page.getByRole('dialog', { name: Q.u });
  await expect(card).toContainText('@' + Q.u);
  await card.getByRole('button', { name: 'Info' }).click();
  await expect(P.page.getByRole('dialog', { name: 'Contact info' })).toBeVisible();
  await P.page.getByRole('button', { name: 'Close' }).click();
  await P.page.getByRole('button', { name: 'Chat options' }).click();
  await P.page.getByRole('menuitem', { name: 'Contact info' }).click();
  await expect(P.page.getByRole('dialog', { name: 'Contact info' })).toBeVisible();
  await P.page.getByRole('button', { name: 'Close' }).click();

  // Q sees P's new (cropped) photo full size from the friends list
  await Q.page.getByRole('button', { name: 'Back' }).click();
  await Q.page.getByRole('button', { name: 'Friends' }).click();
  await Q.page.getByRole('button', { name: `${P.u}’s profile` }).click();
  await Q.page.getByRole('button', { name: `View ${P.u}’s photo` }).click();
  await expect(Q.page.getByRole('dialog', { name: 'Photo' }).locator('img')).toBeVisible();
  await Q.page.keyboard.press('Escape');
  await Q.page.keyboard.press('Escape');
  await Q.page.keyboard.press('Escape');
});

test('camera photos without a file type still send', async () => {
  await P.page.locator('input[data-kind="gallery"]').setInputFiles({ name: 'IMG_20261026.jpg', mimeType: '', buffer: testPng(400, 300) });
  await P.page.getByRole('button', { name: 'Send photo' }).click();
  await expect(P.page.locator('[data-k] img[alt="Photo"]')).toHaveCount(1, { timeout: 15_000 });
  await Q.page.locator('aside li').filter({ hasText: P.u }).click();
  await expect(Q.page.locator('[data-k] img[alt="Photo"]')).toHaveCount(1, { timeout: 15_000 });
});

test('several photos at once: review, swipe, remove, caption; they arrive as one album', async () => {
  const drag = async (page: import('@playwright/test').Page, el: import('@playwright/test').Locator, by: number) => {
    await expect(el).toBeInViewport({ ratio: 1 }); // the slide animation has finished
    const r = (await el.boundingBox())!;
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2 + by, r.y + r.height / 2, { steps: 8 });
    await page.mouse.up();
  };
  await P.page.locator('input[data-kind="gallery"]').setInputFiles([1, 2, 3].map((n) => ({ name: `pic${n}.png`, mimeType: 'image/png', buffer: testPng(200 + n * 40, 150) })));
  const review = P.page.getByRole('dialog', { name: new RegExp(`photos? to ${Q.u}`) });
  await expect(review.getByRole('heading', { name: `3 photos to ${Q.u}` })).toBeVisible();
  await drag(P.page, review.getByRole('img', { name: 'Photo 1 of 3' }), -200); // swipe to the next one
  await expect(review.getByRole('img', { name: 'Photo 2 of 3' })).toBeVisible();
  await review.getByRole('button', { name: 'Remove photo 3' }).click();
  await review.getByRole('textbox', { name: 'Caption' }).fill('Look at this view');
  await review.getByRole('button', { name: 'Send 2 photos' }).click();
  await expect(review).toBeHidden();

  // One bubble with both photos and the caption, on both phones
  for (const p of [P, Q]) {
    const album = p.page.getByRole('group', { name: '2 photos' }).last();
    await expect(album.getByRole('img')).toHaveCount(2, { timeout: 20_000 });
    await expect(p.page.locator('[data-k]').last()).toContainText('Look at this view');
  }

  // The viewer swipes through all the chat's photos, both ways
  await Q.page.getByRole('group', { name: '2 photos' }).last().getByRole('button', { name: 'View photo 1 of 2' }).click();
  const viewer = Q.page.getByRole('dialog').filter({ has: Q.page.getByRole('button', { name: 'Close' }) }).last();
  const counter = async () => Number((await viewer.getByText(/^\d+ of \d+$/).textContent())!.split(' ')[0]);
  const start = await counter();
  await expect(viewer.getByText('Look at this view')).toHaveCount(0); // that caption is on the second photo
  await Q.page.keyboard.press('ArrowRight');
  await expect.poll(counter).toBe(start + 1);
  await expect(viewer.getByText('Look at this view')).toBeVisible();
  await drag(Q.page, viewer.getByRole('img', { name: new RegExp(`Photo ${start + 1} of`) }), 220); // swipe back
  await expect.poll(counter).toBe(start);
  await drag(Q.page, viewer.getByRole('img', { name: new RegExp(`Photo ${start} of`) }), 220); // and further back, to older photos
  await expect.poll(counter).toBe(start - 1);
  await Q.page.keyboard.press('Escape');
});

test('a big album shows four tiles and "+N"; long-press acts on the whole album', async () => {
  await P.page.locator('input[data-kind="gallery"]').setInputFiles([1, 2, 3, 4, 5, 6].map((n) => ({ name: `b${n}.png`, mimeType: 'image/png', buffer: testPng(160 + n * 10, 120) })));
  await P.page.getByRole('button', { name: 'Send 6 photos' }).click();
  const album = Q.page.getByRole('group', { name: '6 photos' });
  await expect(album.getByRole('img')).toHaveCount(4, { timeout: 30_000 });
  await expect(album).toContainText('+2');
  await longPress(P, P.page.getByRole('group', { name: '6 photos' }));
  const sheet = P.page.getByRole('dialog', { name: 'Message options' });
  await expect(sheet).toContainText('📷 6 photos');
  await sheet.getByRole('button', { name: 'Delete' }).click();
  await P.page.getByRole('button', { name: 'Delete for everyone' }).click();
  await expect(Q.page.getByRole('group', { name: '6 photos' })).toHaveCount(0, { timeout: 15_000 });
  await expect(Q.page.getByRole('log').getByText('This message was deleted')).toHaveCount(6);
});

// Needs a real HEIC photo, e.g. libheif's examples/example.heic: HEIC_SAMPLE=/path/to/photo.heic
test('HEIC camera photos are converted on the phone and sent', async () => {
  test.skip(!process.env.HEIC_SAMPLE, 'set HEIC_SAMPLE to a .heic file');
  const buffer = fs.readFileSync(process.env.HEIC_SAMPLE!);
  const before = await Q.page.locator('[data-k] img[alt="Photo"]').count();
  await P.page.locator('input[data-kind="gallery"]').setInputFiles({ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer });
  await expect(P.page.getByRole('img', { name: 'Photo 1 of 1' })).toBeVisible({ timeout: 60_000 }); // converted, so it shows
  await P.page.getByRole('button', { name: 'Send photo' }).click();
  await expect(Q.page.locator('[data-k] img[alt="Photo"]')).toHaveCount(before + 1, { timeout: 60_000 });
  // The converter first tries to fetch its code from a blob: URL (blocked by connect-src, harmless),
  // then uses its built-in copy. WebAssembly itself must not be blocked.
  P.errors = P.errors.filter((e) => !/Connecting to 'blob:.*connect-src/s.test(e));
  expect(P.errors).toEqual([]);
});

test('search highlights the words in the message', async () => {
  await P.page.getByRole('button', { name: 'Chat options' }).click();
  await P.page.getByRole('menuitem', { name: 'Search' }).click();
  await P.page.getByPlaceholder('Search messages').fill('split');
  const hit = bubble(P, 'banana split');
  await expect(hit.locator('mark')).toHaveText('split');
  await expect(hit).toBeInViewport(); // jumped to it without pressing Enter
  await P.page.getByRole('button', { name: 'Close search' }).click();
  await expect(P.page.locator('mark')).toHaveCount(0);
});

test('reply opens the keyboard even if the message box already has focus', async () => {
  await box(P).focus(); // keyboard put away with the back button: the box keeps focus
  await box(P).evaluate((el) => { (window as any).__refocused = 0; el.addEventListener('focus', () => (window as any).__refocused++); });
  await swipeRight(P, bubble(P, 'Message number 13').locator('div').first());
  await expect(P.page.getByText(`Replying to ${Q.u}`)).toBeVisible();
  expect(await P.page.evaluate(() => (window as any).__refocused)).toBeGreaterThan(0); // a fresh focus brings the keyboard back
  await expect(box(P)).toBeFocused();
  await P.page.getByRole('button', { name: 'Cancel reply' }).click();
});

test('the newest messages stay in view when the keyboard opens', async () => {
  const gap = () => P.page.evaluate(() => { const el = document.querySelector('[role=log]')!; return el.scrollHeight - el.scrollTop - el.clientHeight; });
  await P.page.getByRole('button', { name: 'Scroll to latest messages' }).click(); // the reply swipe scrolled up
  await expect.poll(gap).toBeLessThan(2); // finished scrolling down
  await P.page.setViewportSize({ width: 390, height: 430 }); // the keyboard takes the bottom of the screen
  await expect.poll(gap).toBeLessThan(2); // still at the very bottom
  await expect(P.page.locator('[data-k]').last()).toBeInViewport();
  await P.page.setViewportSize({ width: 390, height: 780 });
});

test('games: the chat offers every game, not just Ludo', async () => {
  await expect(P.page.getByRole('button', { name: 'Play Ludo' })).toHaveCount(0);
  await P.page.getByRole('button', { name: 'Play a game' }).click();
  const dlg = P.page.getByRole('dialog', { name: 'Play a game' });
  await expect(dlg.getByRole('button', { name: /UNO/ })).toBeVisible();
  await P.page.keyboard.press('Escape');
});

test('privacy screen blurs names and older messages; tap or the eye shows them', async () => {
  await P.page.getByRole('button', { name: 'Back' }).first().click(); // to the chat list
  await P.page.getByRole('button', { name: 'Profile and settings' }).click();
  await P.page.getByRole('button', { name: /Privacy/ }).click();
  await P.page.getByRole('switch', { name: 'Blur my chats' }).click();
  await P.page.getByRole('radio', { name: 'Last 5' }).click();
  await P.page.keyboard.press('Escape');

  const row = P.page.locator('aside li').filter({ hasText: Q.u }).locator('.priv').last();
  await expect.poll(() => blurred(row)).toBe(true);
  await P.page.locator('aside li').filter({ hasText: Q.u }).click();
  await expect(P.page.locator('[data-k]').last().locator('.priv')).toHaveCount(0); // the newest stay readable
  const older = bubble(P, 'Message number 11');
  await expect.poll(() => blurred(older.locator('.priv'))).toBe(true);
  await older.locator('.priv').tap();
  await expect(older).toHaveAttribute('data-peek', 'true');
  await expect.poll(() => blurred(older.locator('.priv'))).toBe(false);

  await P.page.getByRole('button', { name: 'Show chats for 30 seconds' }).click();
  await expect.poll(() => blurred(bubble(P, 'Message number 10').locator('.priv'))).toBe(false);
  await P.page.getByRole('button', { name: 'Blur chats' }).click();
  await expect.poll(() => blurred(bubble(P, 'Message number 10').locator('.priv'))).toBe(true);
  for (const p of [P, Q]) expect(p.errors).toEqual([]);
});

test('scrolling up loads older messages; search and jumps reach them too', async () => {
  // 400 older messages already on this phone (typing them would take minutes)
  await P.page.evaluate(async (peer) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('chattrix'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = db.transaction('msgs', 'readwrite');
    const base = Date.now() - 3 * 864e5;
    for (let i = 1; i <= 400; i++) {
      tx.objectStore('msgs').put({ k: `${peer}/old${i}`, cid: `old${i}`, peer, out: false, ts: base + i * 1000, s: 2, type: 'text', text: i === 5 ? 'Remember the old picnic?' : `Old message ${i}` });
    }
    await new Promise((res) => { tx.oncomplete = res; });
  }, Q.u);
  const reopen = async () => {
    await P.page.getByRole('button', { name: 'Back' }).click();
    await P.page.locator('aside li').filter({ hasText: Q.u }).click();
    await expect(bubble(P, 'Message number 14')).toBeAttached();
  };
  const oldest = P.page.getByText('Old message 1', { exact: true });
  await reopen();
  await expect(oldest).toHaveCount(0); // only the newest are loaded

  // Search finds a message far up, and jumping to it loads back to it
  await P.page.getByRole('button', { name: 'Chat options' }).click();
  await P.page.getByRole('menuitem', { name: 'Search' }).click();
  await P.page.getByPlaceholder('Search messages').fill('picnic');
  const hit = bubble(P, 'Remember the old picnic?');
  await expect(hit.locator('mark')).toHaveText('picnic');
  await expect(hit).toBeInViewport();
  await P.page.getByRole('button', { name: 'Close search' }).click();

  // Scrolling up loads a page at a time, keeping what you were reading in place
  await reopen();
  const log = P.page.locator('[role=log]');
  const firstLoaded = P.page.locator('[data-k]').first();
  const k = await firstLoaded.getAttribute('data-k');
  await log.evaluate((el) => { el.scrollTop = 0; });
  await expect.poll(() => P.page.locator('[data-k]').first().getAttribute('data-k')).not.toBe(k); // older ones came in above
  await expect(P.page.locator(`[data-k="${k}"]`)).toBeInViewport(); // and you stayed where you were
  for (let i = 0; i < 10 && !(await oldest.count()); i++) {
    await log.evaluate((el) => { el.scrollTop = 0; });
    await P.page.waitForTimeout(300);
  }
  await expect(oldest).toHaveCount(1); // all the way to the first message
  await expect(P.page.getByRole('status', { name: 'Loading older messages' })).toHaveCount(0);
  expect(P.errors).toEqual([]);
});

test('phones with the old on-device storage upgrade without losing messages', async ({ browser }) => {
  const R = await phone(browser, uname('rex'));
  await R.page.goto('/');
  // The version-1 database exactly as earlier versions of the app created it, with a message in it
  await R.page.evaluate(async () => {
    await new Promise((res) => { const r = indexedDB.deleteDatabase('chattrix'); r.onsuccess = r.onerror = r.onblocked = res; });
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('chattrix', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('kv');
        const msgs = d.createObjectStore('msgs', { keyPath: 'k' });
        msgs.createIndex('peer_ts', ['peer', 'ts']);
        msgs.createIndex('id', 'id');
        d.createObjectStore('outbox', { keyPath: 'cid' });
        d.createObjectStore('chats', { keyPath: 'peer' });
        d.createObjectStore('peers', { keyPath: 'u' });
        d.createObjectStore('avatars', { keyPath: 'u' });
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('msgs', 'readwrite');
    tx.objectStore('msgs').put({ k: 'old/1', cid: '1', peer: 'old', out: false, ts: 1, s: 2, type: 'img', src: 'data:image/png;base64,AA', w: 1, h: 1 });
    await new Promise((res) => { tx.oncomplete = res; });
    db.close();
  });
  await R.page.reload();
  await expect(R.page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
  const after = await R.page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('chattrix'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const store = db.transaction('msgs').objectStore('msgs');
    const keys = await new Promise<IDBValidKey[]>((res) => { const r = store.index('peer_type_ts').getAllKeys(); r.onsuccess = () => res(r.result); });
    return { version: db.version, keys };
  });
  expect(after).toEqual({ version: 2, keys: ['old/1'] }); // upgraded, message kept, and the new photo index finds it
  expect(R.errors).toEqual([]);
  await R.ctx.close();
});

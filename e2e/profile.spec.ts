// End-to-end: cropping and viewing profile photos, search highlighting, replying with the
// keyboard already focused, keeping messages above the keyboard, and the privacy screen.
import { test, expect } from '@playwright/test';
import { bubble, phone, signUp, swipeRight, testPng, uname, type Phone } from './helpers';

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
  await expect(bubble(P, 'Message number 14')).toBeInViewport();
  await P.page.setViewportSize({ width: 390, height: 430 }); // the keyboard takes the bottom of the screen
  await expect(bubble(P, 'Message number 14')).toBeInViewport();
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
  await P.page.getByRole('radio', { name: 'Last 1' }).click();
  await P.page.keyboard.press('Escape');

  const row = P.page.locator('aside li').filter({ hasText: Q.u }).locator('.priv').last();
  await expect.poll(() => blurred(row)).toBe(true);
  await P.page.locator('aside li').filter({ hasText: Q.u }).click();
  const last = bubble(P, 'Message number 14').locator('.priv');
  await expect(last).toHaveCount(0); // the newest message stays readable
  const older = bubble(P, 'Message number 13');
  await expect.poll(() => blurred(older.locator('.priv'))).toBe(true);
  await older.locator('.priv').tap();
  await expect(older).toHaveAttribute('data-peek', 'true');
  await expect.poll(() => blurred(older.locator('.priv'))).toBe(false);

  await P.page.getByRole('button', { name: 'Show chats for 30 seconds' }).click();
  await expect.poll(() => blurred(bubble(P, 'Message number 12').locator('.priv'))).toBe(false);
  await P.page.getByRole('button', { name: 'Blur chats' }).click();
  await expect.poll(() => blurred(bubble(P, 'Message number 12').locator('.priv'))).toBe(true);
  for (const p of [P, Q]) expect(p.errors).toEqual([]);
});

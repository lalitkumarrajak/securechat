// Drive sharing: a link anyone can open (no Sanga account), sharing with a friend, and taking it back.
// Passwords: Open copies the password first.
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { makeFriends, openApp, phone, signUp, testPng, uname } from './helpers';

const shots = process.env.DRIVE_SHOTS;

test('Drive: share by link and with a friend, then stop sharing', async ({ browser }) => {
  const a = await phone(browser, uname('shra'));
  const b = await phone(browser, uname('shrb'));
  await signUp(a); await signUp(b);
  await makeFriends(a, b);

  // a: a photo, and a folder with a photo in it.
  await openApp(a, 'Drive');
  const page = a.page;
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'sunset.png', mimeType: 'image/png', buffer: testPng(640, 480) }]);
  await expect(page.getByRole('button', { name: 'sunset.png', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Holiday');
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: /^Holiday/ }).click();
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'beach.png', mimeType: 'image/png', buffer: testPng(500, 400) }]);
  await expect(page.getByRole('button', { name: 'beach.png', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'My Drive', exact: true }).first().click();

  // The photo by link.
  await page.getByRole('button', { name: 'More for sunset.png' }).click();
  await page.getByRole('menuitem', { name: 'Share' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share “sunset.png”' });
  await dialog.getByRole('switch', { name: 'Anyone with the link' }).click();
  const linkBox = dialog.getByRole('textbox', { name: 'Link' });
  await expect(linkBox).toHaveValue(/\/apps\/drive\/share\.html#/);
  const photoLink = await linkBox.inputValue();
  if (shots) await page.screenshot({ path: path.join(shots, 'share-dialog.png') });
  await dialog.getByRole('button', { name: 'Done' }).click();

  // Someone without Sanga opens it: the photo shows.
  const guest = await browser.newContext();
  const g = await guest.newPage();
  await g.goto(photoLink);
  await expect(g.getByRole('dialog', { name: 'sunset.png' }).getByRole('img', { name: 'sunset.png' })).toBeVisible({ timeout: 20_000 });
  if (shots) await g.screenshot({ path: path.join(shots, 'share-link-photo.png') });

  // The folder by link: its photo, previewed.
  await page.getByRole('button', { name: 'More for Holiday' }).click();
  await page.getByRole('menuitem', { name: 'Share' }).click();
  const fd = page.getByRole('dialog', { name: 'Share “Holiday”' });
  await fd.getByRole('switch', { name: 'Anyone with the link' }).click();
  await expect(fd.getByRole('textbox', { name: 'Link' })).toHaveValue(/share\.html#/);
  const folderLink = await fd.getByRole('textbox', { name: 'Link' }).inputValue();

  // And with the friend.
  await fd.getByRole('checkbox', { name: b.u }).click();
  await fd.getByRole('button', { name: 'Share with 1' }).click();
  await expect(fd.getByRole('button', { name: 'Share with 1' })).toBeHidden();
  await fd.getByRole('button', { name: 'Done' }).click();

  await g.goto(folderLink);
  await g.reload();
  await expect(g.getByRole('heading', { name: 'Holiday' })).toBeVisible({ timeout: 20_000 });
  await g.getByRole('button', { name: 'beach.png', exact: true }).click();
  await expect(g.getByRole('dialog', { name: 'beach.png' }).getByRole('img', { name: 'beach.png' })).toBeVisible({ timeout: 20_000 });
  if (shots) await g.screenshot({ path: path.join(shots, 'share-link-folder.png') });

  // The friend finds it under Shared with me, from a, and opens the photo in it.
  await openApp(b, 'Drive');
  await b.page.getByRole('button', { name: 'Shared with me' }).click();
  await expect(b.page.getByText(`From ${a.u}`)).toBeVisible({ timeout: 20_000 });
  await b.page.getByRole('button', { name: /^Holiday/ }).click();
  await b.page.getByRole('button', { name: 'beach.png', exact: true }).click();
  await expect(b.page.getByRole('dialog', { name: 'beach.png' }).getByRole('img', { name: 'beach.png' })).toBeVisible({ timeout: 20_000 });
  if (shots) await b.page.screenshot({ path: path.join(shots, 'shared-with-me.png') });
  await b.page.keyboard.press('Escape');

  // A new photo in the folder reaches the link too.
  await page.getByRole('button', { name: /^Holiday/ }).click();
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([{ name: 'dinner.png', mimeType: 'image/png', buffer: testPng(300, 300) }]);
  await expect(page.getByRole('button', { name: 'dinner.png', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(async () => { await g.reload(); await expect(g.getByRole('button', { name: 'dinner.png', exact: true })).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 20_000 });

  // Taken off and link turned off: the friend no longer has it, the link stops working.
  await page.getByRole('button', { name: 'My Drive', exact: true }).first().click();
  await page.getByRole('button', { name: 'More for Holiday' }).click();
  await page.getByRole('menuitem', { name: 'Share' }).click();
  await fd.getByRole('checkbox', { name: b.u }).click();
  await fd.getByRole('button', { name: 'Stop sharing with friends' }).click();
  await expect(fd.getByRole('button', { name: 'Stop sharing with friends' })).toBeHidden();
  await fd.getByRole('switch', { name: 'Anyone with the link' }).click();
  await expect(fd.getByRole('textbox', { name: 'Link' })).toBeHidden();
  await fd.getByRole('button', { name: 'Done' }).click();
  await g.goto(folderLink); await g.reload();
  await expect(g.getByRole('heading', { name: 'This link doesn’t work any more' })).toBeVisible({ timeout: 20_000 });
  await b.page.getByRole('button', { name: 'My Drive', exact: true }).first().click();
  await b.page.getByRole('button', { name: 'Shared with me' }).click();
  await expect(b.page.getByRole('heading', { name: 'Nothing shared with you yet' })).toBeVisible({ timeout: 20_000 });

  for (const p of [a, b]) expect(p.errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await guest.close(); await a.ctx.close(); await b.ctx.close();
});

test('Passwords: Open copies the password, then opens the site', async ({ browser }) => {
  const a = await phone(browser, uname('pwo'));
  await signUp(a);
  await openApp(a, 'Passwords');
  const page = a.page;
  await page.getByRole('button', { name: 'Add a password' }).first().click();
  await page.locator('#p-title').fill('Example');
  await page.locator('#p-url').fill('http://localhost:4521/?site');
  await page.locator('#p-user').fill('me@example.com');
  await page.locator('#p-pass').fill('S3cret!pass');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const opened = a.ctx.waitForEvent('page');
  await page.getByRole('button', { name: 'Copy password and open site' }).click();
  await opened;
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('S3cret!pass');
  await expect(page.getByText('Password copied. Paste it on the site.')).toBeVisible();
  await a.ctx.close();
});

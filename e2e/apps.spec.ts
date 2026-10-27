// End-to-end: Sanga's separate apps (micro-frontends). The diary (apps/notes) is built on its own;
// the shell downloads it only when it's opened, it also runs on its own page, and a failed download
// can be retried without breaking the rest.
import { test, expect } from '@playwright/test';
import { PHONE, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let P: Phone;
const requests: string[] = [];
const appRequests = () => requests.filter((u) => u === '/apps.json' || u.startsWith('/apps/'));

test.beforeAll(async ({ browser }) => {
  P = await phone(browser, uname('modular'));
  P.page.on('request', (r) => requests.push(new URL(r.url()).pathname));
});
test.afterAll(async () => { await P?.ctx.close(); });

test('nothing from the diary is downloaded until it is opened', async () => {
  await signUp(P);
  await P.page.getByRole('button', { name: 'Menu' }).click(); // look around the app first
  await P.page.keyboard.press('Escape');
  await P.page.waitForTimeout(5000); // past the shell's own quiet preloading of its screens
  expect(appRequests()).toEqual([]);

  await P.page.getByRole('button', { name: 'Diary' }).click();
  const diary = P.page.getByRole('dialog', { name: 'Diary and notes' });
  await expect(diary.getByRole('heading', { name: 'Diary', exact: true })).toBeVisible();
  expect(appRequests()).toContain('/apps.json');
  expect(appRequests()).toContain('/apps/notes/remoteEntry.js');
  // It uses the shell's React and SDK instead of downloading its own.
  expect(appRequests().some((u) => /react-dom|__prebuild__react/.test(u))).toBe(false);

  await diary.getByRole('button', { name: 'New note' }).click();
  await diary.getByLabel('Note', { exact: true }).fill('Written in the shell');
  await expect(diary.getByRole('status')).toHaveText('Saved');
  await diary.getByRole('button', { name: 'Back to diary' }).click();
  await diary.getByRole('button', { name: 'Back', exact: true }).click();
  expect(P.errors).toEqual([]);
});

test('the diary also runs on its own page, with the same sign-in and notes', async () => {
  await P.page.goto('/apps/notes/');
  await expect(P.page.getByRole('heading', { name: 'Diary', exact: true })).toBeVisible();
  await expect(P.page.getByRole('button', { name: /Written in the shell/ })).toBeVisible();
  await P.page.getByRole('button', { name: 'New note' }).click();
  await P.page.getByLabel('Title').fill('Written on its own');
  await expect(P.page.getByRole('status')).toHaveText('Saved');
  await P.page.getByRole('button', { name: 'Back to diary' }).click();

  await P.page.getByRole('button', { name: 'Back', exact: true }).click(); // back to Sanga
  await expect(P.page.getByRole('heading', { name: P.u, level: 1 })).toBeVisible();
  await P.page.getByRole('button', { name: 'Diary' }).click();
  await expect(P.page.getByRole('dialog', { name: 'Diary and notes' }).getByRole('button', { name: /Written on its own/ })).toBeVisible();
  await P.page.keyboard.press('Escape');
  expect(P.errors).toEqual([]);
});

test('on its own and signed out, it asks you to sign in to Sanga', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/apps/notes/');
  await expect(page.getByText('Sign in to Sanga first.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Sanga' })).toHaveAttribute('href', '/');
  await ctx.close();
});

test('if an app can’t be downloaded, Sanga keeps working and it can be retried', async ({ browser }) => {
  const Q = await phone(browser, uname('offapp'), { ...PHONE, serviceWorkers: 'block' }); // so the blocked download really fails
  await signUp(Q);
  await Q.page.route('**/apps/notes/remoteEntry.js', (r) => r.abort());
  await Q.page.getByRole('button', { name: 'Diary' }).click();
  const diary = Q.page.getByRole('dialog', { name: 'Diary and notes' });
  await expect(diary.getByText('Couldn’t open the diary')).toBeVisible();
  await Q.page.unroute('**/apps/notes/remoteEntry.js');
  await diary.getByRole('button', { name: 'Try again' }).click();
  await expect(diary.getByRole('heading', { name: 'Diary', exact: true })).toBeVisible();
  await Q.ctx.close();
});

test('with an app lock on, its own page goes to Sanga’s lock screen instead of showing the diary', async ({ browser }) => {
  const Q = await phone(browser, uname('applock'));
  await signUp(Q);
  await Q.page.getByRole('button', { name: 'Profile and settings' }).click(); // as in lock.spec.ts
  await Q.page.getByRole('button', { name: /^Privacy/ }).click();
  await Q.page.getByRole('switch', { name: 'Lock with a PIN' }).click();
  const pin = Q.page.getByLabel('PIN', { exact: true });
  await pin.fill('2580');
  await Q.page.getByRole('button', { name: 'Next' }).click();
  await pin.fill('2580');
  await Q.page.getByRole('button', { name: 'Done' }).click();
  await expect(Q.page.getByText('App lock on').first()).toBeVisible();
  await Q.page.keyboard.press('Escape');

  await Q.page.goto('/apps/notes/');
  await expect(Q.page).toHaveURL(/\/$/);
  const lock = Q.page.getByRole('dialog', { name: 'Sanga is locked' });
  await expect(lock).toBeVisible();
  await expect(Q.page.getByRole('heading', { name: 'Diary', exact: true })).toHaveCount(0);
  await Q.page.keyboard.type('2580');
  await expect(Q.page.getByRole('heading', { level: 1, name: Q.u })).toBeVisible();
  expect(Q.errors).toEqual([]);
  await Q.ctx.close();
});

test('with “sign out when I close the tab” on, its own page goes to Sanga, which decides', async ({ browser }) => {
  const Q = await phone(browser, uname('appclose'));
  await signUp(Q);
  await Q.page.getByRole('button', { name: 'Profile and settings' }).click();
  await Q.page.getByRole('button', { name: /^Privacy/ }).click();
  await Q.page.getByRole('switch', { name: 'Sign out when I close the tab' }).click();
  await Q.page.keyboard.press('Escape');

  await Q.page.goto('/apps/notes/');
  await expect(Q.page).toHaveURL(/\/$/);
  // The same tab a moment later counts as a reload: still signed in, but in the shell, not the diary.
  await expect(Q.page.getByRole('heading', { level: 1, name: Q.u })).toBeVisible();
  await expect(Q.page.getByRole('heading', { name: 'Diary', exact: true })).toHaveCount(0);
  await Q.ctx.close();
});

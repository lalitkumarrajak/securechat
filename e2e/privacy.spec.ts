// End-to-end: "sign out when I close the tab", and "join me on Sanga" invite links.
import { test, expect } from '@playwright/test';
import { PASSWORD, newTab, phone, signedOutView, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let P: Phone, Q: Phone;
const signedIn = (p: Phone) => expect(p.page.getByRole('heading', { name: p.u, level: 1 }).first()).toBeVisible({ timeout: 15_000 });
const signedOut = (p: Phone) => expect(signedOutView(p.page)).toBeVisible({ timeout: 15_000 });

test.beforeAll(async ({ browser }) => {
  P = await phone(browser, uname('priv'));
  Q = await phone(browser, uname('newbie'));
  for (const p of [P, Q]) await p.page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined }); });
});
test.afterAll(async () => { for (const p of [P, Q]) await p?.ctx.close(); });

test('invite link: someone signs up from it and sends a friend request', async () => {
  await signUp(P);
  await P.page.getByRole('button', { name: 'Friends' }).click();
  await P.page.getByRole('tab', { name: /Add/ }).click();
  await expect(P.page.getByText('Invite someone to Sanga')).toBeVisible();
  await P.page.getByRole('button', { name: 'Copy link' }).click();
  await expect(P.page.getByText('Link copied').first()).toBeVisible();
  const link = await P.page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(new RegExp(`/\\?add=${P.u}$`));
  await P.page.keyboard.press('Escape');

  await Q.page.goto(link);
  await expect(Q.page.getByText(`@${P.u} invited you to Sanga`)).toBeVisible();
  // Sign up by hand: the app opens the friend-request prompt straight away, over the chat list
  await Q.page.getByRole('tab', { name: 'Create account' }).click();
  const form = Q.page.getByRole('tabpanel');
  await form.getByLabel('Username').fill(Q.u);
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await form.getByLabel('Confirm password').fill(PASSWORD);
  await form.getByRole('button', { name: 'Create account' }).click();
  const dlg = Q.page.getByRole('alertdialog');
  await expect(dlg).toContainText(`Add @${P.u} as a friend?`);
  await dlg.getByRole('button', { name: 'Send friend request' }).click();
  await expect(Q.page.getByText('Friend request sent').first()).toBeVisible();
  await P.page.getByRole('button', { name: 'Friends' }).click(); // P has the request
  await P.page.getByRole('tab', { name: /Requests/ }).click();
  await expect(P.page.getByText('@' + Q.u).first()).toBeVisible();
  await P.page.keyboard.press('Escape');
});

test('normally, closing the tab keeps you signed in', async () => {
  await P.page.close();
  await newTab(P);
  await P.page.goto('/');
  await signedIn(P);
});

test('with the setting on: reloads and extra tabs keep you in, closing the tab signs you out', async () => {
  await P.page.getByRole('button', { name: 'Profile and settings' }).click();
  await P.page.getByRole('button', { name: /^Privacy/ }).click();
  await P.page.getByRole('switch', { name: 'Sign out when I close the tab' }).click();
  await expect(P.page.getByText('You’ll be signed out when you close this tab')).toBeVisible();

  await P.page.reload();
  await signedIn(P);

  // A second tab while the first is open: still signed in
  const first = P.page;
  await newTab(P);
  await P.page.goto('/');
  await signedIn(P);
  await P.page.close();
  P.page = first;

  // Close the last tab, open Sanga again: signed out, nothing left on the device
  await P.page.close({ runBeforeUnload: true });
  await newTab(P);
  await P.page.goto('/');
  await signedOut(P);
  const left = await P.page.evaluate(async () => (await indexedDB.databases()).length);
  expect(left).toBeLessThanOrEqual(1); // the (now empty) app database may exist, but holds no session
  await P.page.reload();
  await signedOut(P);
  expect(P.errors.filter((e) => !/401/.test(e))).toEqual([]);
});

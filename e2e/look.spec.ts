// End-to-end: no top bar on Chats (it's all in Account), loading placeholders, and the installable app's icons.
import { test, expect } from '@playwright/test';
import { newTab, phone, signUp, uname, type Phone, tab } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

test.beforeAll(async ({ browser }) => { P = await phone(browser, uname('look')); });
test.afterAll(async () => { await P?.ctx.close(); });

test('Chats has no top bar: your name, friends and settings are in the Account tab', async () => {
  await signUp(P);
  for (const name of ['Friends', 'Menu', 'Profile and settings']) await expect(P.page.getByRole('button', { name, exact: true })).toHaveCount(0);
  await P.page.screenshot({ path: shots('30-header-title') });
  await tab(P, 'Account').click();
  const acc = P.page.getByRole('region', { name: 'Account' });
  await expect(acc.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible();
  await expect(acc.getByRole('button', { name: new RegExp('@' + P.u) })).toBeVisible();
  for (const name of [/^New chat/, /^New group/, /^New story/, /^Friends/, /^Archived chats/, /^Appearance/, /^Sign-in and security/, /^Sign out/]) await expect(acc.getByRole('button', { name })).toBeVisible();
  await tab(P, 'Chats').click();
});

test('placeholders show while chats are loading, not a spinner', async () => {
  await P.page.close();
  await newTab(P);
  await P.page.routeWebSocket(/\/ws$/, () => { /* never answers: chats stay "loading" */ });
  await P.page.goto('/');
  await expect(P.page.getByRole('status', { name: 'Loading chats' })).toBeVisible();
  await P.page.screenshot({ path: shots('31-loading-skeleton') });
});

test('the app has real icons to install with', async () => {
  const m = await (await P.page.request.get('/manifest.webmanifest')).json();
  expect(m.icons.length).toBeGreaterThanOrEqual(2);
  for (const ic of m.icons) {
    const r = await P.page.request.get(ic.src);
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toContain('image/png');
    expect((await r.body()).length).toBeGreaterThan(5000); // not a blank image
  }
  expect((await P.page.request.get('/apple-touch-icon.png')).status()).toBe(200);
});

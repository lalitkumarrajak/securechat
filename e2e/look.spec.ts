// End-to-end: header title, loading placeholders, and the installable app's icons.
import { test, expect } from '@playwright/test';
import { newTab, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

test.beforeAll(async ({ browser }) => { P = await phone(browser, uname('look')); });
test.afterAll(async () => { await P?.ctx.close(); });

test('the header shows my username, and a title I choose', async () => {
  await signUp(P); // waits for the heading with the username
  await P.page.getByRole('button', { name: 'Profile and settings' }).click();
  await P.page.getByRole('button', { name: new RegExp('@' + P.u) }).click();
  await P.page.getByLabel('Title at the top').fill('Lalit’s chats');
  await P.page.getByRole('button', { name: 'Save' }).click();
  await expect(P.page.getByText('Profile saved').first()).toBeVisible();
  await P.page.keyboard.press('Escape');
  await P.page.keyboard.press('Escape');
  await expect(P.page.getByRole('heading', { level: 1, name: 'Lalit’s chats' })).toBeVisible();
  await P.page.screenshot({ path: shots('30-header-title') });
  // Clearing it goes back to the username
  await P.page.getByRole('button', { name: 'Profile and settings' }).click();
  await P.page.getByRole('button', { name: new RegExp('@' + P.u) }).click();
  await P.page.getByLabel('Title at the top').fill('');
  await P.page.getByRole('button', { name: 'Save' }).click();
  await P.page.keyboard.press('Escape');
  await P.page.keyboard.press('Escape');
  await expect(P.page.getByRole('heading', { level: 1, name: P.u })).toBeVisible();
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

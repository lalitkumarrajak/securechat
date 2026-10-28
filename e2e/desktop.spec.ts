// End-to-end: Sanga on a laptop. The chat list stays a column on the left with the chat beside it,
// whichever tab you've been on (the diary once broke this), and everything opens where it should.
import { test, expect, type Locator } from '@playwright/test';
import { makeFriends, phone, signUp, tab, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

const LAPTOP = { viewport: { width: 1366, height: 768 } };
let P: Phone, Q: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const width = async (l: Locator) => (await l.boundingBox())?.width ?? 0;
/** Two columns: the list on the left (not the whole width), the chat area beside it. */
async function twoColumns(p: Phone) {
  const list = p.page.locator('aside');
  await expect(list).toBeVisible();
  expect(await width(list)).toBeLessThan(500);
  await expect(p.page.locator('main')).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  [P, Q] = await Promise.all([phone(browser, uname('lap'), LAPTOP), phone(browser, uname('lapq'), LAPTOP)]);
});
test.afterAll(async () => { for (const p of [P, Q]) await p?.ctx.close(); });

test('set up: two friends on laptops', async () => {
  await Promise.all([signUp(P), signUp(Q)]);
  await makeFriends(P, Q);
  await twoColumns(P);
});

test('after the diary, Chats and Stories are still two columns', async () => {
  await tab(P, 'Diary').click();
  const diary = P.page.getByRole('region', { name: 'Diary and notes' });
  await expect(diary.getByRole('heading', { name: 'Diary', exact: true })).toBeVisible();
  await expect(diary.getByRole('status', { name: /Opening/ })).toHaveCount(0);
  await P.page.screenshot({ path: shots('60-laptop-diary') });

  await tab(P, 'Chats').click();
  await twoColumns(P);
  await tab(P, 'Stories').click();
  await twoColumns(P);
  await expect(P.page.getByRole('region', { name: 'Stories' })).toBeVisible();
  await tab(P, 'Games').click();
  await expect(P.page.getByRole('button', { name: 'Play Ludo' })).toBeVisible();
  await tab(P, 'Chats').click();
  await twoColumns(P);
  await P.page.screenshot({ path: shots('61-laptop-chats') });
});

test('a friend from Friends opens their chat beside the list', async () => {
  await P.page.getByRole('button', { name: 'Friends' }).click();
  await P.page.getByRole('dialog').locator('li').filter({ hasText: Q.u }).first().click();
  await expect(P.page.getByRole('dialog')).toHaveCount(0);
  await expect(P.page.locator('#composer-input')).toBeVisible();
  await twoColumns(P);
  await P.page.locator('#composer-input').fill('Hello from the laptop');
  await P.page.keyboard.press('Enter');
  await expect(Q.page.locator('aside li').filter({ hasText: P.u })).toContainText('Hello from the laptop');
  await Q.page.locator('aside li').filter({ hasText: P.u }).click();
  await expect(Q.page.locator('[data-k]').filter({ hasText: 'Hello from the laptop' })).toBeVisible();
  await twoColumns(Q);
});

test('from the Stories and Games tabs, a friend still opens their chat', async () => {
  for (const t of ['Stories', 'Games', 'Diary']) {
    await tab(P, t).click();
    if (t !== 'Stories') await tab(P, 'Chats').click(); // Friends is above the chat list
    await P.page.getByRole('button', { name: 'Friends' }).click();
    await P.page.getByRole('dialog').locator('li').filter({ hasText: Q.u }).first().click();
    await expect(P.page.locator('#composer-input')).toBeVisible();
    await twoColumns(P);
  }
});

test('notes about this chat, then Back: the chat is still open', async () => {
  await P.page.getByRole('button', { name: 'Chat options' }).click();
  await P.page.getByRole('menuitem', { name: 'Notes about this chat' }).click();
  const diary = P.page.getByRole('region', { name: 'Diary and notes' });
  await expect(diary.getByRole('heading', { name: `Notes · ${Q.u}` })).toBeVisible();
  await diary.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(P.page.locator('#composer-input')).toBeVisible();
  await twoColumns(P);
  expect([...P.errors, ...Q.errors]).toEqual([]);
});

test('an emoji-only reply is big and animated, with the message it answers', async () => {
  await P.page.locator('aside li').filter({ hasText: Q.u }).click();
  const msg = P.page.locator('[data-k]').filter({ hasText: 'Hello from the laptop' }).first();
  await msg.hover();
  await msg.getByRole('button', { name: 'Message options' }).click();
  await P.page.getByRole('menuitem', { name: 'Reply' }).click();
  await P.page.locator('#composer-input').fill('😂');
  await P.page.keyboard.press('Enter');
  for (const p of [P, Q]) {
    const reply = p.page.locator('[data-k]').filter({ has: p.page.locator('.big-emoji') }).last();
    await expect(reply).toContainText('Hello from the laptop'); // the quote
    await expect(reply.locator('.big-emoji')).toHaveAttribute('aria-label', '😂'); // text until its animation loads, then a picture
  }
  await Q.page.screenshot({ path: shots('62-emoji-reply') });
});

test('Stories shows my photo once: on "My story", not in the top bar too', async () => {
  await tab(P, 'Stories').click();
  await expect(P.page.getByRole('heading', { level: 1, name: 'Stories' })).toBeVisible();
  await expect(P.page.getByRole('button', { name: 'Profile and settings' })).toHaveCount(0);
  await expect(P.page.getByRole('region', { name: 'Stories' }).getByText('My story')).toBeVisible();
  await P.page.screenshot({ path: shots('63-stories-header') });
  await tab(P, 'Chats').click();
  await expect(P.page.getByRole('button', { name: 'Profile and settings' })).toBeVisible();
});

test('a newer Sanga on the server: the app switches to it by itself', async () => {
  // Opened once with the service worker in charge, so the next start comes from the saved copy.
  await P.page.goto('/');
  await P.page.evaluate(() => navigator.serviceWorker.ready);
  await P.page.reload();
  await expect.poll(() => P.page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // "Deploy" a new build: the page the server sends now names another build first.
  await P.ctx.route((url) => url.pathname === '/', async (route) => {
    const res = await route.fetch();
    const headers = Object.fromEntries(Object.entries(res.headers()).filter(([k]) => !/^content-(encoding|length)$/i.test(k))); // the body below is plain
    route.fulfill({ status: res.status(), headers, body: (await res.text()).replace('<head>', '<head><!-- /assets/index-newer.js -->') });
  });
  const reloads: string[] = [];
  P.page.on('framenavigated', (f) => { if (f === P.page.mainFrame()) reloads.push(f.url()); });
  await P.page.reload(); // still the saved copy; the newer one arrives in the background…
  await expect.poll(() => reloads.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2); // …and the app reloads into it
  await expect(P.page.getByRole('heading', { level: 1, name: P.u })).toBeVisible();
  await P.ctx.unroute((url) => url.pathname === '/');
});

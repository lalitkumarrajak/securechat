// End-to-end: opening the app again after being away. The chat list shows what this device already
// has at once, says it's catching up while the messages that came in meanwhile arrive, and doesn't
// flash a "Connecting…" banner when the connection comes up quickly. Split's first page doesn't flash
// an empty "make a group" screen or numbers that jump while the groups load.
import { test, expect, type Page } from '@playwright/test';
import { makeFriends, openAuth, PASSWORD, phone, signUp, tab, testPng, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let A: Phone, B: Phone;
const BACKLOG = 120;

/** Every 25ms from the first paint: what the warning banner, the "updating" note and the row for `peer` say. */
const RECORD = (peer: string) => {
  const w = window as unknown as { __tl: { t: number; banner: string; updating: boolean; row: string }[] };
  w.__tl = [];
  const t0 = performance.now();
  setInterval(() => {
    const banner = [...document.querySelectorAll('[role=status]')].map((e) => e.textContent || '').filter((s) => /Connecting|offline/.test(s)).join('|');
    const updating = !!document.querySelector('[data-testid=chats-updating]');
    const row = [...document.querySelectorAll('li')].find((li) => li.textContent?.includes(peer))?.textContent || '';
    w.__tl.push({ t: Math.round(performance.now() - t0), banner, updating, row });
  }, 25);
};
const timeline = (p: Page) => p.evaluate(() => (window as unknown as { __tl: { t: number; banner: string; updating: boolean; row: string }[] }).__tl);

/** A mid-range phone on mobile data: a quarter of a laptop's speed, 150ms each way. */
async function slowPhone(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.5e6 / 8 * 1024 / 1024 * 1024, uploadThroughput: 750e3 / 8 });
}

test.beforeAll(async ({ browser }) => {
  [A, B] = await Promise.all([phone(browser, uname('sta')), phone(browser, uname('stb'))]);
});
test.afterAll(async () => { for (const p of [A, B]) await p?.ctx.close(); });

test('chats: what came in while away shows soon, with a note while it catches up, and no banner flash', async () => {
  test.setTimeout(180_000);
  await Promise.all([signUp(A), signUp(B)]);
  await makeFriends(A, B);
  await A.page.getByRole('button', { name: 'Friends' }).click();
  await A.page.getByRole('button', { name: `Message ${B.u}` }).click();
  const input = A.page.getByRole('textbox', { name: 'Message' });
  await input.fill('before you left');
  await A.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(B.page.locator('li').filter({ hasText: 'before you left' })).toBeVisible();
  await B.page.close();

  for (let i = 1; i <= BACKLOG; i++) { await input.fill(`while away ${i}`); await A.page.getByRole('button', { name: 'Send', exact: true }).click(); }
  await expect(A.page.locator('[data-k]').filter({ hasText: `while away ${BACKLOG}` }).last()).toBeVisible();
  await A.page.waitForTimeout(500);

  const page = await B.ctx.newPage();
  await slowPhone(page);
  await page.addInitScript(RECORD, A.u);
  await page.goto('/');
  await expect(page.locator('li').filter({ hasText: A.u })).toContainText(`while away ${BACKLOG}`, { timeout: 30_000 });
  await expect(page.getByTestId('chats-updating')).toBeHidden();
  const tl = await timeline(page);
  const firstRow = tl.find((x) => x.row);
  const latest = tl.find((x) => x.row.includes(`while away ${BACKLOG}`))!;
  const stale = tl.filter((x) => x.row && !x.row.includes(`while away ${BACKLOG}`));
  const banner = tl.filter((x) => x.banner);
  console.log(`startup: list at ${firstRow?.t}ms, latest at ${latest.t}ms, stale for ${stale.length * 25}ms, banner for ${banner.length * 25}ms, `
    + `updating note during stale: ${stale.filter((x) => x.updating).length}/${stale.length}`);
  expect(latest.t, 'the latest message reaches the list soon').toBeLessThan(6000);
  expect(banner.length * 25, 'no "Connecting…" flash when the connection comes up quickly').toBe(0);
  // While the list still shows what this device had, it says it's catching up.
  expect(stale.filter((x) => x.row && !x.updating).length, 'old preview shown without the "updating" note').toBeLessThanOrEqual(2);
  B.page = page;

  // The list's line for a photo follows the language: switching rewrites the ones already there.
  await A.page.locator('input[data-kind="gallery"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: testPng() });
  await A.page.getByRole('button', { name: 'Send photo' }).click();
  const row = page.locator('li').filter({ hasText: A.u });
  await expect(row).toContainText('📷 Photo');
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByRole('button', { name: /Language/ }).click();
  await page.getByRole('radio', { name: 'मराठी' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'mr');
  await page.keyboard.press('Escape');
  await expect(row).toContainText('📷 फोटो');
  await page.getByRole('button', { name: 'प्रोफाइल आणि सेटिंग्ज' }).click();
  await page.getByRole('button', { name: /भाषा/ }).click();
  await page.getByRole('radio', { name: /English/ }).click();
  await page.keyboard.press('Escape');
  await expect(row).toContainText('📷 Photo');
});

test('split: a fresh device shows its groups without an empty-screen flash or jumping totals', async ({ browser }) => {
  test.setTimeout(120_000);
  // A makes two groups with B and adds a few expenses.
  await A.page.keyboard.press('Escape'); // out of the chat: the tabs are along the bottom again
  await tab(A, 'Split').click();
  const split = A.page.getByRole('region', { name: 'Split' });
  for (const name of ['Flat', 'Trip']) {
    await split.getByRole('button', { name: 'New group' }).first().click();
    const d = A.page.getByRole('dialog', { name: 'New group' });
    await d.locator('input').first().fill(name);
    await d.getByRole('button', { name: 'Create group' }).click();
    await expect(split.getByRole('heading', { name })).toBeVisible();
    await split.getByRole('tab', { name: /People/ }).click();
    await split.getByRole('button', { name: 'Add people' }).click();
    const add = A.page.getByRole('dialog', { name: 'Add people' });
    await add.locator('li').filter({ hasText: B.u }).getByRole('button', { name: 'Add' }).click();
    await expect(add.locator('li').filter({ hasText: B.u })).toHaveCount(0);
    await A.page.keyboard.press('Escape');
    await split.getByRole('tab', { name: /Expenses/ }).click();
    for (const [amt, desc] of [['300', 'Groceries'], ['900', 'Dinner'], ['150', 'Snacks']]) {
      await split.getByRole('button', { name: 'Add expense' }).click();
      const e = A.page.getByRole('dialog', { name: 'Add expense' });
      await e.getByLabel(/^Amount/).fill(amt);
      await e.getByLabel('What was it for?').fill(desc);
      await e.getByRole('button', { name: 'Add expense' }).click();
      await expect(e).toBeHidden();
    }
    if (await split.getByRole('button', { name: 'Back to groups' }).isVisible()) await split.getByRole('button', { name: 'Back to groups' }).click();
  }

  // B signs in on a new device: nothing of Split saved there yet.
  const fresh = await phone(browser, B.u);
  try {
    await fresh.page.goto('/');
    await openAuth(fresh.page, 'Sign in');
    const form = fresh.page.getByRole('tabpanel');
    await form.getByLabel('Username').fill(B.u);
    await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await form.getByRole('button', { name: 'Sign in' }).click();
    await expect(tab(fresh, 'Split')).toBeVisible({ timeout: 20_000 });
    await fresh.page.evaluate(() => {
      const w = window as unknown as { __sp: { t: number; empty: boolean; owe: string; groups: number }[] };
      w.__sp = [];
      const t0 = performance.now();
      setInterval(() => {
        const r = document.querySelector('[aria-label="Split"]');
        const text = r?.textContent || '';
        w.__sp.push({ t: Math.round(performance.now() - t0), empty: text.includes('Create your first group'),
          owe: (text.match(/You owe\s*([^A-Za-z]*)/) || [])[1] || '', groups: r?.querySelectorAll('ul > li button[aria-current]').length || 0 });
      }, 20);
    });
    await tab(fresh, 'Split').click();
    const fsplit = fresh.page.getByRole('region', { name: 'Split' });
    await expect(fsplit.getByRole('button', { name: /Flat/ })).toBeVisible({ timeout: 20_000 });
    await expect(fsplit.getByRole('button', { name: /Trip/ })).toBeVisible();
    await fresh.page.waitForTimeout(1500);
    const sp = await fresh.page.evaluate(() => (window as unknown as { __sp: { t: number; empty: boolean; owe: string; groups: number }[] }).__sp);
    const owes = sp.map((x) => x.owe).filter((x, i, a) => x && x !== a[i - 1]);
    const counts = sp.map((x) => x.groups).filter((x, i, a) => i === 0 || x !== a[i - 1]);
    console.log(`split: empty screen for ${sp.filter((x) => x.empty).length * 20}ms; "you owe" went ${JSON.stringify(owes)}; group count went ${JSON.stringify(counts)}`);
    expect(sp.filter((x) => x.empty).length, 'no "Create your first group" flash while the groups load').toBe(0);
    expect(owes.length, 'the total doesn’t jump while the groups load').toBeLessThanOrEqual(1);
    expect(fresh.errors).toEqual([]);
  } finally { await fresh.ctx.close(); }
});

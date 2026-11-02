// End-to-end: on a phone, Split and the Calendar's Cards fit the screen. A page wider than the screen makes
// the browser zoom out and shift, and the bottom tabs seem to ride up as you scroll; so every screen is
// checked for sideways overflow, and a long list is scrolled with the tabs watched.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { phone, signUp, tab, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('fit'));
  await signUp(P);
});
test.afterAll(async () => { await P?.ctx.close(); });

/** The page is exactly as wide as the phone (390): nothing pushes it wider, so nothing zooms or pans. */
async function fits(page: Page, where: string) {
  const m = await page.evaluate(() => { const clipped = (e: Element) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(a).overflowX)) return true; return false; }; return ({ vw: innerWidth, scroll: document.documentElement.scrollWidth,
    wide: [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > 391 && r.width < 800 && getComputedStyle(e).position !== 'fixed' && !e.closest('[role=dialog]') && !clipped(e); })
      .map((e) => e.tagName + '.' + e.className.toString().slice(0, 50)).slice(0, 5) }); });
  expect(m, `${where}: the page must not be wider than the phone`).toMatchObject({ vw: 390, scroll: 390, wide: [] });
}
const navBox = (page: Page) => page.getByRole('tablist', { name: 'Sanga' }).boundingBox();

test('Split: every screen of a group fits, and the tabs stay put while the list scrolls', async () => {
  await tab(P, 'Split').click();
  const split = P.page.getByRole('region', { name: 'Split' });
  await fits(P.page, 'Split, no groups');
  await split.getByRole('button', { name: 'New group' }).click();
  const ng = P.page.getByRole('dialog', { name: 'New group' });
  await ng.getByLabel('Name').fill('Long list');
  await ng.getByRole('button', { name: 'Create group' }).click();
  await expect(split.getByRole('heading', { name: 'Long list' })).toBeVisible();
  await fits(P.page, 'Split, group with only me');
  for (let i = 1; i <= 24; i++) {
    await split.getByRole('button', { name: 'Add expense' }).click();
    const d = P.page.getByRole('dialog', { name: 'Add expense' });
    await d.getByLabel(/^Amount/).fill(String(100 + i));
    await d.getByLabel('What was it for?').fill('Item ' + i);
    if (i === 1) { // the form itself, on a phone
      await expect(d).toBeVisible();
      const f = await d.evaluate((el) => ({ over: el.scrollWidth > el.clientWidth + 1 }));
      expect(f.over, 'the add-expense form must not scroll sideways').toBe(false);
      await P.page.screenshot({ path: shots('96-phone-form') });
    }
    await d.getByLabel('What was it for?').press('Enter');
    await expect(d).toBeHidden();
  }
  await fits(P.page, 'Split, expenses');
  const before = await navBox(P.page);
  // Scroll the list down and back up (wheel on the list, like a finger drag): the page itself never moves.
  await P.page.mouse.move(195, 400);
  for (let k = 0; k < 6; k++) { await P.page.mouse.wheel(0, 600); await P.page.waitForTimeout(80); }
  expect(await P.page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);
  expect(await navBox(P.page)).toEqual(before);
  await expect(split.getByText('Item 1', { exact: true })).toBeVisible();
  for (let k = 0; k < 8; k++) { await P.page.mouse.wheel(0, -600); await P.page.waitForTimeout(80); }
  expect(await P.page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);
  expect(await navBox(P.page)).toEqual(before);
  await P.page.screenshot({ path: shots('95-phone-expenses') });
  for (const t of ['Balances', 'Insights', 'People', 'Activity']) {
    await split.getByRole('tab', { name: new RegExp(t) }).click();
    await fits(P.page, `Split, ${t}`);
  }
  await expect(split.getByRole('tab', { name: 'Activity' })).toBeVisible();
  const last = await split.getByRole('tab', { name: 'Activity' }).boundingBox();
  expect(last!.x + last!.width, 'the last group tab is on screen').toBeLessThanOrEqual(390);
  await split.getByRole('button', { name: 'Back to groups' }).click();
  await fits(P.page, 'Split, group list');
  await split.getByRole('button', { name: 'My spending' }).click();
  await fits(P.page, 'Split, my spending');
});

test('Calendar → Cards fits too', async () => {
  await tab(P, 'Calendar').click();
  const cal = P.page.getByRole('region', { name: 'Calendar' });
  await expect(cal.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
  await fits(P.page, 'Calendar, month');
  await cal.getByRole('tab', { name: 'Cards' }).click();
  await fits(P.page, 'Calendar, cards (empty)');
  await cal.getByRole('button', { name: 'Add a card' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add a credit card' });
  await d.getByLabel('Card name').fill('HDFC Millennia');
  await d.getByLabel(/Statement day/).fill(String(new Date().getDate()));
  await d.getByRole('button', { name: 'Add card' }).click();
  await expect(cal.getByText('Is your HDFC Millennia bill ready?')).toBeVisible();
  await fits(P.page, 'Calendar, cards with a card');
  await P.page.screenshot({ path: shots('94-phone-cards') });
  expect(P.errors).toEqual([]);
});

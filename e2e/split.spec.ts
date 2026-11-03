// End-to-end: Split. A makes a group and adds friend B (the group key is wrapped for B), both add
// expenses (one with a bill photo), balances and settling up agree on both phones, and the insights
// show where the money went.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { makeFriends, phone, signUp, tab, testPng, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
const LAPTOP = { viewport: { width: 1366, height: 860 }, locale: 'en-US', timezoneId: 'Asia/Kolkata' };
let A: Phone, B: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const split = (p: Phone) => p.page.getByRole('region', { name: 'Split' });

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  [A, B] = await Promise.all([phone(browser, uname('spa'), LAPTOP), phone(browser, uname('spb'), LAPTOP)]);
});
test.afterAll(async () => { for (const p of [A, B]) await p?.ctx.close(); });

async function addExpense(p: Phone, amount: string, desc: string, opts: { category?: string; bill?: boolean } = {}) {
  await split(p).getByRole('button', { name: 'Add expense' }).click();
  const d = p.page.getByRole('dialog', { name: 'Add expense' });
  await d.getByLabel(/^Amount/).fill(amount);
  await d.getByLabel('What was it for?').fill(desc);
  if (opts.category) await d.getByRole('radio', { name: new RegExp(opts.category) }).click();
  if (opts.bill) {
    await d.locator('input[type=file]:not([capture])').setInputFiles({ name: 'bill.png', mimeType: 'image/png', buffer: testPng(1800, 1200) });
    await expect(d.getByText('Bill attached')).toBeVisible({ timeout: 15_000 });
  }
  await d.getByRole('button', { name: 'Add expense' }).click();
  await expect(d).toBeHidden();
}

test('set up: two friends, and Split opens as its own app only when its tab is tapped', async () => {
  await Promise.all([signUp(A), signUp(B)]);
  await makeFriends(A, B);
  const loaded: string[] = [];
  A.page.on('request', (r) => { if (r.url().includes('/apps/split/')) loaded.push(r.url()); });
  await new Promise((r) => setTimeout(r, 500));
  expect(loaded, 'nothing of Split is downloaded before it is opened').toEqual([]);
  await tab(A, 'Split').click();
  await expect(split(A).getByRole('heading', { name: 'Split', exact: true })).toBeVisible({ timeout: 15_000 });
  expect(loaded.length).toBeGreaterThan(0);
  await expect(split(A).getByText('Split costs with friends')).toBeVisible();
});

test('make a group and add a friend; they see it at once', async () => {
  await split(A).getByRole('button', { name: 'New group' }).click();
  const d = A.page.getByRole('dialog', { name: 'New group' });
  await d.getByLabel('Name').fill('Goa trip');
  await d.getByRole('button', { name: 'Create group' }).click();
  await expect(split(A).getByRole('heading', { name: 'Goa trip' })).toBeVisible();
  await split(A).getByRole('tab', { name: 'People' }).click();
  await split(A).getByRole('button', { name: 'Add people' }).click();
  const add = A.page.getByRole('dialog', { name: 'Add people' });
  await add.locator('li').filter({ hasText: B.u }).getByRole('button', { name: 'Add' }).click();
  await expect(add.locator('li').filter({ hasText: B.u })).toHaveCount(0);
  await add.getByLabel('Name', { exact: true }).fill('Rohan');
  await add.getByRole('button', { name: 'Add', exact: true }).last().click();
  await A.page.keyboard.press('Escape');
  await expect(split(A).getByText('Rohan')).toBeVisible();

  await tab(B, 'Split').click();
  await expect(split(B).getByRole('button', { name: /Goa trip/ })).toBeVisible({ timeout: 20_000 });
});

test('expenses sync both ways, with a bill, and balances agree', async () => {
  await split(A).getByRole('tab', { name: 'Expenses' }).click();
  await addExpense(A, '900', 'Beach dinner', { category: 'Food' });
  await addExpense(A, '300', 'Metro cards', { category: 'Metro', bill: true });
  await split(B).getByRole('button', { name: /Goa trip/ }).click();
  await expect(split(B).getByText('Beach dinner')).toBeVisible({ timeout: 20_000 });
  await expect(split(B).getByText('Metro cards')).toBeVisible();

  await split(B).getByRole('button', { name: /Metro cards/ }).click();
  const detail = B.page.getByRole('dialog', { name: 'Metro cards' });
  await expect(detail.getByText('Split equally')).toBeVisible();
  await expect(detail.getByRole('img', { name: 'Bill' })).toBeVisible({ timeout: 20_000 }); // fetched sealed, opened on B's device
  await B.page.screenshot({ path: shots('80-split-detail') });
  await B.page.keyboard.press('Escape');

  await addExpense(B, '60', 'Auto to station', { category: 'Cab' });
  await expect(split(A).getByText('Auto to station')).toBeVisible({ timeout: 20_000 });

  // A's phone is on Expenses: the activity tab says one new thing (B's expense), and names who did it.
  await expect(split(A).getByRole('tab', { name: /Activity/ })).toContainText('1');
  await split(A).getByRole('tab', { name: /Activity/ }).click();
  const feedA = split(A).getByRole('tabpanel', { name: /Activity/ });
  await expect(feedA.getByText(`${B.u} added Auto to station`)).toBeVisible();
  await expect(feedA.getByText('You added Beach dinner')).toBeVisible();
  await expect(feedA.getByText(`You added ${B.u}`)).toBeVisible();
  await expect(split(A).getByRole('tab', { name: /Activity/ })).not.toContainText('1'); // seen
  await split(B).getByRole('tab', { name: /Activity/ }).click();
  await expect(split(B).getByRole('tab', { name: /Activity/ })).toHaveAttribute('aria-selected', 'true');
  const feedB = split(B).getByRole('tabpanel', { name: /Activity/ });
  await expect(feedB.getByText(`${A.u} added Beach dinner`)).toBeVisible();
  await expect(feedB.getByText('You added Auto to station')).toBeVisible();
  await B.page.screenshot({ path: shots('83-split-activity') });
  // Edit: the feed says what changed, and the expense still says who first added it.
  await split(A).getByRole('tab', { name: 'Expenses' }).click();
  await split(A).getByRole('button', { name: /Auto to station/ }).click();
  await expect(A.page.getByRole('dialog', { name: 'Auto to station' }).getByText(`Added by ${B.u}`)).toBeVisible();
  await A.page.keyboard.press('Escape');

  // 3 people share equally: A paid 1200 (owes 420), B paid 60 (owes 420), Rohan owes 420.
  await split(B).getByRole('tab', { name: 'Balances' }).click();
  await expect(split(B).getByText(/You\s+owes? [$₹]?3[56]\d\.\d\d|owes ₹360\.00/).first()).toBeVisible();
  await B.page.screenshot({ path: shots('81-split-balances') });
});

test('settling up: a recorded payment changes both balances', async () => {
  await split(B).getByRole('button', { name: 'Record payment' }).first().click();
  const d = B.page.getByRole('dialog', { name: 'Record a payment' });
  // B pays A back, so A (who got the money) has to confirm it before it counts.
  await expect(d.getByText('will be asked to confirm')).toBeVisible();
  await d.getByRole('button', { name: 'Send for confirmation' }).click();
  const waitingB = split(B).getByRole('region', { name: 'Waiting for confirmation' });
  await expect(waitingB.getByText(`waiting for ${A.u} to confirm`)).toBeVisible();
  await expect(waitingB.getByRole('button', { name: 'Confirm I got it' })).toHaveCount(0);
  await expect(split(B).getByText('Payments made')).toHaveCount(0);
  await expect(split(B).getByText(/You\s+owes? /).first()).toBeVisible(); // nothing counted yet

  await split(A).getByRole('tab', { name: /Balances/ }).click();
  await expect(split(A).getByRole('tab', { name: /Balances/ })).toContainText('1');
  const waitingA = split(A).getByRole('region', { name: 'Waiting for confirmation' });
  await expect(waitingA.getByText(`recorded by ${B.u}`)).toBeVisible({ timeout: 20_000 });
  await waitingA.getByRole('button', { name: 'Confirm I got it' }).click();
  await expect(split(A).getByText('Payments made')).toBeVisible();
  await expect(split(B).getByText('Payments made')).toBeVisible({ timeout: 20_000 });
  await expect(split(B).getByRole('region', { name: 'Waiting for confirmation' })).toHaveCount(0);
});

test('insights: where the money went, by category and over time, for any period', async () => {
  await split(A).getByRole('tab', { name: 'Insights' }).click();
  const ins = split(A).getByRole('tabpanel', { name: 'Insights' });
  await expect(ins.getByRole('region', { name: 'Summary' })).toContainText('You spent');
  await expect(ins.getByRole('region', { name: 'Spending by category' })).toContainText('Food & drink');
  await expect(ins.getByRole('region', { name: 'Spending by category' })).toContainText('Metro');
  await ins.getByRole('button', { name: 'Today' }).click();
  await expect(ins.getByRole('region', { name: 'Spending over time' })).toBeVisible();
  await ins.getByRole('button', { name: 'Custom' }).click();
  await ins.getByLabel('From').fill('2020-01-01');
  await expect(ins.getByRole('region', { name: 'Summary' })).toContainText('Expenses');
  await ins.getByRole('button', { name: 'All time' }).click();
  await A.page.screenshot({ path: shots('82-split-insights') });

  await split(A).getByRole('button', { name: 'Back to groups' }).click();
  await split(A).getByRole('button', { name: 'My spending' }).click();
  await expect(split(A).getByRole('heading', { name: 'My spending' })).toBeVisible();
  await expect(split(A).getByRole('region', { name: 'Spending by category' })).toContainText('Food & drink');
  expect(A.errors).toEqual([]);
  expect(B.errors).toEqual([]);
});

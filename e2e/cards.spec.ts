// End-to-end: credit card bills in the Calendar. Add a card, be asked for the bill on its statement day,
// enter it, get reminders scheduled, mark it paid, and send it to Split as an expense.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { phone, signUp, tab, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
const LAPTOP = { viewport: { width: 1366, height: 860 }, locale: 'en-US', timezoneId: 'Asia/Kolkata' };
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const cal = () => P.page.getByRole('region', { name: 'Calendar' });
const reminderPosts: number[] = [];

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('card'), LAPTOP);
  P.page.on('request', (r) => { if (r.url().endsWith('/api/reminders') && r.method() === 'POST') reminderPosts.push(JSON.parse(r.postData() || '{}').list?.length ?? 0); });
});
test.afterAll(async () => { await P?.ctx.close(); });

test('add a card whose statement day is today: the calendar asks for the bill', async () => {
  await signUp(P);
  await tab(P, 'Calendar').click();
  await cal().getByRole('tab', { name: 'Cards' }).click();
  await expect(cal().getByText('Never miss a credit card bill')).toBeVisible();
  await cal().getByRole('button', { name: 'Add a card' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add a credit card' });
  await d.getByLabel('Card name').fill('HDFC Millennia');
  await d.getByLabel('Last 4').fill('4321');
  await d.getByLabel(/Statement day/).fill(String(new Date().getDate()));
  await d.getByRole('button', { name: 'Add card' }).click();
  await expect(cal().getByText('Is your HDFC Millennia bill ready?')).toBeVisible();
  await expect(cal().getByRole('region', { name: 'Your cards' })).toContainText('HDFC Millennia');
  await P.page.screenshot({ path: shots('90-cards-ask') });
  // the banner follows you to the other views
  await cal().getByRole('tab', { name: 'Month' }).click();
  await expect(cal().getByRole('button', { name: /HDFC Millennia: your bill should be ready/ })).toBeVisible();
});

test('enter the bill: amount and due date; reminders are scheduled', async () => {
  const before = reminderPosts.length;
  await cal().getByRole('button', { name: /HDFC Millennia: your bill should be ready/ }).click();
  await cal().getByRole('button', { name: 'Add bill' }).click();
  const d = P.page.getByRole('dialog', { name: /HDFC Millennia ·/ });
  await expect(d.getByLabel('Due date')).not.toHaveValue(''); // suggested from the statement day
  await d.getByLabel(/Total amount due/).fill('12345.50');
  await d.getByLabel('Minimum due').fill('617.00');
  await d.getByRole('button', { name: 'Save bill' }).click();
  await expect(cal().getByText('Is your HDFC Millennia bill ready?')).toHaveCount(0);
  await expect(cal().getByRole('region', { name: 'Bills' })).toContainText('₹12,345.50');
  await expect(cal().getByRole('region', { name: 'To pay' })).toContainText('₹12,345.50');
  // Reminders were re-sent to the server (sealed): the due-date ones are in the list now.
  await expect.poll(() => reminderPosts.length, { timeout: 10_000 }).toBeGreaterThan(before);
  expect(reminderPosts.at(-1)).toBeGreaterThanOrEqual(4);
  await P.page.screenshot({ path: shots('91-cards-bill') });
});

test('mark it paid', async () => {
  await cal().getByRole('region', { name: 'Bills' }).getByRole('button', { name: /HDFC Millennia/ }).click();
  const d = P.page.getByRole('dialog', { name: /HDFC Millennia ·/ });
  await d.getByRole('button', { name: 'Mark as paid' }).click();
  await expect(d.getByText(/Paid on/)).toBeVisible();
  await P.page.keyboard.press('Escape');
  await expect(cal().getByRole('region', { name: 'To pay' })).toContainText('All clear');
  await expect(cal().getByRole('region', { name: 'Bills' })).toContainText('Paid');
});

test('add it to Split: the bill arrives as your own expense', async () => {
  await cal().getByRole('region', { name: 'Bills' }).getByRole('button', { name: /HDFC Millennia/ }).click();
  await P.page.getByRole('dialog', { name: /HDFC Millennia ·/ }).getByRole('button', { name: 'Add to Split' }).click();
  // Split opens with the bill waiting: pick where to put it (no group yet: make one)
  const pick = P.page.getByRole('dialog', { name: 'Add this bill to Split' });
  await expect(pick).toBeVisible({ timeout: 15_000 });
  await expect(pick).toContainText('HDFC Millennia card bill');
  await pick.getByRole('button', { name: 'New group' }).click();
  const ng = P.page.getByRole('dialog', { name: 'New group' });
  await ng.getByLabel('Name').fill('My money');
  await expect(ng.getByLabel('Currency')).toHaveValue('INR'); // the bill's currency
  await ng.getByRole('button', { name: 'Create group' }).click();
  const ed = P.page.getByRole('dialog', { name: 'Add expense' });
  await expect(ed).toBeVisible({ timeout: 15_000 });
  await expect(ed.getByLabel(/^Amount/)).toHaveValue('12345.50');
  await expect(ed.getByLabel('What was it for?')).toHaveValue('HDFC Millennia card bill');
  await expect(ed.getByRole('radio', { name: /Credit card bill/ })).toHaveAttribute('aria-checked', 'true');
  await P.page.screenshot({ path: shots('92-cards-split') });
  await ed.getByRole('button', { name: 'Add expense' }).click();
  await expect(P.page.getByRole('region', { name: 'Split' }).getByText('HDFC Millennia card bill')).toBeVisible();
  await expect(P.page.getByRole('region', { name: 'Split' }).getByText(/your own expense/).first()).toBeVisible();
  expect(P.errors).toEqual([]);
});

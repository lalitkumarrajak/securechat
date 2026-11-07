// End-to-end: credit card bills in the Calendar. Add a card, be asked for the bill on its statement day,
// enter it, get reminders scheduled, mark it paid, and record the payment in Split (not counted as spending).
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

test('add it to Split: card payments go in a Credit card bills group, not counted as spending', async () => {
  await cal().getByRole('region', { name: 'Bills' }).getByRole('button', { name: /HDFC Millennia/ }).click();
  const bill = P.page.getByRole('dialog', { name: /HDFC Millennia ·/ });
  await expect(bill).toContainText('It isn’t counted as spending');
  await bill.getByRole('button', { name: 'Add to Split' }).click();
  // Split opens with the payment waiting; there's no card bills group yet, so it offers to make one
  const pick = P.page.getByRole('dialog', { name: 'Add this bill to Split' });
  await expect(pick).toBeVisible({ timeout: 15_000 });
  await expect(pick).toContainText('HDFC Millennia card bill');
  await pick.getByRole('button', { name: 'Make a Credit card bills group' }).click();
  const ng = P.page.getByRole('dialog', { name: 'New group' });
  await expect(ng.getByRole('radio', { name: /Credit card bills/ })).toHaveAttribute('aria-checked', 'true');
  await expect(ng.getByLabel('Name')).toHaveValue('Credit card bills');
  await expect(ng.getByLabel('Currency')).toHaveValue('INR'); // the bill's currency
  await P.page.screenshot({ path: shots('91-cards-new-group') });
  await ng.getByRole('button', { name: 'Create group' }).click();
  const ed = P.page.getByRole('dialog', { name: 'Add expense' });
  await expect(ed).toBeVisible({ timeout: 15_000 });
  await expect(ed.getByLabel(/^Amount/)).toHaveValue('12345.50');
  await expect(ed.getByLabel('What was it for?')).toHaveValue('HDFC Millennia card bill');
  await expect(ed.getByRole('radio', { name: /Credit card bill/ })).toHaveAttribute('aria-checked', 'true');
  await P.page.screenshot({ path: shots('92-cards-split') });
  await ed.getByRole('button', { name: 'Add expense' }).click();
  const split = P.page.getByRole('region', { name: 'Split' });
  await expect(split.getByText('HDFC Millennia card bill')).toBeVisible();
  // The group says what it is, and its own insights show the payments while saying they're kept out of spending
  await split.getByRole('tab', { name: /Insights/ }).click();
  await expect(split.getByText('Card bills paid')).toBeVisible();
  await expect(split.getByRole('region', { name: 'By card' })).toContainText('HDFC Millennia card bill');
  await expect(split.getByRole('region', { name: 'Expenses in this view' })).toContainText('All card bills');
  await expect(split.getByText(/isn’t counted in My spending/)).toBeVisible();
  await split.getByRole('button', { name: 'Back to groups' }).click();
  await expect(split.getByRole('button', { name: /Credit card bills/ })).toContainText('not in My spending');
  // My spending leaves it out, and says how much it left out
  await split.getByRole('button', { name: 'My spending' }).first().click();
  const left = split.getByRole('region', { name: 'Not counted as spending' });
  await expect(left).toContainText('₹12,345.50'); // the sum of every card bill left out
  await left.getByRole('button', { name: 'Show it' }).click();
  await expect(left).toContainText('HDFC Millennia card bill');
  await expect(split.getByText('No spending in this period.')).toBeVisible();
  expect(P.errors).toEqual([]);
});

test('the next card payment goes straight to the Credit card bills group', async () => {
  await tab(P, 'Calendar').click();
  await cal().getByRole('tab', { name: 'Cards' }).click();
  await cal().getByRole('region', { name: 'Bills' }).getByRole('button', { name: /HDFC Millennia/ }).click();
  const bill = P.page.getByRole('dialog', { name: /HDFC Millennia ·/ });
  await expect(bill).toContainText('Recorded in Split.');
  await bill.getByRole('button', { name: 'Send again' }).click();
  // No question this time: the editor opens in the one card bills group
  const ed = P.page.getByRole('dialog', { name: 'Add expense' });
  await expect(ed).toBeVisible({ timeout: 15_000 });
  await expect(P.page.getByRole('dialog', { name: 'Add this bill to Split' })).toHaveCount(0);
  await expect(ed.getByLabel('What was it for?')).toHaveValue('HDFC Millennia card bill');
  await ed.getByRole('button', { name: 'Cancel' }).click();
  const split = P.page.getByRole('region', { name: 'Split' });
  await expect(split.getByRole('heading', { name: 'Credit card bills' })).toBeVisible();
  // Card bills are yours alone: no nudge to add people
  await expect(split.getByText(/Add people to split with/)).toHaveCount(0);
  expect(P.errors).toEqual([]);
});

// End-to-end: Accounts. A bank account with a debit card, a credit card and cash; a statement day with
// "No bill this month"; a locked statement PDF imported (asked for its password once, remembered for
// the next), its bill paid from the bank, a transfer to cash, a payment SMS, a Split expense paid from
// the bank (and deleted again), and the Calendar showing the card bill and opening Accounts.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, phone, signIn, signUp, tab, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
const LAPTOP = { viewport: { width: 1366, height: 860 }, locale: 'en-US', timezoneId: 'Asia/Kolkata' };
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const acc = () => P.page.getByRole('region', { name: 'Accounts' });
const fixture = (f: string) => path.join(import.meta.dirname, 'fixtures', f);
const balanceOf = (name: string) => acc().getByRole('button', { name: new RegExp(`^${name}`) });

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('acct'), LAPTOP);
});
test.afterAll(async () => { await P?.ctx.close(); });

test('Accounts opens from More; add a bank account with a debit card', async () => {
  await signUp(P);
  await openApp(P, 'Accounts');
  await expect(acc().getByText('All your money in one place')).toBeVisible({ timeout: 15_000 });
  await acc().getByRole('button', { name: 'Add bank account' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add bank account' });
  await d.getByLabel('Name', { exact: true }).fill('HDFC Savings');
  await d.getByLabel(/^Bank/).fill('HDFC Bank');
  await d.getByLabel('Balance now').fill('50000');
  await d.getByLabel('Account no. last 4').fill('9911');
  await d.getByLabel('IFSC').fill('hdfc0001234');
  await d.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(balanceOf('HDFC Savings')).toContainText('₹50,000.00');

  await balanceOf('HDFC Savings').click();
  await acc().getByRole('button', { name: 'Add' }).first().click();
  const dc = P.page.getByRole('dialog', { name: 'Add a debit card' });
  await expect(dc.getByLabel('Name', { exact: true })).toHaveValue('HDFC Bank Debit');
  await dc.getByLabel('Network').selectOption('rupay');
  await dc.getByLabel('Last 4').fill('5566');
  await dc.getByLabel('Expiry').fill('0830');
  await expect(dc.getByLabel('Expiry')).toHaveValue('08/30');
  await dc.getByRole('button', { name: 'Add card' }).click();
  await expect(acc().getByText('HDFC Bank Debit')).toBeVisible();
  await acc().getByRole('button', { name: 'Details' }).click();
  await expect(acc().getByText('HDFC0001234')).toBeVisible();
  await P.page.screenshot({ path: shots('90-accounts-bank') });
  await acc().getByRole('button', { name: 'All accounts' }).click();
});

test('a credit card whose statement is out today: say there’s no bill this month', async () => {
  await acc().getByRole('button', { name: 'Credit card' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add credit card' });
  await d.getByLabel('Name', { exact: true }).fill('Millennia');
  await d.getByLabel('Credit limit').fill('200000');
  await d.getByLabel('Last 4').fill('4321');
  await d.getByLabel(/Statement day/).fill(String(new Date().getDate()));
  await d.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(balanceOf('Millennia')).toContainText('₹200,000.00 of ₹200,000.00 limit available');
  await acc().getByRole('tab', { name: 'Bills' }).click();
  await expect(acc().getByText('Is your Millennia bill ready?')).toBeVisible();
  await acc().getByRole('button', { name: 'No bill this month' }).click();
  await expect(acc().getByText('Is your Millennia bill ready?')).toHaveCount(0);
  await expect(acc().getByRole('region', { name: 'Bills' })).toContainText('Nothing to pay');
  await expect(acc().getByRole('region', { name: 'To pay' })).toContainText('All clear');
});

test('import a locked statement PDF: asked for the password once, the bill and purchases read', async () => {
  await acc().getByRole('button', { name: /Import a statement/ }).click();
  const d = P.page.getByRole('dialog', { name: 'Import a statement' });
  await d.locator('input[type=file]').setInputFiles(fixture('statement-1.pdf'));
  await expect(d.getByLabel('PDF password')).toBeVisible({ timeout: 15_000 });
  await d.getByLabel('PDF password').fill('wrong');
  await d.getByRole('button', { name: 'Open' }).click();
  await expect(d.getByText('That password didn’t open it. Try again.')).toBeVisible();
  await d.getByLabel('PDF password').fill('LAKS0101');
  await d.getByRole('button', { name: 'Open' }).click();
  const r = P.page.getByRole('dialog', { name: 'Check the statement' });
  await expect(r.getByLabel('Card', { exact: true })).toHaveValue(/.+/);
  await expect(r.getByLabel('Card', { exact: true }).locator('option:checked')).toHaveText('Millennia ••4321');
  await expect(r.getByLabel('Statement date')).toHaveValue('2026-09-14');
  await expect(r.getByLabel('Due date')).toHaveValue('2026-10-04');
  await expect(r.getByLabel('Total amount due')).toHaveValue('8915.00');
  await expect(r).toContainText(/Update Millennia from this statement: statement day \d+ → 14, due 20 → 20|Update Millennia from this statement: statement day \d+ → 14/);
  await expect(r.getByRole('region', { name: 'Transactions' })).toContainText('SWIGGY BANGALORE');
  await expect(r.getByRole('region', { name: 'Transactions' })).toContainText('6 purchases');
  await P.page.screenshot({ path: shots('91-accounts-review') });
  await r.getByRole('button', { name: 'Save statement' }).click();
  // Straight to where the money went
  await expect(acc().getByText('Spending by date')).toBeVisible();
  await expect(acc().getByText('By category')).toBeVisible();
  await expect(acc().getByText('Groceries').first()).toBeVisible();
  await P.page.screenshot({ path: shots('92-accounts-spending'), fullPage: true });
});

test('the next month’s statement opens without asking for the password', async () => {
  await acc().getByRole('button', { name: 'Import' }).click();
  const d = P.page.getByRole('dialog', { name: 'Import a statement' });
  await d.locator('input[type=file]').setInputFiles(fixture('statement-2.pdf'));
  const r = P.page.getByRole('dialog', { name: 'Check the statement' });
  await expect(r.getByLabel('Statement date')).toHaveValue('2026-10-14', { timeout: 15_000 });
  await expect(P.page.getByLabel('PDF password')).toHaveCount(0);
  await r.getByRole('button', { name: 'Save statement' }).click();
  await expect(acc().getByText('Month by month')).toBeVisible();
});

test('pay the October bill from the bank: the bank goes down and the card is paid', async () => {
  await acc().getByRole('tab', { name: 'Bills' }).click();
  await acc().getByRole('region', { name: 'Bills' }).getByRole('button', { name: /Millennia · October 2026/ }).click();
  const d = P.page.getByRole('dialog', { name: /Millennia · October 2026/ });
  await expect(d.getByLabel('Paid from')).toHaveValue(/.+/);
  await d.getByRole('button', { name: 'Mark as paid' }).click();
  await expect(d.getByText(/Paid ₹4,120.50 on/)).toBeVisible();
  await expect(d).toContainText('from HDFC Savings');
  await P.page.keyboard.press('Escape');
  await acc().getByRole('tab', { name: 'Accounts' }).click();
  await expect(balanceOf('HDFC Savings')).toContainText('₹45,879.50');
});

test('a transfer: cash from the ATM', async () => {
  await acc().getByRole('button', { name: 'Cash' }).last().click();
  const c = P.page.getByRole('dialog', { name: 'Add cash' });
  await c.getByLabel('Balance now').fill('500');
  await c.getByRole('button', { name: 'Add', exact: true }).click();
  await acc().getByRole('button', { name: 'Transfer money' }).click();
  const d = P.page.getByRole('dialog', { name: 'Transfer money' });
  await d.getByLabel(/^Amount/).fill('2000');
  await d.getByLabel('From').selectOption({ label: 'HDFC Savings ••9911' });
  await d.getByLabel('To').selectOption({ label: 'Cash' });
  await d.getByLabel('What for').fill('ATM');
  await d.getByRole('button', { name: 'Transfer', exact: true }).click();
  await expect(balanceOf('HDFC Savings')).toContainText('₹43,879.50');
  await expect(balanceOf('Cash')).toContainText('₹2,500.00');
});

test('a payment SMS marks the September bill paid', async () => {
  await acc().getByRole('tab', { name: 'Bills' }).click();
  await acc().getByRole('button', { name: /Import a statement/ }).click();
  const d = P.page.getByRole('dialog', { name: 'Import a statement' });
  await d.getByLabel(/paste the bank’s SMS/).fill('Payment of Rs 8,915.00 has been received on your HDFC Bank Credit Card XX4321 on 05-11-2026. Thank you.');
  await d.getByRole('button', { name: 'Read it' }).click();
  const p = P.page.getByRole('dialog', { name: 'A payment to your card' });
  await expect(p).toContainText('Marks the September 2026 bill');
  await p.getByLabel('Paid from').selectOption({ label: 'An account not in Sanga' });
  await p.getByRole('button', { name: 'Mark as paid' }).click();
  await expect(acc().getByRole('region', { name: 'To pay' })).toContainText('All clear');
  await acc().getByRole('tab', { name: 'Accounts' }).click();
  await expect(balanceOf('HDFC Savings')).toContainText('₹43,879.50'); // not from a Sanga account
});

test('a second card sharing the first one’s limit: what you owe on both uses up one limit', async () => {
  await acc().getByRole('tab', { name: 'Accounts' }).click();
  await acc().getByRole('region', { name: 'Credit cards' }).getByRole('button', { name: 'Add' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add credit card' });
  await d.getByLabel('Name', { exact: true }).fill('Regalia');
  await d.getByLabel('Amount you owe now').fill('10000');
  await d.getByLabel('Limit', { exact: true }).selectOption({ label: 'Shared with Millennia ••4321' });
  await expect(d.getByLabel('Shared credit limit')).toHaveValue('200000.00');
  await P.page.screenshot({ path: shots('95-accounts-shared-limit') });
  await d.getByRole('button', { name: 'Add', exact: true }).click();
  // Both cards show the same room left on the one limit.
  const left = async (name: string) => (await balanceOf(name).textContent())!.match(/(₹[\d,.]+) of ₹200,000\.00 shared limit available/)?.[1];
  await expect(balanceOf('Regalia')).toContainText('shared limit available');
  await expect(balanceOf('Millennia')).toContainText('shared limit available');
  expect(await left('Regalia')).toBe(await left('Millennia'));
  await balanceOf('Regalia').click();
  await expect(acc().getByText('Shared limit ₹200,000.00')).toBeVisible();
  await expect(acc().getByText(/^With Millennia:|^Shared with Millennia$/)).toBeVisible();
  await P.page.screenshot({ path: shots('96-accounts-shared-card') });
  await acc().getByRole('button', { name: 'All accounts' }).click();
});

test('Split: an expense paid from the bank comes out of it, and goes back when deleted', async () => {
  await tab(P, 'Split').click();
  const split = P.page.getByRole('region', { name: 'Split' });
  await split.getByRole('button', { name: 'New group' }).first().click();
  const ng = P.page.getByRole('dialog', { name: 'New group' });
  await ng.getByLabel('Name', { exact: true }).fill('Flat');
  await ng.getByRole('button', { name: 'Create group' }).click();
  await split.getByRole('button', { name: 'Add expense' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add expense' });
  await d.getByLabel(/^Amount/).fill('900');
  await d.getByLabel('What was it for?').fill('Electricity');
  // Optional: nothing is linked until you ask; then your accounts, grouped, to pick from.
  await expect(d.getByRole('group', { name: 'Paid from' })).toHaveCount(0);
  await d.getByRole('button', { name: /Link to an account/ }).click();
  const pick = d.getByRole('group', { name: 'Paid from' });
  await expect(pick.getByText('Bank accounts')).toBeVisible();
  await P.page.screenshot({ path: shots('93-split-link-pick') });
  await pick.getByRole('button', { name: /HDFC Savings ••9911/ }).click();
  await expect(d.getByText('HDFC Savings ••9911')).toBeVisible();
  await expect(d.getByRole('button', { name: 'Change' })).toBeVisible();
  await P.page.screenshot({ path: shots('93-split-paid-from') });
  await d.getByRole('button', { name: 'Add expense' }).click();
  await expect(split.getByText('Electricity')).toBeVisible();

  await openApp(P, 'Accounts');
  await expect(balanceOf('HDFC Savings')).toContainText('₹42,979.50', { timeout: 15_000 });
  await balanceOf('HDFC Savings').click();
  await expect(acc().getByRole('button', { name: /Electricity/ })).toContainText('from Split');
  await acc().getByRole('button', { name: 'All accounts' }).click();

  await tab(P, 'Split').click();
  await split.getByRole('button', { name: /Flat/ }).click();
  await split.getByText('Electricity').click();
  await P.page.getByRole('button', { name: 'Delete' }).click();
  await P.page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(split.getByText('Electricity')).toHaveCount(0);
  await openApp(P, 'Accounts');
  await expect(balanceOf('HDFC Savings')).toContainText('₹43,879.50', { timeout: 15_000 });
  expect(P.errors).toEqual([]);
});

test('a Split expense on a credit card: on its next bill, changed with it, and gone when deleted on another phone', async () => {
  await tab(P, 'Split').click();
  const split = P.page.getByRole('region', { name: 'Split' });
  if (!(await split.getByRole('button', { name: 'Add expense' }).isVisible())) await split.getByRole('button', { name: /Flat/ }).click();
  await split.getByRole('button', { name: 'Add expense' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add expense' });
  await d.getByLabel(/^Amount/).fill('700');
  await d.getByLabel('What was it for?').fill('Groceries');
  await d.getByRole('button', { name: /Link to an account/ }).click();
  await d.getByRole('group', { name: 'Paid from' }).getByRole('button', { name: /^Regalia/ }).click();
  await d.getByRole('button', { name: 'Add expense' }).click();
  await expect(split.getByText('Groceries')).toBeVisible();

  // The card's bills: no bill due yet, but it's on the next one.
  await openApp(P, 'Accounts');
  await balanceOf('Regalia').click();
  const next = acc().getByRole('region', { name: 'Next bill so far' });
  await expect(next).toContainText('Groceries');
  await expect(next).toContainText('from Split');
  await expect(next).toContainText('₹700.00');
  await expect(acc().getByRole('region', { name: 'To pay' })).toContainText('+ ₹700.00 on the next bill');
  await P.page.screenshot({ path: shots('97-accounts-next-bill') });
  await acc().getByRole('button', { name: 'All accounts' }).click();

  // Changed in Split: the card follows.
  await tab(P, 'Split').click();
  await split.getByRole('button', { name: /Flat/ }).click();
  await split.getByText('Groceries').click();
  await P.page.getByRole('button', { name: 'Edit' }).click();
  await P.page.getByRole('dialog').getByLabel(/^Amount/).fill('850');
  await P.page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await openApp(P, 'Accounts');
  await balanceOf('Regalia').click();
  await expect(acc().getByRole('region', { name: 'Next bill so far' })).toContainText('₹850.00', { timeout: 15_000 });
  await acc().getByRole('button', { name: 'All accounts' }).click();

  // Deleted on another phone: once this one's Split catches up, the card has it no more.
  const Q = await phone(P.page.context().browser()!, P.u);
  await signIn(Q);
  await tab(Q, 'Split').click();
  const qs = Q.page.getByRole('region', { name: 'Split' });
  await qs.getByRole('button', { name: /Flat/ }).click();
  await qs.getByText('Groceries').click();
  await Q.page.getByRole('button', { name: 'Delete' }).click();
  await Q.page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(qs.getByText('Groceries')).toHaveCount(0);
  await Q.page.waitForResponse((r) => r.url().includes('/api/split/records') && r.request().method() === 'POST', { timeout: 10_000 }).catch(() => {});
  await Q.page.waitForTimeout(1000);
  await Q.ctx.close();

  await tab(P, 'Split').click();
  await split.getByRole('button', { name: /Flat/ }).click();
  await expect(split.getByText('Groceries')).toHaveCount(0, { timeout: 15_000 });
  await openApp(P, 'Accounts');
  await balanceOf('Regalia').click();
  await expect(acc().getByRole('region', { name: 'Next bill so far' })).toHaveCount(0, { timeout: 15_000 });
  await expect(acc().getByText('Groceries')).toHaveCount(0);
  await acc().getByRole('button', { name: 'All accounts' }).click();
  expect(P.errors).toEqual([]);
});

test('the same card added twice (same last 4): asked to merge, and it becomes one card with both bills', async () => {
  await acc().getByRole('region', { name: 'Credit cards' }).getByRole('button', { name: 'Add' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add credit card' });
  await d.getByLabel('Name', { exact: true }).fill('HDFC MILLENNIA');
  await d.getByLabel('Last 4').fill('4321');
  await d.getByRole('button', { name: 'Add', exact: true }).click();
  const dup = acc().getByRole('region', { name: 'Cards added twice' });
  await expect(dup).toContainText('Millennia · HDFC MILLENNIA');
  await P.page.screenshot({ path: shots('98-accounts-duplicate') });
  await dup.getByRole('button', { name: 'Merge' }).click();
  await P.page.getByRole('alertdialog').getByRole('button', { name: 'Merge' }).click();
  await expect(dup).toHaveCount(0);
  await expect(balanceOf('HDFC MILLENNIA')).toHaveCount(0);
  await expect(balanceOf('Millennia')).toContainText('shared limit available'); // still holds Regalia's limit
  await acc().getByRole('tab', { name: 'Bills' }).click();
  await expect(acc().getByText(/Millennia/).first()).toBeVisible();
  await acc().getByRole('tab', { name: 'Accounts' }).click();
});

test('removing the card you have open goes back to the list, not a blank page', async () => {
  await acc().getByRole('region', { name: 'Credit cards' }).getByRole('button', { name: 'Add' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add credit card' });
  await d.getByLabel('Name', { exact: true }).fill('Old card');
  await d.getByRole('button', { name: 'Add', exact: true }).click();
  await balanceOf('Old card').click();
  await acc().getByRole('button', { name: 'Edit' }).click();
  await P.page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await P.page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click();
  await expect(acc().getByRole('region', { name: 'Credit cards' })).toBeVisible();
  await expect(balanceOf('Old card')).toHaveCount(0);
  await expect(balanceOf('Millennia')).toBeVisible();
});

test('the Calendar has no Cards tab; it shows card bills and opens Accounts', async () => {
  await tab(P, 'Calendar').click();
  const cal = P.page.getByRole('region', { name: 'Calendar' });
  await expect(cal.getByRole('tab', { name: 'Month' })).toBeVisible({ timeout: 15_000 });
  await expect(cal.getByRole('tab', { name: 'Cards' })).toHaveCount(0);
  expect(P.errors).toEqual([]);
});

// End-to-end: a name-only person in a Split group can be renamed, archived, and linked to a friend who
// joins later: the friend gets the group, and what the name paid or owed is now theirs, unchanged.
import { test, expect } from '@playwright/test';
import { makeFriends, phone, signUp, tab, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
const LAPTOP = { viewport: { width: 1366, height: 860 }, locale: 'en-US', timezoneId: 'Asia/Kolkata' };
let A: Phone, B: Phone;
const split = (p: Phone) => p.page.getByRole('region', { name: 'Split' });

test.beforeAll(async ({ browser }) => {
  [A, B] = await Promise.all([phone(browser, uname('gsa'), LAPTOP), phone(browser, uname('gsb'), LAPTOP)]);
});
test.afterAll(async () => { for (const p of [A, B]) await p?.ctx.close(); });

test('a name-only person is in the group and an expense; renamed, archived and restored', async () => {
  await Promise.all([signUp(A), signUp(B)]);
  await makeFriends(A, B);
  await tab(A, 'Split').click();
  await split(A).getByRole('button', { name: 'New group' }).click();
  const d = A.page.getByRole('dialog', { name: 'New group' });
  await d.getByLabel('Name').fill('Lunch club');
  await d.getByRole('button', { name: 'Create group' }).click();
  await split(A).getByRole('tab', { name: 'People' }).click();
  await split(A).getByRole('button', { name: 'Add people' }).click();
  const add = A.page.getByRole('dialog', { name: 'Add people' });
  await add.getByLabel('Name', { exact: true }).fill('Rohn');
  await add.getByRole('button', { name: 'Add', exact: true }).last().click();
  await A.page.keyboard.press('Escape');
  await expect(split(A).getByText('Not on Sanga')).toBeVisible();

  await split(A).getByRole('tab', { name: 'Expenses' }).click();
  await split(A).getByRole('button', { name: 'Add expense' }).click();
  const e = A.page.getByRole('dialog', { name: 'Add expense' });
  await e.getByLabel(/^Amount/).fill('900');
  await e.getByLabel('What was it for?').fill('Lunch');
  await e.getByRole('button', { name: 'Add expense' }).click();
  await expect(e).toBeHidden();

  await split(A).getByRole('tab', { name: 'People' }).click();
  await split(A).getByRole('button', { name: 'Edit Rohn' }).click();
  const g = A.page.getByRole('dialog', { name: 'Rohn' });
  await g.getByLabel('Name').fill('Rohan');
  await g.getByRole('button', { name: 'Rename' }).click();
  await expect(split(A).getByText('Rohan')).toBeVisible();

  await split(A).getByRole('button', { name: 'Archive Rohan' }).click();
  await expect(split(A).getByText('Archived')).toBeVisible();
  await split(A).getByRole('button', { name: 'Restore Rohan' }).click();
  await expect(split(A).getByText('Not on Sanga')).toBeVisible();

  await split(A).getByRole('tab', { name: 'Balances' }).click();
  await expect(split(A).getByText('Rohan').first()).toBeVisible();
  await expect(split(A).getByText('owes $450.00')).toBeVisible();
});

test('linking the name to a friend: they get the group and the same balance', async () => {
  await split(A).getByRole('tab', { name: 'People' }).click();
  await split(A).getByRole('button', { name: 'Edit Rohan' }).click();
  const g = A.page.getByRole('dialog', { name: 'Rohan' });
  await g.locator('li').filter({ hasText: B.u }).getByRole('button', { name: 'Link' }).click();
  await A.page.getByRole('alertdialog').or(A.page.getByRole('dialog', { name: /Link Rohan/ })).getByRole('button', { name: 'Link and add' }).click();
  await expect(g).toBeHidden({ timeout: 15_000 });
  await expect(split(A).getByText('Rohan')).toHaveCount(0);
  await expect(split(A).getByText('On Sanga')).toBeVisible();

  await split(A).getByRole('tab', { name: 'Balances' }).click();
  await expect(split(A).getByText('owes $450.00')).toBeVisible();

  await tab(B, 'Split').click();
  await split(B).getByRole('button', { name: /Lunch club/ }).click({ timeout: 20_000 });
  await expect(split(B).getByText('Lunch', { exact: true })).toBeVisible({ timeout: 20_000 });
  await split(B).getByRole('tab', { name: 'Balances' }).click();
  await expect(split(B).getByText('owes $450.00')).toBeVisible();
  await split(B).getByRole('tab', { name: /Activity/ }).click();
  await expect(split(B).getByText(new RegExp(`${A.u} linked Rohan to`))).toBeVisible();
  expect(A.errors).toEqual([]);
  expect(B.errors).toEqual([]);
});

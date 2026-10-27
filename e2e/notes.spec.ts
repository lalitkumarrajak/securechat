// End-to-end: the diary. Notes filed under days, personal or about a chat, end-to-end encrypted
// and synced to the account's other devices.
import { test, expect } from '@playwright/test';
import { phone, signIn, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let P: Phone, Q: Phone, P2: Phone;
const diary = (p: Phone) => p.page.getByRole('dialog', { name: 'Diary and notes' });
const card = (p: Phone, text: string) => diary(p).locator('li').filter({ hasText: text });

test.beforeAll(async ({ browser }) => {
  [P, Q] = await Promise.all([phone(browser, uname('diarist')), phone(browser, uname('notee'))]);
});
test.afterAll(async () => { for (const p of [P, Q, P2]) await p?.ctx.close(); });

test('set up: two friends', async () => {
  await Promise.all([signUp(P), signUp(Q)]);
  await P.page.getByRole('button', { name: 'Friends' }).click();
  await P.page.getByRole('tab', { name: 'Add' }).click();
  await P.page.getByPlaceholder('Search by username').fill(Q.u);
  await P.page.locator('li').filter({ hasText: '@' + Q.u }).getByRole('button', { name: 'Add' }).click();
  await P.page.keyboard.press('Escape');
  await Q.page.getByRole('button', { name: 'Friends' }).click();
  await Q.page.locator('li').filter({ hasText: P.u }).getByRole('button', { name: 'Accept' }).click();
  await expect(Q.page.getByText(`You and ${P.u} are now friends`)).toBeVisible();
});

test('write a diary entry for today, with a mood', async () => {
  await P.page.getByRole('button', { name: 'Diary' }).click();
  const d = diary(P);
  await expect(d.getByText(/Only you can read them/)).toBeVisible();
  await d.getByRole('button', { name: 'New note' }).click();
  await d.getByRole('button', { name: 'Mood 🙂' }).click();
  await d.getByLabel('Title').fill('Morning run');
  await d.getByLabel('Note', { exact: true }).fill('5 km by the lake.\nFelt great.');
  await expect(d.getByRole('status')).toHaveText('Saved');
  await d.getByRole('button', { name: 'Back to diary' }).click();
  await expect(d.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(card(P, 'Morning run')).toContainText('5 km by the lake.');
  await expect(d.getByRole('group', { name: 'Calendar' }).getByRole('button', { name: /, 1 note$/ })).toHaveCount(1);
});

test('pick another day: see just that day, and write for it', async () => {
  const d = diary(P);
  const cal = d.getByRole('group', { name: 'Calendar' });
  await d.getByRole('button', { name: 'Previous month' }).click();
  await cal.getByRole('button', { name: /\b15\b/ }).click();
  await expect(d.getByText('Nothing written on this day yet.')).toBeVisible();
  await d.getByRole('button', { name: 'New note' }).click();
  await expect(d.getByLabel('Day')).toHaveValue(/-15$/);
  await d.getByLabel('Note', { exact: true }).fill('Paid the electricity bill');
  await expect(d.getByRole('status')).toHaveText('Saved');
  await d.getByRole('button', { name: 'Back to diary' }).click();
  await expect(card(P, 'Paid the electricity bill')).toBeVisible();
  await expect(card(P, 'Morning run')).toHaveCount(0); // another day
  await d.getByRole('button', { name: 'Show all days' }).click();
  await expect(card(P, 'Morning run')).toBeVisible();
  await expect(card(P, 'Paid the electricity bill')).toBeVisible();
  await d.getByRole('button', { name: 'Back', exact: true }).click();
});

test("notes about a chat, from the chat's menu; filters and search", async () => {
  await P.page.locator('aside').getByRole('button', { name: new RegExp(Q.u) }).first().click(); // "Say hi to your friend"
  await P.page.getByRole('button', { name: 'Chat options' }).click();
  await P.page.getByRole('menuitem', { name: 'Notes about this chat' }).click();
  const d = diary(P);
  await expect(d.getByRole('heading', { name: `Notes · ${Q.u}` })).toBeVisible();
  await expect(card(P, 'Morning run')).toHaveCount(0); // only this chat's notes
  await d.getByRole('button', { name: 'New note' }).click();
  await expect(d.getByLabel('About')).toHaveValue(Q.u);
  await d.getByLabel('Note', { exact: true }).fill('Owes me 200 for dinner');
  await expect(d.getByRole('status')).toHaveText('Saved');
  await d.getByRole('button', { name: 'Back to diary' }).click();
  await expect(card(P, 'Owes me 200')).toBeVisible();

  await d.getByRole('button', { name: 'All', exact: true }).click();
  await expect(card(P, 'Owes me 200')).toContainText(Q.u); // says which chat it's about
  await expect(card(P, 'Morning run')).toBeVisible();
  await d.getByRole('button', { name: 'Personal', exact: true }).click();
  await expect(card(P, 'Owes me 200')).toHaveCount(0);
  await expect(card(P, 'Morning run')).toBeVisible();

  await d.getByRole('button', { name: 'All', exact: true }).click();
  await d.getByRole('button', { name: 'Search notes' }).click();
  await d.getByRole('textbox', { name: 'Search notes' }).fill('lake');
  await expect(card(P, 'Morning run')).toBeVisible();
  await expect(d.locator('li')).toHaveCount(1);
  await d.getByRole('button', { name: 'Close search' }).click();
});

test('they reach my other phone (decrypted there), and changes go both ways', async ({ browser }) => {
  P2 = await phone(browser, P.u);
  await signIn(P2);
  await P2.page.getByRole('button', { name: 'Diary' }).click();
  for (const t of ['Morning run', 'Paid the electricity bill', 'Owes me 200']) await expect(card(P2, t)).toBeVisible({ timeout: 15_000 });

  // Edited on the second phone: shows on the first without reopening
  await card(P2, 'Morning run').click();
  await diary(P2).getByLabel('Title').fill('Evening run');
  await expect(diary(P2).getByRole('status')).toHaveText('Saved');
  await diary(P2).getByRole('button', { name: 'Back to diary' }).click();
  await expect(card(P, 'Evening run')).toBeVisible({ timeout: 15_000 });

  // Deleted on the first phone: gone from the second
  await card(P, 'Paid the electricity bill').click();
  await diary(P).getByRole('button', { name: 'Delete note' }).click();
  await P.page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(card(P, 'Paid the electricity bill')).toHaveCount(0);
  await expect(card(P2, 'Paid the electricity bill')).toHaveCount(0, { timeout: 15_000 });
  await expect(card(P2, 'Evening run')).toBeVisible();
  for (const p of [P, Q, P2]) expect(p.errors).toEqual([]);
});

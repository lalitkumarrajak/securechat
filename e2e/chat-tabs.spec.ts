// End-to-end: tabs inside a chat. One person adds "House", both see it, its messages stay out of
// the main chat (and the main chat's out of it), unread counts per tab, rename, and removing it.
import { test, expect } from '@playwright/test';
import { bubble, makeFriends, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let P: Phone, Q: Phone;
const chatTab = (p: Phone, name: string | RegExp) => p.page.getByRole('tablist', { name: 'Chat tabs' }).getByRole('tab', { name });
const open = async (p: Phone, other: Phone) => {
  await p.page.getByRole('button', { name: 'Friends' }).click();
  await p.page.getByRole('dialog').locator('li').filter({ hasText: other.u }).first().click();
  await expect(p.page.locator('#composer-input')).toBeVisible();
};
const send = async (p: Phone, text: string) => {
  await p.page.locator('#composer-input').fill(text);
  await p.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(bubble(p, text)).toBeVisible();
};

test.beforeAll(async ({ browser }) => {
  [P, Q] = await Promise.all([phone(browser, uname('tabsa')), phone(browser, uname('tabsb'))]);
});
test.afterAll(async () => { for (const p of [P, Q]) await p?.ctx.close(); });

test('set up: two friends chatting', async () => {
  await Promise.all([signUp(P), signUp(Q)]);
  await makeFriends(P, Q);
  await open(P, Q);
  await open(Q, P);
  await send(P, 'Hi there');
  await expect(bubble(Q, 'Hi there')).toBeVisible();
  await expect(P.page.getByRole('tablist', { name: 'Chat tabs' })).toHaveCount(0); // no tabs until one is added
});

test('P adds a House tab; both see it', async () => {
  await P.page.getByRole('button', { name: 'Chat options' }).click();
  await P.page.getByRole('menuitem', { name: 'Add a tab' }).click();
  const d = P.page.getByRole('dialog', { name: 'Add a tab' });
  await d.getByRole('button', { name: '🏠 House' }).click();
  await expect(d.getByLabel('Name')).toHaveValue('House');
  await d.getByRole('button', { name: 'Add tab' }).click();
  await expect(chatTab(P, /House/)).toHaveAttribute('aria-selected', 'true');
  await expect(chatTab(Q, /House/)).toBeVisible();
  await expect(chatTab(Q, /Main/)).toHaveAttribute('aria-selected', 'true');
  // The new tab starts empty: the main chat's messages aren't in it.
  await expect(bubble(P, 'Hi there')).toHaveCount(0);
});

test('a message in House stays out of the main chat; Q sees it as unread on the tab', async () => {
  await send(P, 'Rent paid for May');
  await expect(chatTab(Q, /House/)).toContainText('1');
  await expect(bubble(Q, 'Rent paid for May')).toHaveCount(0); // Q is on the main chat
  await expect(bubble(Q, 'Hi there')).toBeVisible();

  await chatTab(Q, /House/).click();
  await expect(bubble(Q, 'Rent paid for May')).toBeVisible();
  await expect(bubble(Q, 'Hi there')).toHaveCount(0);
  await expect(chatTab(Q, /House/)).not.toContainText('1');
  await send(Q, 'Thanks! Plumber comes Friday');
  await expect(bubble(P, 'Thanks! Plumber comes Friday')).toBeVisible();

  // Back on Main, neither House message is there.
  await chatTab(P, /Main/).click();
  await expect(bubble(P, 'Hi there')).toBeVisible();
  await expect(bubble(P, 'Rent paid for May')).toHaveCount(0);
  await expect(bubble(P, 'Plumber comes Friday')).toHaveCount(0);
  await P.page.screenshot({ path: 'e2e/.artifacts/screens/70-chat-tabs.png' });

  // After a reload the tab and its messages are still apart.
  await P.page.reload();
  await open(P, Q);
  await expect(bubble(P, 'Hi there')).toBeVisible();
  await expect(bubble(P, 'Rent paid for May')).toHaveCount(0);
  await chatTab(P, /House/).click();
  await expect(bubble(P, 'Rent paid for May')).toBeVisible();
});

test('rename the tab; both see the new name', async () => {
  await P.page.getByRole('button', { name: 'House tab options' }).click();
  await P.page.getByRole('menuitem', { name: 'Rename tab' }).click();
  const d = P.page.getByRole('dialog', { name: 'Rename tab' });
  await d.getByLabel('Name').fill('Home');
  await d.getByRole('radio', { name: '🛒' }).click();
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(chatTab(P, /Home/)).toContainText('🛒');
  await expect(chatTab(Q, /Home/)).toBeVisible();
});

test('remove the tab: it and its messages go, the main chat is untouched', async () => {
  await P.page.getByRole('button', { name: 'Home tab options' }).click();
  await P.page.getByRole('menuitem', { name: 'Remove tab' }).click();
  await P.page.getByRole('alertdialog').getByRole('button', { name: 'Remove tab' }).click();
  for (const p of [P, Q]) {
    await expect(p.page.getByRole('tablist', { name: 'Chat tabs' })).toHaveCount(0);
    await expect(bubble(p, 'Hi there')).toBeVisible();
    await expect(bubble(p, 'Rent paid for May')).toHaveCount(0);
  }
  expect([...P.errors, ...Q.errors]).toEqual([]);
});

// End-to-end: groups. G1 is friends with G2 and G3; G2 and G3 aren't friends with each other,
// yet read each other's (end-to-end encrypted) group messages. G4 joins with the invite link.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { PASSWORD, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let G1: Phone, G2: Phone, G3: Phone, G4: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const groupRow = (p: Phone) => p.page.locator('aside li').filter({ hasText: 'Family' }).first();
const box = (p: Phone) => p.page.getByRole('textbox', { name: 'Message' });
const bubbleWith = (p: Phone, text: string) => p.page.locator('[data-k]').filter({ hasText: text }).last();

async function befriend(a: Phone, b: Phone) {
  await a.page.getByRole('button', { name: 'Friends' }).click();
  await a.page.getByRole('tab', { name: 'Add' }).click();
  await a.page.getByPlaceholder('Search by username').fill(b.u);
  await a.page.locator('li').filter({ hasText: '@' + b.u }).getByRole('button', { name: 'Add' }).click();
  await a.page.keyboard.press('Escape');
  await b.page.getByRole('button', { name: 'Friends' }).click();
  await b.page.locator('li').filter({ hasText: a.u }).getByRole('button', { name: 'Accept' }).click();
  await expect(b.page.getByText(`You and ${a.u} are now friends`)).toBeVisible();
  await b.page.keyboard.press('Escape');
}

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  [G1, G2, G3, G4] = await Promise.all(['ghost', 'gina', 'gary', 'gwen'].map((n) => phone(browser, uname(n))));
  for (const p of [G1, G2, G3, G4]) await p.page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined }); });
});
test.afterAll(async () => { for (const p of [G1, G2, G3, G4]) await p?.ctx.close(); });

test('set up: three people, two of them friends with the host only', async () => {
  await Promise.all([signUp(G1), signUp(G2), signUp(G3)]);
  await befriend(G1, G2);
  await befriend(G1, G3);
});

test('create a group with friends', async () => {
  await G1.page.getByRole('button', { name: 'Menu' }).click();
  await G1.page.getByRole('menuitem', { name: 'New group' }).click();
  const panel = G1.page.getByRole('dialog', { name: 'New group' });
  await expect(panel.getByRole('heading', { name: 'Add group members' })).toBeVisible();
  await panel.getByRole('button', { name: new RegExp('@' + G2.u) }).click();
  await panel.getByRole('button', { name: new RegExp('@' + G3.u) }).click();
  await panel.getByRole('button', { name: 'Next' }).click();
  await G1.page.getByLabel('Group name').fill('Family');
  await G1.page.getByRole('button', { name: 'Create group' }).click();
  await expect(G1.page.locator('header').getByText('Family', { exact: true })).toBeVisible();
  await expect(G1.page.getByRole('log').getByText('You created the group “Family”')).toBeVisible();
  // It shows up for the others straight away
  await expect(groupRow(G2)).toBeVisible();
  await expect(groupRow(G3)).toBeVisible();
});

test('messages, sender names and @mentions between people who aren’t friends', async () => {
  await box(G1).pressSequentially(`Hi everyone, @${G3.u.slice(0, 3)}`);
  await G1.page.getByRole('listbox', { name: 'Mention someone' }).getByRole('option').filter({ hasText: '@' + G3.u }).click();
  await expect(box(G1)).toHaveValue(`Hi everyone, @${G3.u} `);
  await box(G1).pressSequentially('dinner at 8?');
  await G1.page.getByRole('button', { name: 'Send', exact: true }).click();

  await groupRow(G3).click();
  const atG3 = bubbleWith(G3, 'dinner at 8?');
  await expect(atG3).toBeVisible({ timeout: 15_000 });
  await expect(atG3.getByText(G1.u, { exact: true })).toBeVisible(); // sender's name
  await expect(atG3.locator('span.bg-amber-300\\/80', { hasText: '@' + G3.u })).toBeVisible(); // "you" stand out

  // G2 answers; G3 (not G2's friend) can read it
  await groupRow(G2).click();
  await expect(bubbleWith(G2, 'dinner at 8?')).toBeVisible({ timeout: 15_000 });
  await box(G2).fill('Count me in!');
  await G2.page.getByRole('button', { name: 'Send', exact: true }).click();
  const reply = bubbleWith(G3, 'Count me in!');
  await expect(reply).toBeVisible({ timeout: 15_000 });
  await expect(reply.getByText(G2.u, { exact: true })).toBeVisible();
  await expect(G3.page.getByText('couldn’t be decrypted')).toHaveCount(0);
  await expect(G1.page.locator('header').getByText(new RegExp(`${G2.u}.*${G3.u}|${G3.u}.*${G2.u}`))).toBeVisible(); // members under the name
  await G3.page.screenshot({ path: shots('40-group-chat') });
});

test('admins can limit sending to admins', async () => {
  await G1.page.locator('header').getByRole('button', { name: /Family/ }).click();
  await expect(G1.page.getByRole('dialog', { name: 'Group info' })).toBeVisible();
  await G1.page.getByRole('switch', { name: 'Only admins can send messages' }).click();
  await expect(G2.page.getByText('Only admins can send messages.')).toBeVisible();
  await expect(G2.page.getByRole('log').getByText('set it so only admins can send messages')).toBeVisible();
  await G1.page.getByRole('switch', { name: 'Only admins can send messages' }).click();
  await expect(box(G2)).toBeVisible();
  await G1.page.screenshot({ path: shots('41-group-info') });
});

test('anyone with the invite link can join, and sees messages from then on', async () => {
  await G1.page.getByRole('button', { name: /Invite via link/ }).click();
  await G1.page.getByRole('button', { name: 'Copy link' }).click();
  const link = await G1.page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/\?group=[A-Za-z0-9_-]{16}$/);
  await G1.page.keyboard.press('Escape');

  await G4.page.goto(link);
  await expect(G4.page.getByText('You’ve been invited to a group')).toBeVisible();
  await G4.page.getByRole('tab', { name: 'Create account' }).click();
  const form = G4.page.getByRole('tabpanel');
  await form.getByLabel('Username').fill(G4.u);
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await form.getByLabel('Confirm password').fill(PASSWORD);
  await form.getByRole('button', { name: 'Create account' }).click();
  const join = G4.page.getByRole('alertdialog');
  await expect(join).toContainText('Join “Family”?');
  await join.getByRole('button', { name: 'Join group' }).click();
  await expect(G4.page.locator('header').getByText('Family', { exact: true })).toBeVisible();
  await expect(G1.page.getByRole('log').getByText(`${G4.u} joined using the invite link`)).toBeVisible();

  await box(G1).fill('Welcome Gwen!');
  await G1.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(bubbleWith(G4, 'Welcome Gwen!')).toBeVisible({ timeout: 15_000 });
  await expect(G4.page.getByText('dinner at 8?')).toHaveCount(0); // no history from before they joined
});

test('removing someone: they stop getting messages', async () => {
  await G1.page.locator('header').getByRole('button', { name: /Family/ }).click();
  await G1.page.getByRole('button', { name: `Options for ${G3.u}` }).click();
  await G1.page.getByRole('menuitem', { name: `Remove ${G3.u}` }).click();
  await G1.page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click();
  await expect(G3.page.getByText('You’re no longer in this group.')).toBeVisible();
  await G1.page.keyboard.press('Escape');
  await box(G1).fill('Secret plan after the change');
  await G1.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(bubbleWith(G2, 'Secret plan after the change')).toBeVisible({ timeout: 15_000 });
  await G3.page.waitForTimeout(1500);
  await expect(G3.page.getByText('Secret plan after the change')).toHaveCount(0);
});

test('play a game with the group', async () => {
  await G2.page.getByRole('button', { name: 'Play a game' }).click();
  const dlg = G2.page.getByRole('dialog', { name: 'Play a game' });
  await expect(dlg.getByRole('button', { name: new RegExp(G4.u) })).toBeVisible(); // a group member who isn't G2's friend
  await G2.page.keyboard.press('Escape');
  for (const p of [G1, G2, G3, G4]) expect(p.errors).toEqual([]);
});

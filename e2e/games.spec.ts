// End-to-end: Ludo between people who aren't friends, joined from a shared link.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let A: Phone, B: Phone, C: Phone;
let link = '';
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const token = (p: Phone, label: string) => p.page.getByRole('button', { name: label });
const tokenAt = (p: Phone, seat: number, t: number) => p.page.locator(`[data-token="${seat}/${t}"]`);

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  A = await phone(browser, uname('host'));
  B = await phone(browser, uname('bina'));
  C = await phone(browser, uname('chet'));
  // No share sheet, so only the Copy button shows (as on most computers).
  for (const p of [A, B, C]) await p.page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined }); });
});

test.afterEach(async () => { for (const p of [A, B, C]) if (p?.errors.length) console.log('PAGEERR', p.u, p.errors); });

test.afterAll(async () => {
  for (const p of [A, B, C]) await p?.ctx.close();
});

test('host creates a game and shares its link', async () => {
  await signUp(A);
  await A.page.getByRole('button', { name: 'Play games' }).click();
  const dlg = A.page.getByRole('dialog', { name: 'Play a game' });
  await expect(dlg.getByRole('button', { name: /Ludo/ })).toBeVisible();
  await dlg.getByRole('button', { name: 'Create game and share link' }).click();
  await expect(A.page.getByRole('heading', { name: 'Waiting for players' })).toBeVisible();
  await expect(A.page.getByText('Invite anyone with this link')).toBeVisible();
  await A.page.getByRole('button', { name: 'Copy link' }).click();
  await expect(A.page.getByText('Link copied').first()).toBeVisible();
  link = await A.page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/\?play=[A-Za-z0-9_-]{12}$/);
  await expect(A.page.getByText(/Anyone with the link can join/)).toBeVisible();
  await A.page.screenshot({ path: shots('20-ludo-lobby') });
});

test('people who aren’t friends open the link, sign up and land in the game', async () => {
  for (const p of [B, C]) {
    await p.page.goto(link);
    await expect(p.page.getByText('You’ve been invited to a game')).toBeVisible();
    await signUp(p); // signUp visits '/', the invite survives in the tab
  }
  // signUp navigated to '/', so open the link again the way a signed-in person would
  for (const p of [B, C]) {
    await p.page.goto(link);
    await expect(p.page.getByRole('heading', { name: 'Waiting for players' })).toBeVisible();
  }
  await expect(A.page.getByText('Ready', { exact: true })).toHaveCount(3);
  await A.page.getByRole('button', { name: 'Start with 3 players' }).click();
  for (const p of [A, B, C]) await expect(p.page.getByRole('img', { name: 'Ludo board' })).toBeVisible();
  await expect(A.page.getByRole('img', { name: '5 of 5 chances left' })).toHaveCount(3); // hearts: missed turns allowed
  await A.page.waitForTimeout(400);
  await A.page.screenshot({ path: shots('21-ludo-start') });
});

test('dice, tokens and turns', async () => {
  // Dice from GAME_TEST_DICE: A 6 (comes out by itself), 3 (moves by itself); B 2 (no move); C 6, 4; A 6 (choose)
  await A.page.getByRole('button', { name: 'Roll dice' }).click();
  await expect(tokenAt(A, 0, 0)).toHaveAttribute('data-p', '0', { timeout: 5000 });
  await A.page.getByRole('button', { name: 'Roll dice' }).click();
  await expect(tokenAt(A, 0, 0)).toHaveAttribute('data-p', '3', { timeout: 5000 });
  await expect(B.page.getByRole('button', { name: 'Roll dice' })).toBeVisible({ timeout: 5000 });
  await expect(A.page.getByRole('button', { name: 'Roll dice' })).toHaveCount(0);
  await B.page.getByRole('button', { name: 'Roll dice' }).click(); // 2: nothing can move
  await C.page.getByRole('button', { name: 'Roll dice' }).click({ timeout: 8000 });
  await expect(tokenAt(C, 2, 0)).toHaveAttribute('data-p', '0', { timeout: 5000 });
  await C.page.getByRole('button', { name: 'Roll dice' }).click();
  await expect(tokenAt(A, 2, 0)).toHaveAttribute('data-p', '4', { timeout: 5000 }); // everyone sees C's move
  await A.page.getByRole('button', { name: 'Roll dice' }).click({ timeout: 8000 });
  // A 6 with one token out and three home: A chooses
  await expect(token(A, 'Move token 2')).toBeVisible({ timeout: 5000 });
  await expect(token(A, 'Move token 1')).toBeVisible();
  await A.page.waitForTimeout(300);
  await A.page.screenshot({ path: shots('22-ludo-choose') });
  await token(A, 'Move token 2').click();
  await expect(tokenAt(B, 0, 1)).toHaveAttribute('data-p', '0', { timeout: 5000 });
  await A.page.getByRole('button', { name: 'Roll dice' }).click(); // 5: two tokens out, choose again
  await token(A, 'Move token 1').click();
  await expect(tokenAt(C, 0, 0)).toHaveAttribute('data-p', '8', { timeout: 5000 });
});

test('emoji, quick phrases and chat during the game', async () => {
  await B.page.getByRole('button', { name: 'Emoji and quick messages' }).click();
  await B.page.getByRole('menuitem', { name: '😂' }).click();
  await expect(A.page.locator(`[data-player="${B.u}"] .ludo-bubble`)).toHaveText('😂');
  await C.page.getByRole('button', { name: 'Emoji and quick messages' }).click();
  await C.page.getByRole('menuitem', { name: 'Nice move!' }).click();
  await expect(A.page.locator(`[data-player="${C.u}"] .ludo-bubble`)).toHaveText('Nice move!');
  await A.page.screenshot({ path: shots('23-ludo-bubbles') });
  await B.page.getByRole('button', { name: 'Game chat' }).click();
  // @ suggests players; picking one completes the tag
  const msg = B.page.getByRole('textbox', { name: 'Game message' });
  await msg.pressSequentially('Your move @' + A.u.slice(0, 3));
  await B.page.getByRole('listbox', { name: 'Mention a player' }).getByRole('option').filter({ hasText: '@' + A.u }).click();
  await expect(msg).toHaveValue(`Your move @${A.u} `);
  await msg.pressSequentially('hurry!');
  await B.page.getByRole('button', { name: 'Send', exact: true }).click();
  // The tagged player is alerted even with the chat closed
  await expect(A.page.getByText(/mentioned you/).first()).toBeVisible();
  await msg.fill('Good game everyone');
  await B.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(A.page.getByRole('button', { name: 'Game chat' })).toContainText(/\d/); // unread count
  await A.page.getByRole('button', { name: 'Game chat' }).click();
  await expect(A.page.getByRole('dialog', { name: 'Game chat' }).getByText('Good game everyone')).toBeVisible();
  await expect(A.page.getByRole('dialog', { name: 'Game chat' }).locator('span.bg-amber-300\\/90', { hasText: '@' + A.u })).toBeVisible(); // my tag stands out
  await A.page.screenshot({ path: shots('24-ludo-chat') });
  await A.page.keyboard.press('Escape');
  await B.page.keyboard.press('Escape');
});

test('leaving: the last one left wins', async () => {
  for (const p of [B, C]) {
    await p.page.getByRole('button', { name: 'Game menu' }).click();
    await p.page.getByRole('menuitem', { name: 'Leave game' }).click();
    await p.page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
  }
  await expect(A.page.getByRole('heading', { name: 'You won!' })).toBeVisible({ timeout: 10_000 });
  await A.page.screenshot({ path: shots('25-ludo-results') });
  await A.page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(A.page.getByRole('img', { name: 'Ludo board' })).toHaveCount(0);
  for (const p of [A, B, C]) expect(p.errors).toEqual([]);
});

test('5 or 6 players use the six-arm board', async ({ browser }) => {
  const more = await Promise.all(['dev', 'eka', 'fay'].map((n) => phone(browser, uname(n))));
  try {
    await A.page.getByRole('button', { name: 'Play games' }).click();
    await A.page.getByRole('dialog', { name: 'Play a game' }).getByRole('button', { name: 'Create game and share link' }).click();
    await A.page.getByRole('button', { name: 'Copy link' }).click();
    const l2 = await A.page.evaluate(() => navigator.clipboard.readText());
    for (const p of [B, C]) await p.page.goto(l2);
    for (const p of more) { await signUp(p); await p.page.goto(l2); }
    // A full table starts by itself
    for (const p of [A, ...more]) await expect(p.page.getByRole('img', { name: 'Ludo board' })).toBeVisible();
    await expect(A.page.locator('[data-token]')).toHaveCount(24);
    await A.page.waitForTimeout(400);
    await A.page.screenshot({ path: shots('26-ludo-six') });
  } finally {
    for (const p of more) await p.ctx.close();
  }
});

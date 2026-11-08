// End-to-end: Ludo between people who aren't friends, joined from a shared link.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { openApp, newGame, phone, signUp, tab, uname, type Phone } from './helpers';

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
  await newGame(A);
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
  await expect(A.page.getByRole('button', { name: 'Rolled 5' })).toBeVisible({ timeout: 5000 }); // like a person: look at the dice, then pick
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
  await expect(A.page.getByRole('dialog', { name: 'Game chat' }).locator('span.bg-blue-600', { hasText: '@' + A.u })).toBeVisible(); // my tag stands out
  await A.page.screenshot({ path: shots('24-ludo-chat') });
  await A.page.keyboard.press('Escape');
  await B.page.keyboard.press('Escape');
});

test('tease: tap a player, throw a tomato, and it flies to them', async () => {
  await B.page.locator(`[data-player="${A.u}"]`).click({ position: { x: 6, y: 6 } });
  const menu = B.page.getByRole('menu', { name: /^Tease/ });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Tomato' }).click();
  await expect(menu).toBeHidden();
  await expect(A.page.getByText('🍅').first()).toBeVisible({ timeout: 3000 }); // in flight on the target's screen
  await A.page.screenshot({ path: shots('24b-ludo-tease') });
  await expect(A.page.getByText('💥').first()).toBeVisible({ timeout: 3000 }); // and where it lands
});

test('leaving: the last one left wins', async () => {
  for (const p of [B, C]) {
    await p.page.getByRole('button', { name: 'Game menu' }).click();
    await p.page.getByRole('menuitem', { name: 'Leave game' }).click();
    await p.page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
  }
  await expect(A.page.getByRole('heading', { name: 'You won!' })).toBeVisible({ timeout: 10_000 });
  await A.page.screenshot({ path: shots('25-ludo-results') });
  for (const p of [A, B, C]) expect(p.errors).toEqual([]);
});

test('Play again: the same people are invited to a new game, even if they aren’t friends', async () => {
  await A.page.getByRole('button', { name: 'Play again' }).click();
  await expect(A.page.getByRole('heading', { name: 'Waiting for players' })).toBeVisible();
  await expect(B.page.getByText(/invited you to play Ludo/)).toBeVisible({ timeout: 10_000 });
  await B.page.getByRole('button', { name: 'Join', exact: true }).first().click();
  await expect(A.page.getByRole('listitem').filter({ hasText: B.u }).getByText('Ready').first()).toBeVisible({ timeout: 10_000 });
  await A.page.getByRole('button', { name: 'Cancel game' }).last().click();
  await A.page.getByRole('alertdialog').getByRole('button', { name: 'Cancel game' }).click();
  await expect(A.page.getByRole('img', { name: 'Ludo board' })).toHaveCount(0);
  for (const p of [A, B, C]) expect(p.errors).toEqual([]);
});

test('5 or 6 players use the six-arm board', async ({ browser }) => {
  const more = await Promise.all(['dev', 'eka', 'fay'].map((n) => phone(browser, uname(n))));
  try {
    await newGame(A);
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

test('More → Games keeps the tabs on screen while it downloads, Back returns to More, and the Diary from there', async ({ browser }) => {
  const P = await phone(browser, uname('gtab'));
  try {
    await signUp(P);
    await P.page.route(/\/assets\/GamesHub-.*\.js/, async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
    await openApp(P, 'Games');
    // Still downloading: the page shows its frame and every tab, not a blank screen.
    await expect(P.page.getByRole('heading', { name: 'Games', exact: true })).toBeVisible({ timeout: 1000 });
    for (const t of ['Chats', 'Calendar', 'Account', 'Split', 'More']) await expect(tab(P, t)).toBeVisible({ timeout: 500 });
    await expect(tab(P, 'More')).toHaveAttribute('aria-selected', 'true');
    await expect(P.page.getByRole('tablist', { name: 'Sanga' }).getByRole('tab')).toHaveText([/Chats$/, /Calendar$/, /Account$/, /Split$/, /More$/]); // five fit a phone
    await expect(P.page.getByRole('button', { name: 'Play Ludo' })).toBeVisible({ timeout: 10_000 });
    // Back: to the More page, with Games and the Diary; the Diary's Back too.
    await P.page.getByRole('button', { name: 'Back', exact: true }).click();
    const more = P.page.getByRole('region', { name: 'More' });
    await expect(more.getByRole('button', { name: /^Games/ })).toBeVisible(); // the page has no heading
    await expect(tab(P, 'More')).toHaveAttribute('aria-selected', 'true');
    await more.getByRole('button', { name: /^Diary/ }).click();
    await expect(P.page.getByRole('region', { name: 'Diary and notes' })).toBeVisible();
    await expect(tab(P, 'More')).toHaveAttribute('aria-selected', 'true');
    await P.page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(more.getByRole('button', { name: /^Games/ })).toBeVisible();
  } finally { await P.ctx.close(); }
});

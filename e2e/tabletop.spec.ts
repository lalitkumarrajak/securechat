// End-to-end: Tic-Tac-Toe, Connect Four and Snakes & Ladders, each against a computer player. (Named so it runs after games.spec.ts: the test server hands its fixed dice rolls to whichever game rolls first.)
import { test, expect, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { newGame, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('board'));
  await signUp(P);
});
test.afterAll(async () => { await P?.ctx.close(); });

/** Games tab → pick the game → a lobby with one computer player → start. */
async function start(game: string) {
  await newGame(P, game);
  const dlg = P.page.getByRole('dialog', { name: 'Play a game' });
  await dlg.getByRole('button', { name: new RegExp(game.replace(/[&]/g, '.')) }).click();
  await dlg.getByRole('button', { name: 'Create game and share link' }).click();
  await expect(P.page.getByRole('heading', { name: 'Waiting for players' })).toBeVisible();
  await P.page.getByRole('button', { name: 'Add computer player' }).click();
  // Two-player games begin as soon as the seat is filled; Snakes & Ladders (up to 4) waits for Start.
  const go = P.page.getByRole('button', { name: 'Start with 2 players' });
  await go.or(P.page.getByRole('dialog', { name: /Tic|Connect/ })).first().waitFor();
  if (await go.isVisible()) await go.click();
}
async function leave() {
  await P.page.getByRole('button', { name: 'Game menu' }).click();
  await P.page.getByRole('menuitem', { name: /Leave game|Close game/ }).click();
  const confirmLeave = P.page.getByRole('alertdialog').getByRole('button', { name: 'Leave' });
  if (await confirmLeave.isVisible().catch(() => false)) await confirmLeave.click();
  await expect(P.page.getByRole('dialog', { name: game0 })).toHaveCount(0).catch(() => {});
}
const game0 = /Tic|Connect|Snakes/;
const status = () => P.page.getByRole('status').last();

test('Tic-Tac-Toe: play until it ends; marks appear, the computer replies', async () => {
  await start('Tic-Tac-Toe');
  const board = P.page.getByRole('grid', { name: 'Tic-Tac-Toe board' });
  await expect(board).toBeVisible();
  await expect(status()).toHaveText('Your turn');
  for (let n = 0; n < 5; n++) {
    await expect(status()).toHaveText(/Your turn|won|draw/, { timeout: 20_000 });
    if (!/Your turn/.test((await status().textContent()) ?? '')) break;
    await board.getByRole('gridcell', { name: /empty/ }).first().click();
    await expect(status()).not.toHaveText('Your turn', { timeout: 10_000 }); // the server took the move: it's the computer's turn, or over
    if (n === 0) {
      await expect(board.getByRole('gridcell', { name: /, X$/ })).toHaveCount(1);
      await expect(board.getByRole('gridcell', { name: /, O$/ })).toHaveCount(1, { timeout: 15_000 }); // the computer answered
      await P.page.screenshot({ path: shots('60-tictactoe') });
    }
  }
  await expect(status()).toHaveText(/won|draw/, { timeout: 30_000 });
  await expect(P.page.getByRole('heading', { name: /You won|You came|draw/i })).toBeVisible({ timeout: 10_000 }); // results
  await P.page.getByRole('button', { name: 'Close', exact: true }).click();
});

test('Connect Four: the guide opens the first time, tips say where to drop; discs fall, the computer answers', async () => {
  await P.page.evaluate(() => localStorage.setItem('sanga-games-howto', '["ludo","uno","snakes","tictactoe"]')); // never played Connect Four before
  await start('Connect Four');
  const guide = P.page.getByRole('dialog', { name: 'How to play Connect Four' });
  await expect(guide).toContainText('Get four of your discs in a line to win');
  await P.page.screenshot({ path: shots('61a-connect4-how-to') });
  await guide.getByRole('button', { name: 'Got it' }).click();
  await expect(guide).toHaveCount(0);
  const board = P.page.getByRole('grid', { name: 'Connect Four board' });
  await expect(board).toBeVisible();
  await expect(P.page.getByRole('note', { name: 'Tip' })).toContainText('Start in the middle (column 4)');
  await P.page.getByRole('button', { name: 'Drop in column 4' }).click();
  await expect(board.getByRole('gridcell', { name: /red/ })).toHaveCount(1);
  await expect(board.getByRole('gridcell', { name: /yellow/ })).toHaveCount(1, { timeout: 20_000 });
  await expect(status()).toHaveText('Your turn', { timeout: 10_000 });
  await expect(P.page.getByRole('note', { name: 'Tip' })).toBeVisible();
  await P.page.screenshot({ path: shots('61-connect4') });
  await P.page.getByRole('switch', { name: 'Tips' }).click();
  await expect(P.page.getByRole('note', { name: 'Tip' })).toHaveCount(0);
  await P.page.getByRole('button', { name: 'How to play' }).click(); // any time from the ? button
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Got it' }).click();
  await leave();
});

test('Snakes & Ladders: roll, walk, the computer rolls, back to me', async () => {
  await start('Snakes');
  await expect(P.page.getByRole('img', { name: /Snakes and Ladders board/ })).toBeVisible();
  const token = (i: number): Locator => P.page.locator(`[data-token="${i}"]`);
  const before = await token(0).getAttribute('style');
  await P.page.getByRole('button', { name: 'Roll dice' }).click();
  await expect.poll(async () => token(0).getAttribute('style'), { timeout: 8000 }).not.toBe(before); // my token moved
  await expect(status()).toHaveText(/’s turn…|Your turn/, { timeout: 10_000 });
  await expect(P.page.getByRole('button', { name: 'Roll dice' })).toBeVisible({ timeout: 30_000 }); // computer played, my turn (or a six again)
  await P.page.screenshot({ path: shots('62-snakes') });
  await leave();
});

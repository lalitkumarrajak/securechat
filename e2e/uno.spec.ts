// End-to-end: UNO against two computer players.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('unoplay'));
});
test.afterAll(async () => { await P?.ctx.close(); });

test('start UNO and fill seats with computer players', async () => {
  await signUp(P);
  await P.page.getByRole('button', { name: 'Play games' }).click();
  const dlg = P.page.getByRole('dialog', { name: 'Play a game' });
  await dlg.getByRole('button', { name: /UNO/ }).click();
  await dlg.getByRole('button', { name: 'Create game and share link' }).click();
  await expect(P.page.getByRole('heading', { name: 'Waiting for players' })).toBeVisible();
  await P.page.getByRole('button', { name: 'Add computer player' }).click();
  await P.page.getByRole('button', { name: 'Add computer player' }).click();
  await expect(P.page.getByText('Computer', { exact: true })).toHaveCount(2);
  await P.page.screenshot({ path: shots('50-uno-lobby') });
  await P.page.getByRole('button', { name: 'Start with 3 players' }).click();
  await expect(P.page.getByRole('list', { name: 'Your cards' }).getByRole('listitem')).toHaveCount(7);
  await expect(P.page.getByLabel('7 cards')).toHaveCount(2); // each computer player holds 7
});

test('play a turn; the computers play theirs and it comes back to me', async () => {
  const hand = P.page.getByRole('list', { name: 'Your cards' }).getByRole('listitem');
  const playable = P.page.getByRole('listitem', { name: /playable/ });
  await P.page.waitForTimeout(600);
  await P.page.screenshot({ path: shots('51-uno-table') });
  if (await playable.count()) {
    await playable.first().click();
    const pick = P.page.getByRole('dialog', { name: 'Choose a colour' });
    if (await pick.isVisible().catch(() => false)) await pick.getByRole('button', { name: 'Blue' }).click();
    await expect(hand).toHaveCount(6);
  } else {
    await P.page.getByRole('button', { name: /Draw a card/ }).click();
    const keep = P.page.getByRole('button', { name: 'Keep' });
    if (await keep.isVisible({ timeout: 1500 }).catch(() => false)) await keep.click();
    await expect(hand).toHaveCount(8);
  }
  // Both computers play (each "thinks" for a moment), then it's my turn again
  await expect(P.page.getByText('Your turn', { exact: true })).toBeVisible({ timeout: 20_000 });
  expect(P.errors).toEqual([]);
});

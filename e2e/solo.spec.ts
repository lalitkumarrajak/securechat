// End-to-end: games you play on your own. The Games page lists them without downloading any of them;
// a game's code comes only when you open it. Colour Pour: its guide shows once, pouring follows the
// rules, undo and hint work, a level is finished, the next one is kept after a reload, Back closes it.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { openApp, openSolo, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const gameChunks: string[] = [];

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('solo'));
  P.page.on('request', (r) => { if (/\/assets\/Game-[\w-]+\.js$/.test(r.url())) gameChunks.push(r.url()); });
  await signUp(P);
});
test.afterAll(async () => { await P?.ctx.close(); });

test('the Games page lists the solo games by kind, without downloading any of them', async () => {
  await openApp(P, 'Games');
  const solo = P.page.getByRole('region', { name: 'On your own' });
  await expect(solo.getByRole('button', { name: 'Colour Pour', exact: true })).toBeVisible();
  await solo.getByRole('tab', { name: 'Puzzle' }).click();
  await expect(solo.getByRole('button', { name: 'Colour Pour', exact: true })).toBeVisible();
  await solo.getByRole('tab', { name: 'All' }).click();
  await P.page.screenshot({ path: shots('70-solo-games'), fullPage: true });
  expect(gameChunks).toEqual([]);
});

test('Colour Pour: the guide shows the first time only; pour, undo, hint, and finish the level', async () => {
  await P.page.evaluate(() => localStorage.setItem('sanga-solo-howto', '[]'));
  const g = await openSolo(P, 'Colour Pour', 3);
  expect(gameChunks).toHaveLength(1); // just this game's code
  const guide = P.page.getByRole('dialog', { name: 'How to play Colour Pour' });
  await expect(guide).toContainText('every tube holds just one colour');
  await guide.getByRole('button', { name: 'Got it' }).click();

  const tubes = g.getByRole('group', { name: 'Tubes' }).getByRole('button');
  await expect(g.getByText('Level 1')).toBeVisible();
  const count = await tubes.count();
  expect(count).toBe(5); // 3 colours + 2 empty
  // pick up a full tube, pour into an empty one, undo
  await tubes.nth(0).click();
  await expect(tubes.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await tubes.nth(count - 1).click();
  await expect(tubes.nth(count - 1)).not.toHaveAccessibleName(/empty/);
  await g.getByRole('button', { name: 'Undo' }).click();
  await expect(tubes.nth(count - 1)).toHaveAccessibleName(/empty/);

  // follow the hints to the end
  const status = g.getByRole('status');
  for (let i = 0; i < 60; i++) {
    if (await g.getByRole('dialog', { name: /Level 1 done/ }).isVisible()) break;
    await g.getByRole('button', { name: 'Hint' }).click();
    const [, a, b] = (await status.textContent())!.match(/Pour tube (\d+) into tube (\d+)/)!;
    await tubes.nth(Number(a) - 1).click();
    await tubes.nth(Number(b) - 1).click();
  }
  const done = g.getByRole('dialog', { name: 'Level 1 done!' });
  await expect(done).toBeVisible();
  await P.page.screenshot({ path: shots('71-colour-pour-done') });
  await done.getByRole('button', { name: 'Next level' }).click();
  await expect(g.getByText('Level 2')).toBeVisible();
  await P.page.screenshot({ path: shots('72-colour-pour') });
});

test('the level is kept; Back closes the game; the guide doesn’t come back', async () => {
  await P.page.goBack(); // the phone's Back
  await expect(P.page.getByRole('dialog', { name: 'Colour Pour' })).toHaveCount(0);
  await P.page.reload();
  const g = await openSolo(P, 'Colour Pour', 3);
  await expect(g.getByText('Level 2')).toBeVisible();
  await expect(P.page.getByRole('dialog', { name: 'How to play Colour Pour' })).toHaveCount(0);
  await g.getByRole('button', { name: 'Back' }).click();
  await expect(g).toHaveCount(0);
  expect(P.errors).toEqual([]);
});

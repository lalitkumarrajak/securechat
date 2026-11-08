// End-to-end: the puzzle games you play on your own: Car Out, Dot Link, Pipe Fix, Picture Cross.
// Each one is played through its real controls (drags and taps, with its hints) to the end of level 1;
// Next level shows level 2, and the level is kept when the game is opened again.
import { test, expect, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { openSolo, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('puz'));
  await signUp(P);
  await P.page.evaluate(() => localStorage.setItem('sanga-solo-howto', '["*"]')); // the guides are tested in solo.spec.ts
});
test.afterAll(async () => { await P?.ctx.close(); });

/** Drag the mouse from the middle of one box to the middle of another, through the points between. */
async function drag(from: { x: number; y: number }, ...to: { x: number; y: number }[]) {
  await P.page.mouse.move(from.x, from.y);
  await P.page.mouse.down();
  for (const p of to) await P.page.mouse.move(p.x, p.y, { steps: 4 });
  await P.page.mouse.up();
}
const middle = async (l: Locator) => { const b = (await l.boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

/** Next level shows level 2; Back, open it again: still level 2. */
async function nextAndKept(name: string, g: Locator, shot: string) {
  const done = g.getByRole('dialog', { name: 'Level 1 done!' });
  await expect(done).toBeVisible();
  await P.page.screenshot({ path: shots(`${shot}-done`) });
  await done.getByRole('button', { name: 'Next level' }).click();
  await expect(g.getByText('Level 2')).toBeVisible();
  await g.getByRole('button', { name: 'Back' }).click();
  await expect(g).toHaveCount(0);
  const again = await openSolo(P, name, 5);
  await expect(again.getByText('Level 2')).toBeVisible();
  await P.page.waitForTimeout(400);
  await P.page.screenshot({ path: shots(shot) });
  // nothing wider than the phone
  expect(await P.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await again.getByRole('button', { name: 'Back' }).click();
}

test('Car Out: drag a car, tap a car then a dot, undo, follow the hints out', async () => {
  const g = await openSolo(P, 'Car Out', 5);
  await expect(g.getByText('Level 1')).toBeVisible();
  const lot = g.getByRole('group', { name: 'Parking lot' });
  const status = g.getByRole('status');
  await expect(lot.getByRole('button', { name: 'Red car' })).toBeVisible();

  // a hint, followed by dragging the car to the marked spot
  await g.getByRole('button', { name: 'Hint' }).click();
  await expect(status).toHaveText('Slide the glowing car to the marked spot.');
  await drag(await middle(lot.locator('[data-hint-car]')), await middle(lot.locator('[data-hint-spot]')));
  await expect(g.getByText('Moves: 1')).toBeVisible();
  await g.getByRole('button', { name: 'Undo' }).click();
  await expect(g.getByText('Moves: 0')).toBeVisible();

  for (let i = 0; i < 30 && !(await status.textContent())!.startsWith('Out!'); i++) {
    await g.getByRole('button', { name: 'Hint' }).click();
    const car = lot.locator('[data-hint-car]');
    await car.click();
    await expect(car).toHaveAttribute('aria-pressed', 'true');
    await lot.locator('[data-hint-target]').click();
  }
  await expect(status).toHaveText('Out! Well driven.');
  await expect(g.getByRole('dialog', { name: 'Level 1 done!' })).toContainText(/Out in \d+ moves/);
  await nextAndKept('Car Out', g, '81-carout');
});

test('Dot Link: drag one path, tap another square by square, undo, the hints draw the rest', async () => {
  const g = await openSolo(P, 'Dot Link', 5);
  await expect(g.getByText('Level 1')).toBeVisible();
  const board = g.getByRole('group', { name: 'Board' });
  const sol: number[][] = JSON.parse((await board.getAttribute('data-solution'))!);
  const n = Math.round(Math.sqrt(sol.flat().length));
  expect(n).toBe(5);
  const cell = (x: number) => board.getByRole('button', { name: new RegExp(`^Row ${Math.floor(x / n) + 1}, column ${(x % n) + 1}:`) });
  const pts = await Promise.all(sol[0].map((x) => middle(cell(x))));

  await drag(pts[0], ...pts.slice(1));
  await expect(cell(sol[0][1])).not.toHaveAccessibleName(/empty/);
  await g.getByRole('button', { name: 'Undo' }).click();
  await expect(cell(sol[0][1])).toHaveAccessibleName(/empty/);
  await drag(pts[0], ...pts.slice(1));
  for (const x of sol[1]) await cell(x).click(); // the second colour, tap by tap
  await expect(cell(sol[1][1])).not.toHaveAccessibleName(/empty/);
  await expect(g.getByText(/Moves: 2/)).toBeVisible();

  const status = g.getByRole('status');
  for (let i = 0; i < sol.length && !(await status.textContent())!.startsWith('Every pair joined'); i++) {
    await g.getByRole('button', { name: 'Hint' }).click();
  }
  await expect(status).toHaveText('Every pair joined, every square filled!');
  await nextAndKept('Dot Link', g, '82-dotlink');
});

test('Pipe Fix: a hint turns a pipe, tapping turns the rest, the water reaches every pipe', async () => {
  const g = await openSolo(P, 'Pipe Fix', 5);
  await expect(g.getByText('Level 1')).toBeVisible();
  const pipes = g.getByRole('group', { name: 'Pipes' }).getByRole('button');
  await expect(pipes).toHaveCount(16);
  await g.getByRole('button', { name: 'Hint' }).click();
  await expect(g.getByRole('status')).toHaveText('That pipe is the right way round now.');
  await expect(g.getByText('Moves: 1')).toBeVisible();
  const need = await pipes.evaluateAll((bs) => bs.map((b) => Number(b.getAttribute('data-need'))));
  expect(need.some((k) => k > 0)).toBe(true);
  for (const [i, k] of need.entries()) for (let j = 0; j < k; j++) await pipes.nth(i).click();
  await expect(g.getByRole('status')).toHaveText('The water reaches every pipe!');
  await expect(pipes.first()).toHaveAccessibleName(/water reaches it/);
  await nextAndKept('Pipe Fix', g, '83-pipefix');
});

test('Picture Cross: mark ✕, drag along a row, tap the rest; the picture shows', async () => {
  const g = await openSolo(P, 'Picture Cross', 5);
  await expect(g.getByText('Level 1')).toBeVisible();
  const grid = g.getByRole('group', { name: 'Picture grid' });
  const sol = (await grid.getAttribute('data-solution'))!;
  expect(sol).toHaveLength(25);
  const cell = (i: number) => grid.getByRole('button', { name: new RegExp(`^Row ${Math.floor(i / 5) + 1}, column ${(i % 5) + 1}:`) });

  // an empty square marked ✕ in Mark mode
  const blank = sol.indexOf('0');
  await g.getByRole('button', { name: 'Mark' }).click();
  await cell(blank).click();
  await expect(cell(blank)).toHaveAccessibleName(/marked/);
  await g.getByRole('button', { name: 'Fill' }).click();
  await expect(g.getByRole('button', { name: 'Fill' })).toHaveAttribute('aria-pressed', 'true');

  // a full row in one drag, then the rest tap by tap
  const full = [0, 1, 2, 3, 4].find((r) => sol.slice(r * 5, r * 5 + 5) === '11111')!;
  await drag(await middle(cell(full * 5)), await middle(cell(full * 5 + 4)));
  for (let c = 0; c < 5; c++) await expect(cell(full * 5 + c)).toHaveAccessibleName(/filled/);
  for (let i = 0; i < 25; i++) if (sol[i] === '1' && Math.floor(i / 5) !== full) await cell(i).click();
  await expect(g.getByRole('status')).toHaveText('It’s a picture of: Heart!');
  await P.page.waitForTimeout(900); // the picture comes in colour
  await P.page.screenshot({ path: shots('84-nonogram-picture') });
  await nextAndKept('Picture Cross', g, '84-nonogram');
  expect(P.errors).toEqual([]);
});

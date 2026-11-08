// End-to-end: the card and casual games you play on your own, on a phone. Spider Solitaire: pick a
// level, move by tap and by drag, follow hints to a finished run, deal a row and undo it. Dungeon Deck:
// walk, pick things up, fight to the end. Monster Merge: summon, merge by tap and drag up to level 3,
// kept after a reload. Mix Lab: discoveries by tap, drag and hint, search, kept after a reload.
import { test, expect, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { openSolo, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('crd'));
  await signUp(P);
});
test.afterAll(async () => { await P?.ctx.close(); });

/** Drag with the mouse from the middle of one thing to the middle of another, in small steps. */
async function dragTo(from: Locator, to: Locator | { x: number; y: number }) {
  const a = (await from.boundingBox())!;
  const b = 'x' in to ? { x: to.x, y: to.y, width: 0, height: 0 } : (await to.boundingBox())!;
  const page = P.page;
  await page.mouse.move(a.x + a.width / 2, a.y + Math.min(10, a.height / 2));
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 5, a.y + 15, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('Spider Solitaire: move by tap and drag, follow hints to a full run, deal a row and undo it', async () => {
  const g = await openSolo(P, 'Spider Solitaire', 1);
  await g.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: /^Easy/ }).click();
  const status = g.getByRole('status');
  await expect(status).toContainText('Tap a card to move it');
  await expect(g.getByRole('button', { name: /^Deal a row \(5 left\)$/ })).toBeVisible();
  await P.page.waitForTimeout(700); // the deal settles
  await P.page.screenshot({ path: shots('80-spider') });

  // the first hinted move, by dragging the card onto its new column
  await g.getByRole('button', { name: 'Hint' }).click();
  const [, card, , b] = (await status.textContent())!.match(/Move the (.+) from column (\d+) to column (\d+)\./)!;
  const target = g.locator(`[data-col="${Number(b) - 1}"]`).last();
  await dragTo(g.locator('[data-hint="card"]'), target);
  await expect(g.getByRole('button', { name: `${card}, column ${b}` }).first()).toBeVisible();
  await expect(g.getByText('1 move')).toBeVisible();

  // then tap the hinted cards until a King-to-Ace run leaves the table, and deal once
  let dealt = false;
  for (let i = 0; i < 80 && !dealt; i++) {
    await g.getByRole('button', { name: 'Hint' }).click();
    const text = (await status.textContent())!;
    if (/Deal a row from the stock/.test(text)) {
      if (!(await g.getByRole('img', { name: /Runs done: [1-8]/ }).count())) { await g.getByRole('button', { name: /^Deal a row/ }).click(); continue; }
      const before = (await g.getByRole('button', { name: /^Deal a row/ }).getAttribute('aria-label'))!;
      await g.getByRole('button', { name: /^Deal a row/ }).click();
      const left = Number(before.match(/\((\d+) left/)![1]);
      await expect(g.getByRole('button', { name: `Deal a row (${left - 1} left)` })).toBeVisible();
      await P.page.screenshot({ path: shots('81-spider-dealt') });
      await g.getByRole('button', { name: 'Undo' }).click();
      await expect(g.getByRole('button', { name: `Deal a row (${left} left)` })).toBeVisible();
      dealt = true;
      break;
    }
    expect(text).toMatch(/^Move the /);
    await g.locator('[data-hint="card"]').click({ position: { x: 10, y: 6 } }); // its visible top edge: the cards below it overlap the rest
  }
  expect(dealt).toBe(true);
  await expect(g.getByRole('img', { name: 'Runs done: 1 of 8' })).toBeVisible();
  await P.page.screenshot({ path: shots('82-spider-run') });

  await g.getByRole('button', { name: 'Back' }).click();
});

test('Dungeon Deck: walk, pick things up, fight, and play until the game is over', async () => {
  const g = await openSolo(P, 'Dungeon Deck', 2);
  await expect(g.getByRole('img', { name: 'Health 10 of 10' })).toBeVisible();
  await expect(g.getByRole('img', { name: 'You: 10 health' })).toBeVisible();
  const grid = g.getByRole('group', { name: 'Dungeon' });
  await expect(grid.locator('button:not([disabled])')).toHaveCount(4); // you start in the middle: up, down, left, right
  const status = g.getByRole('status');
  const seen = new Set<string>();
  const over = g.getByRole('dialog', { name: 'Game over' });
  const order = (step: number) => (step < 6 ? ['gold', 'potion', 'weapon', 'chest', 'stairs', 'trap', 'monster'] : ['monster', 'trap', 'chest', 'gold', 'stairs', 'weapon', 'potion']);
  for (let step = 0; step < 300 && !(await over.isVisible()); step++) {
    const open = grid.locator('button:not([disabled])');
    const opts = await open.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kind!));
    const want = order(step).find((k) => opts.includes(k))!;
    await open.nth(opts.indexOf(want)).click();
    seen.add(want);
    if (want === 'monster' && !(await over.isVisible())) await expect(status).toContainText(/You beat the|chest/);
    if (step === 3) await P.page.screenshot({ path: shots('83-dungeon') });
  }
  await expect(over).toBeVisible();
  expect(seen.has('monster')).toBe(true);
  expect([...seen].filter((k) => k !== 'monster').length).toBeGreaterThan(0);
  await expect(g.getByRole('img', { name: 'Health 0 of 10' }).or(g.getByRole('img', { name: /^Health 0 of/ }))).toBeVisible();
  await P.page.screenshot({ path: shots('84-dungeon-over') });
  await over.getByRole('button', { name: 'Play again' }).click();
  await expect(g.getByRole('img', { name: 'Health 10 of 10' })).toBeVisible();
  await expect(g.getByText(/Best: [1-9]\d* gold/)).toBeVisible();
  await g.getByRole('button', { name: 'Back' }).click();
});

test('Monster Merge: summon eggs, merge by tap and by drag up to level 3, kept after a reload', async () => {
  const g = await openSolo(P, 'Monster Merge', 3);
  const status = g.getByRole('status');
  await expect(status).toContainText('Tap Summon to hatch an egg.');
  const summon = g.getByRole('button', { name: /^Summon an egg for \d+ coins$/ });
  for (let i = 0; i < 4; i++) await summon.click();
  const eggs = g.getByRole('button', { name: 'Egg, level 1' });
  await expect(eggs).toHaveCount(4);
  // tap one egg, then another
  await eggs.nth(0).click();
  await expect(eggs.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await eggs.nth(1).click();
  await expect(status).toContainText('New monster: Sprout, level 2!');
  await expect(eggs).toHaveCount(2);
  // drag the last two together
  await dragTo(eggs.nth(0), eggs.nth(1));
  await expect(eggs).toHaveCount(0);
  const sprouts = g.getByRole('button', { name: 'Sprout, level 2' });
  await expect(sprouts).toHaveCount(2);
  await expect(status).toContainText('Merged into Sprout, level 2.');
  await sprouts.nth(1).click();
  await sprouts.nth(0).click();
  await expect(status).toContainText('New monster: Bloop, level 3!');
  await expect(g.getByRole('button', { name: 'Bloop, level 3' })).toHaveCount(1);
  await P.page.screenshot({ path: shots('85-merge') });
  await g.getByRole('button', { name: /^Collection/ }).click();
  const book = g.getByRole('dialog', { name: 'Collection' });
  await expect(book).toContainText('3 of 12 found');
  await P.page.screenshot({ path: shots('86-merge-book') });
  await book.getByRole('button', { name: 'Close' }).click();

  await P.page.reload();
  const again = await openSolo(P, 'Monster Merge', 3);
  await expect(again.getByRole('button', { name: 'Bloop, level 3' })).toHaveCount(1);
  await expect(again.getByRole('button', { name: /^Collection/ })).toContainText('3/12');
  await again.getByRole('button', { name: 'Back' }).click();
});

test('Mix Lab: discover by tap, drag and hint; search; kept after a reload', async () => {
  const g = await openSolo(P, 'Mix Lab', 4);
  const status = g.getByRole('status');
  const item = (name: string) => g.getByRole('button', { name, exact: true });
  const total = Number((await g.getByText(/^4 of \d+ found$/).textContent())!.match(/of (\d+)/)![1]);
  expect(total).toBeGreaterThanOrEqual(80);

  await item('Water').click();
  await expect(status).toContainText('Water is in the bowl');
  await item('Fire').click();
  await expect(status).toHaveText('Water + Fire make Steam. New!');
  await item('Water').click();
  await item('Water').click();
  await expect(status).toHaveText('Water + Water make Sea. New!');
  await item('Steam').click();
  await item('Sea').click();
  await expect(status).toHaveText('Steam and Sea don’t mix. Try something else.');
  await item('Fire').click();
  await item('Water').click();
  await expect(status).toHaveText('Fire + Water make Steam. You have it already.');

  // by dragging onto the bowl (with a mouse)
  const bowl = g.getByRole('group', { name: 'Mixing bowl' });
  await dragTo(item('Earth'), bowl);
  await dragTo(item('Water'), bowl);
  await expect(status).toHaveText('Earth + Water make Mud. New!');

  // the hint shows a mix that works
  await g.getByRole('button', { name: 'Hint' }).click();
  const [, a, b] = (await status.textContent())!.match(/^Try (.+) \+ (.+)\.$/)!;
  await item(a).click();
  await item(b).click();
  await expect(status).toContainText('New!');
  await expect(g.getByText(`8 of ${total} found`)).toBeVisible();
  await P.page.screenshot({ path: shots('87-mixlab') });

  await g.getByRole('textbox', { name: 'Search' }).fill('ste');
  await expect(item('Steam')).toBeVisible();
  await expect(item('Water')).toHaveCount(0);
  await g.getByRole('button', { name: 'Clear search' }).click();
  await expect(item('Water')).toBeVisible();

  await P.page.reload();
  const again = await openSolo(P, 'Mix Lab', 4);
  await expect(again.getByText(`8 of ${total} found`)).toBeVisible();
  await expect(again.getByRole('button', { name: 'Mud', exact: true })).toBeVisible();
  await again.getByRole('button', { name: 'Back' }).click();
  expect(P.errors).toEqual([]);
});

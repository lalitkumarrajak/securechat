// End-to-end: the strategy and adventure games you play on your own, through the real UI. The page clock
// is faked (time still flows) so the simulations can be fast-forwarded by minutes at once.
// Metro Lines: draw a line by dragging, trains deliver people, a crowded station ends it.
// Tower Guard: build, clear waves, upgrade and sell, then lose the map.
// Escape Room: escape the study, reach the kitchen, and find it still there after reopening.
import { test, expect, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { openSolo, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('str'));
  await P.page.clock.install();
  await signUp(P);
});
test.afterAll(async () => { await P?.ctx.close(); });

const state = (g: Locator) => g.locator('[data-state]').first();
const num = async (g: Locator, attr: string) => Number(await state(g).getAttribute(attr));

/** Where a station is on screen (its centre, from its place on the map). */
const stationAt = (g: Locator, n: number) => g.getByRole('button', { name: new RegExp(`^Station ${n},`) }).evaluate((el) => {
  const svg = (el as SVGGElement).ownerSVGElement!, p = svg.createSVGPoint();
  p.x = Number(el.getAttribute('data-x')); p.y = Number(el.getAttribute('data-y'));
  const q = p.matrixTransform(svg.getScreenCTM()!);
  return { x: q.x, y: q.y };
});

test('Metro Lines: drag a line through the stations, trains deliver, a crowded station ends the game', async () => {
  const g = await openSolo(P, 'Metro Lines', 4);
  await g.getByRole('dialog', { name: 'Build a metro' }).getByRole('button', { name: 'Play' }).click();
  await expect(state(g)).toHaveAttribute('data-state', 'play');
  await expect(g.getByRole('status')).toHaveText('Drag from one station to another to build a line.');

  const [a, b, c] = [await stationAt(g, 1), await stationAt(g, 2), await stationAt(g, 3)];
  await P.page.mouse.move(a.x, a.y);
  await P.page.mouse.down();
  await P.page.mouse.move(b.x, b.y, { steps: 8 });
  await P.page.mouse.move(c.x, c.y, { steps: 8 });
  await P.page.mouse.up();
  await expect(g.getByRole('button', { name: 'The red line', exact: true })).toBeVisible();
  await expect(g.getByRole('button', { name: 'End of the red line' })).toHaveCount(2);

  // trains carry people home
  for (let i = 0; i < 6 && (await num(g, 'data-score')) === 0; i++) await P.page.clock.fastForward(10_000);
  expect(await num(g, 'data-score')).toBeGreaterThan(0);
  await P.page.screenshot({ path: shots('80-metro') });

  // a line can be picked: add a train if there is one
  await g.getByRole('button', { name: 'The red line', exact: true }).click();
  await expect(g.getByRole('button', { name: 'Remove line' })).toBeVisible();
  await g.getByRole('button', { name: 'Add a train' }).click();
  await g.getByRole('button', { name: 'The red line', exact: true }).click();

  // left alone, new stations crowd up and the game ends; each week offers a gift
  let weeks = 0;
  for (let i = 0; i < 40 && (await state(g).getAttribute('data-state')) !== 'over'; i++) {
    await P.page.clock.fastForward(20_000);
    const week = g.getByRole('dialog', { name: /^Week \d+ done!$/ });
    if (await week.isVisible()) {
      if (!weeks++) { await P.page.waitForTimeout(400); await P.page.screenshot({ path: shots('83-metro-week') }); }
      await week.getByRole('button', { name: /New train/ }).click();
    }
  }
  const over = g.getByRole('dialog', { name: 'Game over' });
  await expect(over).toBeVisible();
  await expect(over).toContainText(/passengers? delivered/);
  expect(weeks).toBeGreaterThan(0);
  await P.page.waitForTimeout(400); // the card fades in
  await P.page.screenshot({ path: shots('83-metro-over') });
  await over.getByRole('button', { name: 'Play again' }).click();
  await expect(state(g)).toHaveAttribute('data-state', 'play');
  await expect(state(g)).toHaveAttribute('data-score', '0');
  await g.getByRole('button', { name: 'Back' }).click();
  await expect(g).toHaveCount(0);
});

test('Tower Guard: build towers, clear the first waves, upgrade and sell, then lose the map', async () => {
  const g = await openSolo(P, 'Tower Guard');
  await expect(g.getByRole('button', { name: 'Canyon' })).toBeDisabled(); // locked until Meadow is cleared
  await g.getByRole('button', { name: 'Meadow' }).click();
  await expect(state(g)).toHaveAttribute('data-state', 'build');
  await expect(state(g)).toHaveAttribute('data-coins', '90');

  const buildAt = async (spot: number, tower: string) => {
    await g.getByRole('button', { name: `Build spot ${spot}`, exact: true }).click();
    await g.getByRole('button', { name: tower }).click();
  };
  await buildAt(15, 'Build Dart for 20 coins');
  await buildAt(27, 'Build Dart for 20 coins');
  await g.getByRole('button', { name: 'Build spot 22', exact: true }).click();
  await g.getByRole('button', { name: 'Build Cannon for 35 coins' }).click();
  await expect(state(g)).toHaveAttribute('data-coins', '15');
  await expect(g.getByRole('button', { name: /^Dart tower, level 1$/ })).toHaveCount(2);

  for (const w of [1, 2]) {
    await g.getByRole('button', { name: `Start wave ${w}` }).click();
    await expect(state(g)).toHaveAttribute('data-state', 'wave');
    if (w === 1) { await P.page.clock.fastForward(4_000); await P.page.screenshot({ path: shots('81-towers') }); }
    await P.page.clock.fastForward(60_000);
    await expect(state(g)).toHaveAttribute('data-state', 'build');
    await expect(state(g)).toHaveAttribute('data-wave', String(w));
    await expect(state(g)).toHaveAttribute('data-lives', '20');
  }
  expect(await num(g, 'data-coins')).toBeGreaterThan(15);

  // upgrade one Dart, sell the other
  await g.getByRole('button', { name: 'Dart tower, level 1' }).first().click();
  await g.getByRole('button', { name: 'Upgrade for 15 coins' }).click();
  await expect(g.getByRole('button', { name: 'Dart tower, level 2' })).toBeVisible();
  await g.getByRole('button', { name: 'Close' }).click();
  await g.getByRole('button', { name: 'Dart tower, level 1' }).click();
  await g.getByRole('button', { name: 'Sell for 14 coins' }).click();
  await expect(g.getByRole('button', { name: 'Build spot 27', exact: true })).toBeVisible();

  // without more towers, later waves break through
  for (let w = 3; w <= 12 && (await state(g).getAttribute('data-state')) === 'build'; w++) {
    await g.getByRole('button', { name: `Start wave ${w}` }).click();
    await P.page.clock.fastForward(150_000);
    await expect(state(g)).not.toHaveAttribute('data-state', 'wave');
  }
  const over = g.getByRole('dialog', { name: 'Game over' });
  await expect(over).toBeVisible();
  await expect(state(g)).toHaveAttribute('data-lives', '0');
  await P.page.waitForTimeout(400);
  await P.page.screenshot({ path: shots('84-towers-over') });
  await over.getByRole('button', { name: 'Maps' }).click();
  await expect(g.getByRole('button', { name: 'Meadow' })).toBeVisible();
  await g.getByRole('button', { name: 'Back' }).click();
  await expect(g).toHaveCount(0);
});

test('Escape Room: find, use and combine items, crack the door code, reach the kitchen; it is kept', async () => {
  let g = await openSolo(P, 'Escape Room');
  await g.getByRole('dialog', { name: 'Locked in!' }).getByRole('button', { name: 'Play' }).click();
  await expect(g.getByText('Room 1 of 3 · Study')).toBeVisible();
  const status = g.getByRole('status');
  const bag = g.getByRole('group', { name: 'Your bag' });
  const spot = (name: string) => g.getByRole('group', { name: 'Study' }).getByRole('button', { name, exact: true });
  const item = (name: string) => bag.getByRole('button', { name, exact: true });

  await g.getByRole('button', { name: 'Hint' }).click();
  await expect(status).toHaveText('Something might be hidden under the rug.');
  await spot('Desk drawer').click();
  await expect(status).toContainText('The drawer is locked');
  await spot('Rug').click();
  await expect(item('Small key')).toBeVisible();
  // the key doesn't open the door
  await item('Small key').click();
  await expect(item('Small key')).toHaveAttribute('aria-pressed', 'true');
  await spot('Door').click();
  await expect(status).toHaveText('That doesn’t work here.');
  await spot('Desk drawer').click();
  await expect(status).toContainText('a torch with no batteries');
  await expect(item('Small key')).toHaveCount(0);
  await spot('Clock').click();
  await item('Torch with no batteries').click();
  await item('Batteries').click();
  await expect(status).toContainText('The torch works!');
  await item('Torch').click();
  await spot('Bookshelf').click();
  await expect(status).toContainText('The painter’s year, backwards');
  await spot('Painting').click();
  await expect(status).toContainText('1874');
  await P.page.screenshot({ path: shots('82-escape') });

  await spot('Door').click();
  const pad = g.getByRole('dialog', { name: 'Keypad' });
  for (const d of '1874') await pad.getByRole('button', { name: d, exact: true }).click();
  await expect(status).toHaveText('Wrong code. Nothing happens.');
  for (const d of '4781') await pad.getByRole('button', { name: d, exact: true }).click();
  const done = g.getByRole('dialog', { name: 'Room 1 escaped!' });
  await expect(done).toBeVisible();
  await done.getByRole('button', { name: 'Next room' }).click();
  await expect(g.getByText('Room 2 of 3 · Kitchen')).toBeVisible();
  await g.getByRole('group', { name: 'Kitchen' }).getByRole('button', { name: 'Fridge' }).click();
  await expect(bag.getByRole('button', { name: 'Block of ice' })).toBeVisible();
  await P.page.screenshot({ path: shots('85-escape-kitchen') });

  // closed and opened again: still in the kitchen, ice in the bag
  await g.getByRole('button', { name: 'Back' }).click();
  await expect(g).toHaveCount(0);
  g = await openSolo(P, 'Escape Room');
  await expect(g.getByText('Room 2 of 3 · Kitchen')).toBeVisible();
  await expect(g.getByRole('group', { name: 'Your bag' }).getByRole('button', { name: 'Block of ice' })).toBeVisible();
  await g.getByRole('button', { name: 'Back' }).click();
  expect(P.errors).toEqual([]);
});

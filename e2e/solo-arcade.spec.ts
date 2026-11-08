// End-to-end: the arcade games you play on your own — Stack Up, Flip It, Dart Spin. The page's clock
// is faked and stepped frame by frame, so each tap lands at a known moment: the games put what a
// test needs on their play area (data-*) in test mode. Each game: start, score through real taps,
// lose on purpose, the game-over card shows the score, the best is kept, Play again starts at 0.
import { test, expect, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { openSolo, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('arc'));
  await signUp(P);
  await P.page.clock.install(); // runs as usual until paused
});
test.afterAll(async () => { await P?.ctx.close(); });

type Data = Record<string, string>;
const read = (app: Locator) => app.evaluate((el) => ({ ...(el as HTMLElement).dataset }) as Record<string, string>);
const pause = async () => P.page.clock.pauseAt(await P.page.evaluate(() => Date.now() + 500));
const frames = (n = 1) => P.page.clock.runFor(16 * n);
/** Step the clock a frame at a time (or a jump, when `skip` says how far is safe) until `ok`. */
async function stepUntil(app: Locator, ok: (d: Data) => boolean, skip: (d: Data) => number = () => 0, max = 1500) {
  for (let i = 0; i < max; i++) {
    const d = await read(app);
    if (ok(d)) return d;
    const ms = skip(d);
    await P.page.clock.runFor(ms > 32 ? Math.floor(ms / 16) * 16 : 16);
  }
  throw new Error('never got there: ' + JSON.stringify(await read(app)));
}
async function centre(app: Locator) {
  const b = (await app.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const tap = async (app: Locator) => { const c = await centre(app); await P.page.mouse.click(c.x, c.y); };

/** After losing: the card, the best kept after reopening, and Play again from 0. */
async function overAndAgain(g: Locator, app: Locator, name: string, id: string, score: number) {
  await expect(app).toHaveAttribute('data-state', 'over');
  const card = g.getByRole('dialog', { name: 'Game over' });
  await expect(card).toContainText(`Score ${score}`);
  await expect(card).toContainText('New best!');
  await P.page.waitForTimeout(300); // the card fades in
  await P.page.screenshot({ path: shots(`8x-${id}-over`) });
  await card.getByRole('button', { name: 'Play again' }).click();
  await expect(card).toHaveCount(0);
  await frames(2);
  await expect(app).toHaveAttribute('data-score', '0');
  await expect(app).not.toHaveAttribute('data-state', 'over');
  await P.page.clock.resume();
  await g.getByRole('button', { name: 'Back' }).click();
  await expect(g).toHaveCount(0);
  const again = await openSolo(P, name, 5);
  await expect(again.getByText(`Best ${score}`, { exact: true })).toBeVisible();
  await again.getByRole('button', { name: 'Back' }).click();
  await expect(again).toHaveCount(0);
}

test('Stack Up: drop blocks exactly to build, miss to lose', async () => {
  const g = await openSolo(P, 'Stack Up', 5);
  const app = g.getByRole('application', { name: 'Stack Up' });
  await expect(app).toHaveAttribute('data-state', 'ready');
  await expect(g.getByText('Tap to start')).toBeVisible();
  await pause();
  await tap(app);
  await frames(2);
  await expect(app).toHaveAttribute('data-state', 'play');
  // towards the middle: jump most of the way, then frame by frame
  const toMiddle = (d: Data) => { const dx = Number(d.dx), v = Number(d.v); return Math.sign(dx) !== Math.sign(v) ? ((Math.abs(dx) - 8) / Math.abs(v)) * 1000 : 0; };
  for (let i = 1; i <= 3; i++) {
    await stepUntil(app, (d) => d.state === 'play' && Math.abs(Number(d.dx)) < 2.5, toMiddle);
    await tap(app);
    await frames(1);
    await expect(app).toHaveAttribute('data-score', String(i));
    expect(Number((await read(app)).w)).toBe(180); // perfect: nothing cut
  }
  await frames(30);
  await P.page.screenshot({ path: shots('8x-stack') });
  // wait for it to slide clear of the tower, then drop it
  await stepUntil(app, (d) => Math.abs(Number(d.dx)) > Number(d.w) + 2);
  await tap(app);
  await frames(70);
  await overAndAgain(g, app, 'Stack Up', 'stack', 3);
  expect(P.errors).toEqual([]);
});

test('Flip It: hold just long enough to land upright, tap short to drop it', async () => {
  const g = await openSolo(P, 'Flip It', 5);
  const app = g.getByRole('application', { name: 'Flip It' });
  await expect(app).toHaveAttribute('data-state', 'ready');
  await pause();
  await tap(app);
  await frames(3);
  await expect(app).toHaveAttribute('data-state', 'aim');
  const c = await centre(app);
  await P.page.mouse.move(c.x, c.y);
  let score = 0;
  while (score < 3) {
    const d = await stepUntil(app, (x) => x.state === 'aim');
    await P.page.mouse.down();
    await P.page.clock.runFor(Number(d.hold) - 16);
    await frames(1);
    if (score === 0) await P.page.screenshot({ path: shots('8x-bottleflip-charge') });
    await P.page.mouse.up();
    await frames(1);
    await expect(app).toHaveAttribute('data-state', 'fly');
    await stepUntil(app, (x) => x.state !== 'fly');
    const now = Number((await read(app)).score);
    expect(now).toBeGreaterThan(score); // landed
    score = now;
  }
  await stepUntil(app, (x) => x.state === 'aim');
  await frames(30);
  await P.page.screenshot({ path: shots('8x-bottleflip') });
  // a tap: barely any power, the bottle drops off its own table
  await P.page.mouse.down();
  await frames(1);
  await P.page.mouse.up();
  await stepUntil(app, (x) => x.state === 'over', undefined, 300);
  await overAndAgain(g, app, 'Flip It', 'bottleflip', score);
  expect(P.errors).toEqual([]);
});

test('Dart Spin: throw into the gaps, then into a dart', async () => {
  const g = await openSolo(P, 'Dart Spin', 5);
  const app = g.getByRole('application', { name: 'Dart Spin' });
  await expect(app).toHaveAttribute('data-state', 'ready');
  await expect(g.getByText('Stage 1', { exact: true })).toBeVisible();
  await pause();
  await tap(app);
  await frames(2);
  for (let i = 1; i <= 3; i++) {
    await stepUntil(app, (d) => d.state === 'play' && d.safe === '1');
    await tap(app);
    await frames(12);
    expect(Number((await read(app)).score)).toBeGreaterThanOrEqual(i);
    await frames(10);
  }
  const d = await read(app);
  expect(d.left).toBe('3'); // of 6 on the first wheel
  await P.page.screenshot({ path: shots('8x-dartspin') });
  const score = Number(d.score);
  await stepUntil(app, (x) => x.state === 'play' && x.safe === '0');
  await tap(app);
  await frames(80);
  await overAndAgain(g, app, 'Dart Spin', 'dartspin', score);
  expect(P.errors).toEqual([]);
});

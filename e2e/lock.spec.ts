// End-to-end: app lock with a PIN.
import { test, expect } from '@playwright/test';
import { phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const lockScreen = (p: Phone) => p.page.getByRole('dialog', { name: 'Chattrix is locked' });
const tapPin = async (p: Phone, pin: string) => { for (const d of pin) await lockScreen(p).getByRole('button', { name: d, exact: true }).click(); };

test.beforeAll(async ({ browser }) => { P = await phone(browser, uname('lock')); });
test.afterAll(async () => { await P?.ctx.close(); });

test('turn on app lock with a PIN', async () => {
  await signUp(P);
  await P.page.getByRole('button', { name: 'Profile and settings' }).click();
  await P.page.getByRole('button', { name: /^Privacy/ }).click();
  await P.page.getByRole('switch', { name: 'Lock with a PIN' }).click();
  const pin = P.page.getByLabel('PIN', { exact: true });
  await pin.fill('1234');
  await P.page.getByRole('button', { name: 'Next' }).click();
  await expect(P.page.getByText(/Too easy to guess/)).toBeVisible();
  await pin.fill('2580');
  await P.page.getByRole('button', { name: 'Next' }).click();
  await pin.fill('2580');
  await P.page.getByRole('button', { name: 'Done' }).click();
  await expect(P.page.getByText('App lock on').first()).toBeVisible();
  await expect(P.page.getByRole('radio', { name: 'Immediately' })).toHaveAttribute('aria-checked', 'true');
  await P.page.keyboard.press('Escape');
});

test('Lock hides everything; a wrong PIN is refused, the right one unlocks', async () => {
  await P.page.getByRole('button', { name: 'Lock Chattrix' }).click();
  await expect(lockScreen(P)).toBeVisible();
  await expect(P.page.getByRole('heading', { level: 1, name: P.u })).toHaveCount(0); // the app isn't on the page
  await tapPin(P, '1111');
  await expect(lockScreen(P).getByRole('alert')).toHaveText('Wrong PIN');
  await P.page.screenshot({ path: shots('32-lock-screen') });
  await tapPin(P, '2580');
  await expect(lockScreen(P)).toHaveCount(0);
  await expect(P.page.getByRole('heading', { level: 1, name: P.u })).toBeVisible();
});

test('locked again after a reload; typing the PIN works too', async () => {
  await P.page.reload();
  await expect(lockScreen(P)).toBeVisible();
  await P.page.keyboard.type('2580');
  await expect(P.page.getByRole('heading', { level: 1, name: P.u })).toBeVisible();
});

test('5 wrong PINs mean a wait', async () => {
  await P.page.getByRole('button', { name: 'Lock Chattrix' }).click();
  for (let i = 0; i < 5; i++) { await tapPin(P, '0000'); await P.page.waitForTimeout(150); }
  await expect(lockScreen(P).getByRole('alert')).toContainText('Try again in');
  await expect(lockScreen(P).getByRole('button', { name: '1', exact: true })).toBeDisabled();
  // (the wait is 30 s; skip it by clearing the counter the way an expired wait would)
  await P.page.evaluate(() => { localStorage.removeItem('chattrix-lock-until'); });
  await P.page.reload();
  await tapPin(P, '2580');
  await expect(P.page.getByRole('heading', { level: 1, name: P.u })).toBeVisible();
});

test('turning it off needs the PIN', async () => {
  await P.page.getByRole('button', { name: 'Profile and settings' }).click();
  await P.page.getByRole('button', { name: /^Privacy/ }).click();
  await P.page.getByRole('switch', { name: 'Lock with a PIN' }).click();
  await P.page.getByLabel('PIN', { exact: true }).fill('9999');
  await P.page.getByRole('button', { name: 'Done' }).click();
  await expect(P.page.getByText('Wrong PIN')).toBeVisible();
  await P.page.getByLabel('PIN', { exact: true }).fill('2580');
  await P.page.getByRole('button', { name: 'Done' }).click();
  await expect(P.page.getByText('App lock off').first()).toBeVisible();
  await P.page.keyboard.press('Escape');
  await expect(P.page.getByRole('button', { name: 'Lock Chattrix' })).toHaveCount(0);
  expect(P.errors).toEqual([]);
});

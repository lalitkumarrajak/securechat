// Sign-up says what's wrong under each field, and whether the username is free while it's typed.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { openAuth, openChats, phone, signUp, uname, PASSWORD } from './helpers';

test('sign-up explains each problem under its field, and checks the username while it is typed', async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  const taken = await phone(browser, uname('sutaken'));
  await signUp(taken);
  const p = await phone(browser, uname('sunew'));
  await p.page.goto('/');
  await openAuth(p.page, 'Create account');
  const form = p.page.getByRole('tabpanel');
  const user = form.getByLabel('Username');

  // A taken username: said while typing, without leaving the field.
  await user.fill(taken.u);
  await expect(form.getByText('This username is taken. Try another one.')).toBeVisible();
  await expect(user).toHaveAttribute('aria-invalid', 'true');

  // Capitals become small letters; other characters are named.
  await user.fill('');
  await user.pressSequentially('Ab');
  await expect(user).toHaveValue('ab');
  await user.fill('ab-c!');
  await user.blur();
  await expect(form.getByText('A username can only have small letters a–z, numbers 0–9, _ and . (not - !).')).toBeVisible();
  await user.fill('ab');
  await expect(form.getByText('Too short: a username needs at least 3 characters.')).toBeVisible();

  // A free one.
  await user.fill(p.u);
  await expect(form.getByText(`${p.u} is available.`)).toBeVisible();

  // Pressing the button with the rest wrong: each field says why, and the first wrong one gets focus.
  await form.getByLabel('Password', { exact: true }).fill('short');
  await form.getByLabel('Confirm password').fill('shorter');
  await form.getByRole('button', { name: 'Create account' }).click();
  await expect(form.getByText('Too short: use at least 8 characters (3 more).')).toBeVisible();
  await expect(form.getByText('The passwords don’t match.')).toBeVisible();
  await expect(form.getByLabel('Password', { exact: true })).toBeFocused();
  await expect(form.getByLabel('Confirm password')).toHaveAttribute('aria-invalid', 'true');
  await p.page.screenshot({ path: 'e2e/.artifacts/screens/signup-checks.png' });

  // Fixed: the messages go and the account is made.
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await form.getByLabel('Confirm password').fill(PASSWORD);
  await expect(form.getByText('The passwords match.')).toBeVisible();
  await form.getByRole('button', { name: 'Create account' }).click();
  await openChats(p);
  for (const x of [taken, p]) await x.ctx.close();
});

// A chat's "Media, links and docs" in the contact info: the latest photos, then everything in tabs.
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { makeFriends, openFriends, phone, signUp, testPdf, testPng, uname } from './helpers';

const shots = process.env.DRIVE_SHOTS;

test('contact info shows the chat’s photos, documents and links, like WhatsApp', async ({ browser }) => {
  const a = await phone(browser, uname('mda'));
  const b = await phone(browser, uname('mdb'));
  await signUp(a); await signUp(b);
  await makeFriends(a, b);
  await openFriends(a);
  await a.page.getByRole('tab', { name: 'Friends' }).click();
  await a.page.getByRole('button', { name: `Message ${b.u}` }).click();
  const page = a.page;

  // Two photos, a document and a link.
  for (const [i, w] of [[1, 400], [2, 300]] as const) {
    await page.locator('input[data-kind="gallery"]').setInputFiles({ name: `p${i}.png`, mimeType: 'image/png', buffer: testPng(w, 300) });
    await page.getByRole('button', { name: 'Send photo' }).click();
  }
  await page.locator('input[data-kind="document"]').setInputFiles({ name: 'Tickets.pdf', mimeType: 'application/pdf', buffer: testPdf() });
  await expect(page.locator('[data-k]').filter({ hasText: 'Tickets.pdf' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('textbox', { name: 'Message' }).fill('Hotel: https://example.com/hotel');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('[data-k]').filter({ hasText: 'example.com/hotel' })).toBeVisible();

  // Contact info: the row with how many, and the latest photos.
  await page.getByRole('button', { name: 'Chat options' }).click();
  await page.getByRole('menuitem', { name: 'Contact info' }).click();
  const info = page.getByRole('dialog', { name: 'Contact info' });
  const row = info.getByRole('button', { name: /Media, links and docs/ });
  await expect(row).toContainText('4');
  await expect(info.getByRole('button', { name: 'Photo', exact: true })).toHaveCount(2);
  if (shots) await page.screenshot({ path: path.join(shots, 'contact-media-row.png') });

  // All of it, in tabs.
  await row.click();
  await expect(info.getByRole('tab', { name: 'Media' })).toHaveAttribute('aria-selected', 'true');
  await expect(info.getByText('This week')).toBeVisible();
  await expect(info.locator('li img')).toHaveCount(2);
  if (shots) await page.screenshot({ path: path.join(shots, 'contact-media-grid.png') });
  await info.getByRole('tab', { name: 'Docs' }).click();
  await expect(info.getByText('Tickets.pdf')).toBeVisible();
  await info.getByRole('tab', { name: 'Links' }).click();
  await expect(info.getByRole('link', { name: /example\.com\/hotel/ })).toHaveAttribute('href', 'https://example.com/hotel');
  if (shots) await page.screenshot({ path: path.join(shots, 'contact-media-links.png') });

  // A photo opens full screen.
  await info.getByRole('tab', { name: 'Media' }).click();
  await info.getByRole('button', { name: 'Photo', exact: true }).first().click();
  await expect(page.getByText(/1 of 2|2 of 2/)).toBeVisible();

  expect(a.errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await a.ctx.close(); await b.ctx.close();
});

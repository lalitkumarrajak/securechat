// A story's song from your Drive: search the songs kept there, pick one, choose which 20 seconds.
import { expect, test } from '@playwright/test';
import { openApp, phone, signUp, testWav, uname } from './helpers';

test('a story song from Drive, with the part chosen', async ({ browser }) => {
  const a = await phone(browser, uname('sgd'));
  await signUp(a);
  const page = a.page;

  // Two songs in Drive.
  await openApp(a, 'Drive');
  await page.locator('input[type=file]:not([webkitdirectory])').setInputFiles([
    { name: 'Monsoon_evening.wav', mimeType: 'audio/wav', buffer: testWav(60, 8000) },
    { name: 'Morning raga.wav', mimeType: 'audio/wav', buffer: testWav(10, 8000) },
  ]);
  await expect(page.getByRole('button', { name: 'Monsoon_evening.wav', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Morning raga.wav', exact: true })).toBeVisible({ timeout: 30_000 });

  // A new story: Add song → From my Drive → search → pick.
  const tab = page.getByRole('tab', { name: /Chats$/ });
  await tab.click();
  await page.getByRole('region', { name: 'Stories' }).getByRole('button', { name: 'New story' }).click();
  const c = page.getByRole('dialog', { name: 'New story' });
  await c.getByRole('button', { name: /Text/ }).click();
  await c.getByLabel('Story text').fill('Rainy day');
  await c.getByRole('button', { name: 'Add song' }).click();
  await page.getByRole('dialog', { name: 'Add a song' }).getByRole('button', { name: /From my Drive/ }).click();
  const list = page.getByRole('dialog', { name: 'Songs in your Drive' });
  await expect(list.getByRole('button', { name: /Use .*\.wav/ })).toHaveCount(2, { timeout: 20_000 });
  await list.getByLabel('Search your Drive’s songs').fill('monsoon');
  await expect(list.getByRole('button', { name: /Use .*\.wav/ })).toHaveCount(1);
  await list.getByRole('button', { name: 'Use Monsoon_evening.wav' }).click();

  // The part: 0:30 – 0:50 of the minute.
  const part = page.getByRole('dialog', { name: 'Choose the part' });
  await expect(part.getByText('Monsoon evening')).toBeVisible({ timeout: 20_000 });
  await expect(part.getByText('0:00 – 0:20')).toBeVisible();
  await part.getByLabel('Start of the part').fill('30');
  await expect(part.getByText('0:30 – 0:50')).toBeVisible();
  await part.getByRole('button', { name: 'Play this part' }).click();
  await expect(part.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.screenshot({ path: 'e2e/.artifacts/screens/77-song-part.png' });
  await part.getByRole('button', { name: 'Use this part' }).click();
  await expect(c.getByRole('button', { name: /Song: Monsoon evening/ })).toBeVisible();
  await c.getByRole('button', { name: 'Share story' }).click();
  await expect(page.getByText('Story shared')).toBeVisible();

  expect(a.errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  await a.ctx.close();
});

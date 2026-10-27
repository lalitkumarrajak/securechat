// End-to-end: stories. A text story shared with one friend and tagging them, a photo story for all
// friends; friends see, like and comment; the owner sees who viewed, liked and what they said.
import { test, expect } from '@playwright/test';
import { makeFriends, phone, signUp, testPng, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let P: Phone, Q: Phone, R: Phone;
const strip = (p: Phone) => p.page.getByRole('list', { name: 'Stories' });
const viewer = (p: Phone) => p.page.getByRole('dialog', { name: 'Stories' });
const composer = (p: Phone) => p.page.getByRole('dialog', { name: 'New story' });

test.beforeAll(async ({ browser }) => {
  [P, Q, R] = await Promise.all([phone(browser, uname('poster')), phone(browser, uname('watcher')), phone(browser, uname('other'))]);
});
test.afterAll(async () => { for (const p of [P, Q, R]) await p?.ctx.close(); });

test('set up: P is friends with Q and R', async () => {
  await Promise.all([signUp(P), signUp(Q), signUp(R)]);
  await makeFriends(P, Q);
  await makeFriends(P, R);
});

test('a text story, shared only with Q and tagging them', async () => {
  await strip(P).getByRole('button', { name: 'New story' }).click();
  const c = composer(P);
  await c.getByRole('button', { name: /Text/ }).click();
  await c.getByLabel('Story text').fill('Guess where I am 🌴');
  await c.getByRole('button', { name: 'Change colour' }).click();

  await c.getByRole('button', { name: 'Tag friends' }).click();
  await c.getByRole('button', { name: new RegExp(Q.u) }).click();
  await c.getByRole('button', { name: 'Done' }).click();
  await expect(c.getByText(`with ${Q.u}`)).toBeVisible();

  await c.getByRole('button', { name: 'All friends' }).click();
  await c.getByRole('radio', { name: /Only share with/ }).click();
  await c.getByRole('button', { name: new RegExp(Q.u) }).click();
  await c.getByRole('button', { name: 'Done' }).click();
  await c.getByRole('button', { name: 'Share story' }).click();
  await expect(P.page.getByText('Story shared')).toBeVisible();

  // Q is told they were tagged; R never sees it.
  await expect(Q.page.getByText(`${P.u} tagged you in their story`)).toBeVisible();
  await expect(strip(Q).getByRole('button', { name: `${P.u}’s story, new` })).toBeVisible();
  await R.page.reload();
  await expect(strip(R).getByRole('button', { name: 'New story' })).toBeVisible();
  await expect(strip(R).getByRole('button', { name: new RegExp(P.u) })).toHaveCount(0);
});

test('a photo story for all friends', async () => {
  await strip(P).getByRole('button', { name: 'New story' }).click();
  const c = composer(P);
  const chooser = P.page.waitForEvent('filechooser');
  await c.getByRole('button', { name: /Photo/ }).click();
  await (await chooser).setFiles({ name: 'beach.png', mimeType: 'image/png', buffer: testPng(600, 800) });
  await expect(c.getByRole('img', { name: 'Your photo' })).toBeVisible();
  await c.getByLabel('Caption').fill('Sunset at the beach');
  await c.getByRole('button', { name: 'Share story' }).click();
  await expect(P.page.getByText('Story shared')).toBeVisible();
  await expect(strip(R).getByRole('button', { name: `${P.u}’s story, new` })).toBeVisible();
});

test('Q watches both, likes one and comments', async () => {
  await strip(Q).getByRole('button', { name: `${P.u}’s story, new` }).click();
  const v = viewer(Q);
  await v.getByRole('button', { name: 'Pause' }).click();
  await expect(v.getByText('Guess where I am 🌴')).toBeVisible();
  await expect(v.getByRole('button', { name: 'you', exact: true })).toBeVisible(); // tagged
  await expect(v.getByRole('button', { name: 'Add to your story' })).toBeVisible();
  await v.getByRole('button', { name: 'Like' }).click();
  await expect(v.getByRole('button', { name: 'Unlike' })).toHaveAttribute('aria-pressed', 'true');
  await expect(P.page.getByText(`❤️ ${Q.u} liked your story`)).toBeVisible();

  await v.getByLabel('Comment').fill('Goa? 😍');
  await v.getByRole('button', { name: 'Send comment' }).click();
  await expect(Q.page.getByText(`Comment sent to ${P.u}`)).toBeVisible();
  await expect(P.page.getByText(`${Q.u} commented on your story`)).toBeVisible();

  await v.getByTestId('story').click({ position: { x: 300, y: 300 } }); // tap right: the next one
  await expect(v.getByRole('img', { name: 'Sunset at the beach' })).toBeVisible();
  await expect(v.getByText('Sunset at the beach')).toBeVisible();
  await v.getByRole('button', { name: 'Close stories' }).click();
  await expect(strip(Q).getByRole('button', { name: `${P.u}’s story` , exact: true })).toBeVisible(); // seen now: no "new"
  expect(Q.errors).toEqual([]);
});

test('P sees who viewed, who liked and the comment', async () => {
  await strip(P).getByRole('button', { name: 'Your story' }).click();
  const v = viewer(P);
  await v.getByRole('button', { name: 'Pause' }).click();
  await expect(v.getByText('Guess where I am 🌴')).toBeVisible();
  await v.getByRole('button', { name: 'Viewers, likes and comments' }).click();
  const sheet = P.page.getByRole('dialog', { name: 'Story activity' });
  await expect(sheet.getByText('Viewed by 1')).toBeVisible();
  await expect(sheet.getByRole('listitem').filter({ hasText: Q.u }).getByLabel('Liked')).toBeVisible();
  await expect(sheet.getByText('Goa? 😍')).toBeVisible();
  await P.page.keyboard.press('Escape');
});

test('P deletes a story; it disappears for Q', async () => {
  const v = viewer(P);
  await v.getByRole('button', { name: 'Story options' }).click();
  await P.page.getByRole('menuitem', { name: 'Delete story' }).click();
  await P.page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(P.page.getByText('Story deleted')).toBeVisible();
  await P.page.keyboard.press('Escape');
  // Notices from earlier stay up in a background test window; they now sit over the stories row.
  for (const b of await Q.page.getByRole('button', { name: 'Close toast' }).all()) await b.click().catch(() => {});
  await strip(Q).getByRole('button', { name: `${P.u}’s story`, exact: true }).click();
  await expect(viewer(Q).getByRole('img', { name: 'Sunset at the beach' })).toBeVisible();
  await expect(viewer(Q).getByTestId('story-progress').locator('> span')).toHaveCount(1); // one story left
  expect([...P.errors, ...Q.errors, ...R.errors]).toEqual([]);
});

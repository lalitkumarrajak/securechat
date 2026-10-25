// End-to-end: two (sometimes three) phones using Chattrix the way people do.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { bubble, longPress, newTab, phone, signIn, signUp, swipeRight, testPng, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let A: Phone, B: Phone, C: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const settle = (p: Phone) => p.page.waitForTimeout(350); // let slide-in animations finish before screenshots

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  A = await phone(browser, uname('lalit'));
  B = await phone(browser, uname('rakhi'));
  C = await phone(browser, uname('chris'));
});

test.afterAll(async () => {
  for (const p of [A, B, C]) await p?.ctx.close();
});

test('landing page offers sign in and sign up', async () => {
  await A.page.goto('/');
  await expect(A.page.getByRole('heading', { name: /Private chats/ })).toBeVisible();
  await expect(A.page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
  await expect(A.page.getByRole('tab', { name: 'Create account' })).toBeVisible();
  await A.page.screenshot({ path: shots('01-landing-phone') });
  // Validation shows inline, no browser alert.
  await A.page.getByRole('tab', { name: 'Create account' }).click();
  const form = A.page.getByRole('tabpanel');
  await form.getByLabel('Username').fill('X');
  await form.getByRole('button', { name: 'Create account' }).click();
  await expect(form.getByRole('alert')).toContainText('Username');
});

test('three people sign up', async () => {
  await Promise.all([signUp(A), signUp(B), signUp(C)]);
  await expect(A.page.getByText('No chats yet')).toBeVisible();
  await A.page.screenshot({ path: shots('02-empty-chats') });
});

test('friend request: send, receive live, accept', async () => {
  // A searches for B and sends a request
  await A.page.getByRole('button', { name: 'Friends' }).click();
  await A.page.getByRole('tab', { name: 'Add' }).click();
  await A.page.getByPlaceholder('Search by username').fill(B.u);
  const row = A.page.locator('li').filter({ hasText: '@' + B.u });
  await row.getByRole('button', { name: 'Add' }).click();
  await expect(A.page.getByText('Friend request sent').first()).toBeVisible();
  await expect(row.getByRole('button', { name: 'Requested' })).toBeVisible();

  // B gets a live toast and a badge, and accepts
  await expect(B.page.getByText(`${A.u} sent you a friend request`)).toBeVisible();
  await B.page.getByRole('button', { name: 'Friends' }).click();
  await expect(B.page.getByRole('tab', { name: /Requests/ })).toHaveAttribute('data-state', 'active');
  await settle(B);
  await B.page.screenshot({ path: shots('03-request-received') });
  await B.page.locator('li').filter({ hasText: A.u }).getByRole('button', { name: 'Accept' }).click();
  await expect(B.page.getByText(`You and ${A.u} are now friends`)).toBeVisible();
  await expect(row.getByRole('button', { name: 'Message' })).toBeVisible(); // A's search result updates live
  await B.page.keyboard.press('Escape');

  // A and C become friends too (for forwarding later)
  await A.page.getByPlaceholder('Search by username').fill(C.u);
  await A.page.locator('li').filter({ hasText: '@' + C.u }).getByRole('button', { name: 'Add' }).click();
  await C.page.getByRole('button', { name: 'Friends' }).click();
  await C.page.locator('li').filter({ hasText: A.u }).getByRole('button', { name: 'Accept' }).click();
  await C.page.keyboard.press('Escape');
});

test('non-friends cannot chat', async () => {
  // B and C aren't friends: C's search shows "Add", and there's no way to message.
  await C.page.getByRole('button', { name: 'Friends' }).click();
  await C.page.getByRole('tab', { name: 'Add' }).click();
  await C.page.getByPlaceholder('Search by username').fill(B.u);
  await expect(C.page.locator('li').filter({ hasText: '@' + B.u }).getByRole('button', { name: 'Add' })).toBeVisible();
  await C.page.keyboard.press('Escape');
});

test('chatting keeps the keyboard open after Send', async () => {
  await A.page.getByRole('tab', { name: 'Friends' }).click();
  await A.page.getByRole('button', { name: `Message ${B.u}` }).click();
  const input = A.page.getByRole('textbox', { name: 'Message' });
  await input.tap();
  await input.fill('Hi Rakhi! 👋 how are you?');
  await A.page.getByRole('button', { name: 'Send' }).tap();
  await expect(input).toBeFocused();
  await A.page.keyboard.type('Second message without tapping the box');
  await A.page.getByRole('button', { name: 'Send' }).tap();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await expect(bubble(A, 'Second message')).toBeVisible();

  await B.page.locator('li').filter({ hasText: A.u }).first().click();
  await expect(bubble(B, 'Hi Rakhi!')).toBeVisible();
  await expect(B.page.getByText('2 unread messages')).toBeVisible();
  // Read receipts turn blue on A's side.
  await expect(bubble(A, 'Second message').getByLabel('Read')).toBeVisible();
});

test('presence: online while open, last seen right after closing the tab', async () => {
  await expect(A.page.locator('header').getByText('online')).toBeVisible();
  await B.page.close({ runBeforeUnload: true }); // B closes the tab
  await expect(A.page.locator('header').getByText(/last seen today/)).toBeVisible({ timeout: 5_000 });
  await newTab(B); // and comes back later
  await B.page.goto('/');
  await expect(A.page.locator('header').getByText('online')).toBeVisible({ timeout: 10_000 });
  await B.page.locator('li').filter({ hasText: A.u }).first().click();
});

test('emoji-only messages are big, animate once, and replay on tap', async () => {
  await B.page.getByRole('textbox', { name: 'Message' }).fill('😂');
  await B.page.getByRole('button', { name: 'Send' }).tap();
  const emoji = A.page.locator('.big-emoji').last();
  await expect(emoji.locator('svg')).toBeVisible({ timeout: 15_000 });
  const box = (await emoji.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(72); // smaller than before
  // After the animation finishes, it stays still.
  await A.page.waitForTimeout(4000);
  const still1 = await emoji.innerHTML();
  await A.page.waitForTimeout(600);
  expect(await emoji.innerHTML()).toBe(still1);
  // Tap: it plays again.
  await emoji.tap();
  await A.page.waitForTimeout(300);
  expect(await emoji.innerHTML()).not.toBe(still1);
  await A.page.screenshot({ path: shots('04-chat-emoji') });
});

// Phones only open the keyboard if focus() happens while handling the tap/swipe itself.
// Headless Chrome has no keyboard, so record which event was being handled when the box got focus.
const recordFocus = (p: Phone) => p.page.evaluate(() => {
  const w = window as any;
  w.__focusDuring = [];
  const orig = HTMLTextAreaElement.prototype.focus;
  HTMLTextAreaElement.prototype.focus = function (this: HTMLTextAreaElement, ...args: any[]) {
    if (this.id === 'composer-input') w.__focusDuring.push(window.event?.type ?? 'none');
    return orig.apply(this, args as []);
  };
});
const focusEvents = (p: Phone) => p.page.evaluate(() => (window as any).__focusDuring as string[]);

test('swipe to reply quotes the message on both phones', async () => {
  await recordFocus(B);
  await swipeRight(B, bubble(B, 'Hi Rakhi!').locator('div').first());
  expect(await focusEvents(B)).toContain('touchend'); // focused during the swipe → keyboard opens
  await expect(B.page.getByText(`Replying to ${A.u}`)).toBeVisible();
  await expect(B.page.getByRole('textbox', { name: 'Message' })).toBeFocused(); // keyboard opens
  await B.page.screenshot({ path: shots('05-reply-bar') });
  await B.page.getByRole('textbox', { name: 'Message' }).fill("I'm good! 😊");
  await B.page.getByRole('button', { name: 'Send' }).tap();
  const reply = bubble(A, "I'm good!");
  await expect(reply.getByRole('button', { name: /Hi Rakhi!/ })).toBeVisible();
  await expect(reply.getByText('You', { exact: true })).toBeVisible();
});

test('long-press: react, edit, pin', async () => {
  // B reacts ❤️ to A's message via the action sheet
  await longPress(B, bubble(B, 'Second message').locator('div').first());
  await expect(B.page.getByRole('dialog', { name: 'Message options' })).toBeVisible();
  await settle(B);
  await B.page.screenshot({ path: shots('06-action-sheet') });
  await B.page.getByRole('button', { name: 'React ❤️' }).click();

  // Reply from the long-press sheet also focuses the box (opens the keyboard).
  // Start with nothing focused, like a phone with the keyboard closed.
  await B.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await longPress(B, bubble(B, 'Second message').locator('div').first());
  await recordFocus(B);
  await B.page.getByRole('dialog').getByRole('button', { name: 'Reply' }).tap();
  expect(await focusEvents(B)).toContain('click'); // focused during the tap → keyboard opens
  await expect(B.page.getByText(`Replying to ${A.u}`)).toBeVisible();
  await B.page.waitForTimeout(400); // the sheet's closing animation must not steal focus back
  await expect(B.page.getByRole('textbox', { name: 'Message' })).toBeFocused();
  await B.page.getByRole('button', { name: 'Cancel reply' }).click();
  await expect(bubble(A, 'Second message').getByRole('button', { name: '❤️' })).toBeVisible();

  // A edits their message
  await longPress(A, bubble(A, 'Second message').locator('div').first());
  await A.page.getByRole('dialog').getByRole('button', { name: 'Edit' }).click();
  await expect(A.page.getByText('Editing message')).toBeVisible();
  const input = A.page.getByRole('textbox', { name: 'Message' });
  await input.fill('Second message (fixed typo)');
  await A.page.getByRole('button', { name: 'Save edit' }).tap();
  await expect(bubble(B, 'fixed typo').getByText('edited')).toBeVisible();
  await expect(bubble(B, 'fixed typo').getByRole('button', { name: '❤️' })).toBeVisible(); // reaction kept

  // A pins it; both see the pinned bar
  await longPress(A, bubble(A, 'fixed typo').locator('div').first());
  await A.page.getByRole('dialog').getByRole('button', { name: 'Pin' }).click();
  await expect(A.page.getByText('Pinned message')).toBeVisible();
  await expect(B.page.getByText('Pinned message')).toBeVisible();
  await B.page.screenshot({ path: shots('07-pinned-reaction-edit') });
});

test('photo and voice messages', async () => {
  // Photo from the attach menu
  await A.page.getByRole('button', { name: 'Attach' }).click();
  await expect(A.page.getByRole('menuitem', { name: 'Photo' })).toBeVisible();
  await expect(A.page.getByRole('menuitem', { name: 'Camera' })).toBeVisible();
  await A.page.keyboard.press('Escape');
  const png = testPng();
  await A.page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await expect(B.page.locator('img[alt="Photo"]').last()).toBeVisible();

  // Voice: hold the mic for ~1.5 s with Chrome's fake microphone, release to send
  const mic = A.page.getByRole('button', { name: 'Hold to record a voice message' });
  const b = (await mic.boundingBox())!;
  await A.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await A.page.mouse.down();
  await expect(A.page.getByText('Slide to cancel')).toBeVisible();
  await expect(B.page.locator('header').getByText('recording audio…')).toBeVisible();
  await A.page.waitForTimeout(1500);
  await A.page.mouse.up();
  const play = B.page.getByRole('button', { name: 'Play voice message' }).last();
  await expect(play).toBeVisible({ timeout: 15_000 });
  await play.click();
  await expect(B.page.getByRole('button', { name: 'Pause' }).last()).toBeVisible();
  await B.page.screenshot({ path: shots('08-photo-voice') });
});

test('forward to another friend', async () => {
  // .first(): the original, not B's reply that quotes it
  await longPress(A, A.page.locator('[data-k]').filter({ hasText: 'Hi Rakhi!' }).first().locator('div').first());
  await A.page.getByRole('dialog').getByRole('button', { name: 'Forward' }).click();
  const dlg = A.page.getByRole('dialog', { name: 'Forward to…' });
  await dlg.getByRole('button', { name: C.u }).click();
  await dlg.getByRole('button', { name: 'Send to 1' }).click();
  await expect(A.page.getByText('Forwarded to 1 chat')).toBeVisible();
  await C.page.locator('li').filter({ hasText: A.u }).first().click();
  await expect(bubble(C, 'Hi Rakhi!').getByText('Forwarded')).toBeVisible();
});

test('select messages; delete for me and for everyone', async () => {
  await A.page.getByRole('textbox', { name: 'Message' }).fill('oops, wrong chat');
  await A.page.getByRole('button', { name: 'Send' }).tap();
  await A.page.getByRole('textbox', { name: 'Message' }).fill('only I should forget this');
  await A.page.getByRole('button', { name: 'Send' }).tap();
  await expect(bubble(B, 'only I should forget this')).toBeVisible();

  // Delete for everyone (within 5 minutes)
  await longPress(A, bubble(A, 'oops, wrong chat').locator('div').first());
  await A.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await A.page.getByRole('alertdialog').getByRole('button', { name: 'Delete for everyone' }).click();
  await expect(B.page.getByText('This message was deleted')).toBeVisible();
  await expect(A.page.getByText('You deleted this message')).toBeVisible();

  // Select mode: pick one, delete for me only
  await longPress(A, bubble(A, 'only I should forget').locator('div').first());
  await A.page.getByRole('dialog').getByRole('button', { name: 'Select' }).click();
  await expect(A.page.getByText('1 selected')).toBeVisible();
  await A.page.getByRole('button', { name: 'Delete' }).click();
  const dlg = A.page.getByRole('alertdialog');
  await expect(dlg.getByRole('button', { name: 'Delete for everyone' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Delete for me' }).click();
  await expect(bubble(A, 'only I should forget')).toHaveCount(0);
  await expect(bubble(B, 'only I should forget')).toBeVisible(); // the other person keeps it

  // Received messages can only be deleted for me
  await longPress(A, bubble(A, "I'm good!").locator('div').first());
  await A.page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(A.page.getByRole('alertdialog').getByRole('button', { name: 'Delete for everyone' })).toHaveCount(0);
  await A.page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
});

test('settings: theme, accent, text size persist; profile name reaches friends', async () => {
  await A.page.getByRole('button', { name: 'Back' }).first().click();
  await A.page.getByRole('button', { name: 'Profile and settings' }).click();
  await A.page.getByRole('button', { name: /Appearance/ }).click();
  await A.page.getByRole('radio', { name: 'Dark' }).click();
  await A.page.getByRole('radio', { name: 'Violet' }).click();
  await A.page.getByRole('radio', { name: 'Large' }).click();
  await A.page.getByRole('radio', { name: /Dots/ }).click();
  const html = A.page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-accent', 'violet');
  await expect(html).toHaveAttribute('data-font', 'lg');
  await settle(A);
  await A.page.screenshot({ path: shots('09-appearance-dark') });
  await A.page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-accent', 'violet');

  await A.page.getByRole('button', { name: 'Profile and settings' }).click();
  await A.page.getByRole('button', { name: new RegExp(A.u) }).click();
  await A.page.getByLabel('Name').fill('Lalit Rajak');
  await A.page.getByLabel('About').fill('Building Chattrix 🚀');
  await A.page.getByRole('button', { name: 'Save' }).click();
  await expect(A.page.getByText('Profile saved')).toBeVisible();
  await expect(B.page.locator('header').getByText('Lalit Rajak')).toBeVisible();
  await A.page.keyboard.press('Escape');
});

test('dark mode chat screen and desktop layout', async ({ browser }) => {
  await A.page.locator('li').filter({ hasText: 'Lalit' }).or(A.page.locator('li').filter({ hasText: B.u })).first().click();
  await A.page.screenshot({ path: shots('10-chat-dark') });
  const D = await phone(browser, B.u, { viewport: { width: 1280, height: 800 } });
  await signIn(D);
  await D.page.locator('li').filter({ hasText: 'Lalit Rajak' }).first().click();
  // Hover menu on desktop
  const msg = D.page.locator('[data-k]').filter({ hasText: 'Hi Rakhi!' }).first();
  await msg.hover();
  await msg.getByRole('button', { name: 'Message options' }).click();
  await expect(D.page.getByRole('menuitem', { name: 'Reply' })).toBeVisible();
  await D.page.screenshot({ path: shots('11-desktop-menu') });
  await D.page.keyboard.press('Escape');
  expect(D.errors).toEqual([]);
  await D.ctx.close();
});

test('block stops messages', async () => {
  await B.page.locator('header').getByRole('button', { name: 'Chat options' }).click();
  await B.page.getByRole('menuitem', { name: 'Block' }).click();
  await B.page.getByRole('alertdialog').getByRole('button', { name: 'Block' }).click();
  await expect(B.page.getByText(/You blocked/)).toBeVisible();
  await A.page.getByRole('textbox', { name: 'Message' }).fill('can you see this?');
  await A.page.getByRole('button', { name: 'Send' }).tap();
  await expect(bubble(A, 'can you see this?').getByLabel('Not sent')).toBeVisible();
  await expect(bubble(B, 'can you see this?')).toHaveCount(0);
  await B.page.getByRole('button', { name: 'Unblock' }).click();
});

test('no errors in the browser console', async () => {
  expect([...A.errors, ...B.errors, ...C.errors]).toEqual([]);
});

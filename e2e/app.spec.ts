// End-to-end: two (sometimes three) phones using Chattrix the way people do.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { bubble, longPress, newTab, phone, signIn, signUp, stubExternalImages, swipeRight, testPdf, testPng, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let A: Phone, B: Phone, C: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const settle = (p: Phone) => p.page.waitForTimeout(350); // let slide-in animations finish before screenshots

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  A = await phone(browser, uname('lalit'));
  B = await phone(browser, uname('rakhi'));
  C = await phone(browser, uname('chris'));
  for (const p of [A, B, C]) await stubExternalImages(p);
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

  // 🥺 bobs up and down (pleading), like WhatsApp: its top edge rises and comes back
  await B.page.getByRole('textbox', { name: 'Message' }).fill('🥺');
  await B.page.getByRole('button', { name: 'Send' }).tap();
  const plead = A.page.locator('.big-emoji[aria-label="🥺"]').last();
  await expect(plead).toHaveClass(/emoji-plead/, { timeout: 15_000 });
  const travel = await plead.evaluate((el) => new Promise<number>((done) => {
    const tops: number[] = [];
    const t0 = performance.now();
    const tick = () => {
      tops.push(el.getBoundingClientRect().top);
      if (performance.now() - t0 < 1200) requestAnimationFrame(tick); else done(Math.max(...tops) - Math.min(...tops));
    };
    tick();
  }));
  expect(travel).toBeGreaterThan(4); // px of vertical movement
  await expect(plead).not.toHaveClass(/emoji-plead/, { timeout: 5000 }); // then it rests
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
  await expect(B.page.getByRole('dialog', { name: 'Message options' })).not.toContainText('//'); // no stray code comments
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
  await A.page.locator('input[data-kind="gallery"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
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
  // B's phone is told about the new sign-in, with where it happened
  const alert = B.page.locator('[data-sonner-toast]').filter({ hasText: 'New sign-in: Chrome on Linux' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Mumbai, Maharashtra, India');
  await B.page.screenshot({ path: shots('15-signin-alert') });
  await alert.getByRole('button', { name: 'Close toast' }).click().catch(() => {});
  await D.page.locator('li').filter({ hasText: 'Lalit Rajak' }).first().click();
  // Hover menu on desktop
  const msg = D.page.locator('[data-k]').filter({ hasText: 'Hi Rakhi!' }).first();
  await msg.hover();
  await msg.getByRole('button', { name: 'Message options' }).click();
  await expect(D.page.getByRole('menuitem', { name: 'Reply' })).toBeVisible();
  await D.page.screenshot({ path: shots('11-desktop-menu') });
  await D.page.keyboard.press('Escape');
  expect(D.errors).toEqual([]);

  // Active sessions: B sees both devices and signs the desktop out from the phone
  await B.page.getByRole('button', { name: 'Back' }).first().click();
  await B.page.getByRole('button', { name: 'Profile and settings' }).click();
  await B.page.getByRole('button', { name: /Active sessions/ }).click();
  await expect(B.page.getByText('This device · active now')).toBeVisible();
  const other = B.page.locator('li').filter({ hasText: 'Chrome on Linux' }).filter({ has: B.page.getByRole('button', { name: 'Sign out' }) });
  await expect(other).toBeVisible();
  await expect(other).toContainText('Mumbai, Maharashtra, India');
  await expect(other).toContainText('Reliance Jio');
  await B.page.waitForTimeout(350);
  await B.page.screenshot({ path: shots('14-sessions') });
  await other.getByRole('button', { name: 'Sign out' }).click();
  await B.page.getByRole('alertdialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(B.page.getByText('Device signed out')).toBeVisible();
  await expect(D.page.getByRole('tab', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 }); // the desktop is back at the landing page
  await D.ctx.close();
  await B.page.keyboard.press('Escape');
  await B.page.locator('li').filter({ hasText: 'Lalit Rajak' }).first().click();
});

test('composer: emoji, attach and camera sit inside the message box', async () => {
  const box = A.page.locator('div:has(> textarea#composer-input)');
  await expect(box.getByRole('button', { name: 'Emoji, GIFs and stickers' })).toBeVisible();
  await expect(box.getByRole('button', { name: 'Attach' })).toBeVisible();
  await expect(box.getByRole('button', { name: 'Camera' })).toBeVisible();
});

test('emoji panel, animated stickers and GIFs', async () => {
  const input = A.page.getByRole('textbox', { name: 'Message' });
  await A.page.getByRole('button', { name: 'Emoji, GIFs and stickers' }).click();
  const panel = A.page.getByRole('dialog', { name: 'Emoji, GIFs and stickers' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '🔥' }).first().click();
  await panel.getByRole('button', { name: '😂' }).first().click();
  await expect(input).toHaveValue('🔥😂');
  await panel.getByRole('button', { name: 'Delete' }).click();
  await expect(input).toHaveValue('🔥');
  await panel.getByRole('button', { name: 'Delete' }).click(); // not input.fill: focusing the box swaps the panel for the keyboard
  await expect(input).toHaveValue('');

  // Built-in animated sticker
  await panel.getByRole('button', { name: 'Stickers' }).click();
  await panel.getByRole('button', { name: 'Sticker 🥳' }).click();
  await expect(B.page.locator('[data-k] .big-emoji svg').last()).toBeVisible({ timeout: 15_000 });

  // GIF search (KLIPY): the box must say "Search KLIPY"
  await panel.getByRole('button', { name: 'GIFs' }).click();
  await expect(panel.getByPlaceholder('Search KLIPY')).toBeVisible();
  await expect(panel.getByText('Powered by KLIPY')).toBeVisible();
  await panel.getByPlaceholder('Search KLIPY').fill('party');
  await panel.getByRole('button', { name: 'Test GIF 2' }).click();
  await expect(B.page.locator('img[alt="GIF"]').last()).toHaveAttribute('src', 'https://static.klipy.com/ii/test/2-md.webp');
  await A.page.screenshot({ path: shots('12-gif-panel') });
  await A.page.getByRole('button', { name: 'Keyboard' }).click();
  await expect(panel).toHaveCount(0);
  await expect(input).toBeFocused();
});

test('documents arrive with a preview; locations show on a map', async () => {
  // PDF: first page rendered as a thumbnail on the sender's side
  await A.page.locator('input[data-kind="document"]').setInputFiles({ name: 'Plan.pdf', mimeType: 'application/pdf', buffer: testPdf() });
  const card = B.page.locator('[data-k]').filter({ hasText: 'Plan.pdf' }).last();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText(/1 page/)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Preview' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Download Plan.pdf' })).toBeVisible();
  const [download] = await Promise.all([B.page.waitForEvent('download'), card.getByRole('button', { name: 'Download Plan.pdf' }).click()]);
  expect(download.suggestedFilename()).toBe('Plan.pdf');

  // Text file: the first lines are the preview
  await A.page.locator('input[data-kind="document"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Shopping list\n- milk\n- bread') });
  await expect(B.page.locator('[data-k]').filter({ hasText: 'notes.txt' }).last().getByText('Shopping list')).toBeVisible();

  // Location
  await A.page.getByRole('button', { name: 'Attach' }).click();
  await A.page.getByRole('menuitem', { name: 'Location' }).click();
  await A.page.getByRole('alertdialog').getByRole('button', { name: 'Send location' }).click();
  const loc = B.page.locator('[data-k]').filter({ hasText: 'Open in Maps' }).last();
  await expect(loc).toBeVisible();
  await expect(loc.getByRole('link')).toHaveAttribute('href', /query=28\.6129,77\.2295/);
  await expect(loc.locator('img[src*="tile.openstreetmap.org/15/"]')).toHaveCount(4);
  await B.page.screenshot({ path: shots('13-file-location') });
});

test('links get a preview card', async () => {
  const input = A.page.getByRole('textbox', { name: 'Message' });
  await input.fill('Look at this http://localhost:4322/article');
  await expect(A.page.getByText('Chattrix launches link previews')).toBeVisible();
  await A.page.getByRole('button', { name: 'Send' }).click();
  const msg = B.page.locator('[data-k]').filter({ hasText: 'Look at this' }).last();
  await expect(msg.getByText('Chattrix launches link previews')).toBeVisible();
  await expect(msg.getByText('Chattrix Blog')).toBeVisible();
  // Dismissing the preview sends the link without one
  await input.fill('No card please http://localhost:4322/article');
  await A.page.getByRole('button', { name: 'Remove link preview' }).click();
  await A.page.getByRole('button', { name: 'Send' }).click();
  await expect(B.page.locator('[data-k]').filter({ hasText: 'No card please' }).last().getByText('Chattrix Blog')).toHaveCount(0);
});

test('select several to forward or delete; edit from the selection bar', async () => {
  await longPress(A, bubble(A, 'No card please').locator('div').first());
  await A.page.getByRole('dialog').getByRole('button', { name: 'Select' }).click();
  await expect(A.page.getByRole('button', { name: 'Edit' })).toBeVisible(); // one own recent text message
  await bubble(A, 'Look at this').locator('div').first().click(); // tap to add a second
  await expect(A.page.getByText('2 selected')).toBeVisible();
  await expect(A.page.getByRole('button', { name: 'Forward' })).toBeVisible();
  await expect(A.page.getByRole('button', { name: 'Delete' })).toBeVisible();
  await expect(A.page.getByRole('button', { name: 'Edit' })).toHaveCount(0); // only for a single message
  await A.page.getByRole('button', { name: 'Cancel selection' }).click();
});

test('Esc and the phone back button close the chat, like WhatsApp', async () => {
  const options = A.page.locator('header').getByRole('button', { name: 'Chat options' });
  const chatList = A.page.getByRole('heading', { level: 1, name: A.u });
  await expect(options).toBeVisible();
  // Esc in an open menu only closes the menu
  await options.click();
  await A.page.keyboard.press('Escape');
  await expect(A.page.getByRole('menu')).toHaveCount(0);
  await expect(options).toBeVisible();
  // Then search closes first, then the chat (on phones the list comes back)
  await options.click();
  await A.page.getByRole('menuitem', { name: 'Search' }).click();
  await expect(A.page.getByPlaceholder('Search messages')).toBeVisible();
  await A.page.keyboard.press('Escape');
  await expect(A.page.getByPlaceholder('Search messages')).toHaveCount(0);
  await expect(options).toBeVisible();
  await A.page.keyboard.press('Escape');
  await expect(options).toHaveCount(0);
  await expect(chatList).toBeVisible();
  // The back button closes the chat but stays in the app
  const row = A.page.locator('aside li').filter({ hasText: B.u }).first();
  await row.click();
  await expect(options).toBeVisible();
  await A.page.goBack();
  await expect(options).toHaveCount(0);
  await expect(chatList).toBeVisible();
  await row.click(); // back into the chat for the next tests
  await expect(options).toBeVisible();
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

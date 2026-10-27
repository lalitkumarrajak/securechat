// End-to-end: voice and video calls between two friends, over real WebRTC (Chrome's fake camera and
// microphone). Answering, muting, hanging up, declining, cancelling, and the calls in the chat.
import { test, expect } from '@playwright/test';
import { makeFriends, phone, signUp, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });

let P: Phone, Q: Phone;
const callScreen = (p: Phone) => p.page.getByRole('dialog', { name: /^Call with/ });
const openChat = async (p: Phone, other: Phone) => {
  await p.page.getByRole('button', { name: 'Friends' }).click();
  await p.page.getByRole('dialog').locator('li').filter({ hasText: other.u }).first().click();
  await expect(p.page.getByRole('button', { name: 'Voice call' })).toBeVisible();
};

test.beforeAll(async ({ browser }) => {
  [P, Q] = await Promise.all([phone(browser, uname('caller')), phone(browser, uname('callee'))]);
});
test.afterAll(async () => { for (const p of [P, Q]) await p?.ctx.close(); });

test('set up: two friends, chat open', async () => {
  await Promise.all([signUp(P), signUp(Q)]);
  await makeFriends(P, Q);
  await openChat(P, Q);
});

test('a voice call: ring, answer, talk, mute, hang up', async () => {
  await P.page.getByRole('button', { name: 'Voice call' }).click();
  await expect(callScreen(P)).toContainText(/Ringing…|Calling…/);
  const incoming = callScreen(Q);
  await expect(incoming).toContainText('Incoming voice call');
  await expect(incoming).toContainText(P.u);
  await incoming.getByRole('button', { name: 'Accept' }).click();

  // Connected: both count the call's time.
  await expect(callScreen(P).getByText(/^0:0\d$/)).toBeVisible({ timeout: 20_000 });
  await expect(callScreen(Q).getByText(/^0:0\d$/)).toBeVisible();
  // Q hears P's microphone: the audio is flowing.
  await expect.poll(() => Q.page.evaluate(() => {
    const a = document.querySelector('audio') as HTMLAudioElement | null;
    return !!a?.srcObject && (a.srcObject as MediaStream).getAudioTracks().some((t) => t.readyState === 'live');
  })).toBe(true);

  await callScreen(P).getByRole('button', { name: 'Mute' }).click();
  await expect(callScreen(Q).getByText(`${P.u} is muted`)).toBeVisible();
  await callScreen(P).getByRole('button', { name: 'Unmute' }).click();
  await expect(callScreen(Q).getByText(`${P.u} is muted`)).toHaveCount(0);

  // Minimise to keep chatting, then come back.
  await callScreen(P).getByRole('button', { name: 'Minimise call' }).click();
  await expect(P.page.getByRole('button', { name: 'Return to call' })).toBeVisible();
  await P.page.getByRole('button', { name: 'Return to call' }).click();

  await callScreen(Q).getByRole('button', { name: 'End call' }).click();
  await expect(callScreen(P)).toContainText('Call ended');
  await expect(callScreen(P)).toHaveCount(0, { timeout: 5000 });
  await expect(P.page.locator('[data-k]').filter({ hasText: 'Outgoing voice call' })).toBeVisible();
  await expect(Q.page.getByRole('button', { name: new RegExp(P.u) }).filter({ hasText: 'Incoming voice call' }).first()).toBeVisible();
});

test('a video call: both see each other', async () => {
  await P.page.getByRole('button', { name: 'Video call' }).click();
  await callScreen(Q).getByRole('button', { name: 'Accept video call' }).click();
  await expect(callScreen(P).getByText(/^0:0\d$/)).toBeVisible({ timeout: 20_000 });
  // Their video plays (Chrome's fake camera), and ours shows in the corner.
  await expect.poll(() => P.page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => v.videoWidth > 0).length)).toBe(2);
  await callScreen(Q).getByRole('button', { name: 'Turn camera off' }).click();
  await expect(callScreen(P).getByText(`${Q.u}’s camera is off`)).toBeVisible();
  await callScreen(P).getByRole('button', { name: 'End call' }).click();
  await expect(callScreen(Q)).toContainText('Call ended');
  await expect(P.page.locator('[data-k]').filter({ hasText: 'Outgoing video call' })).toBeVisible();
});

test('declined and cancelled calls show in the chat', async () => {
  await expect(callScreen(P)).toHaveCount(0, { timeout: 5000 });
  await P.page.getByRole('button', { name: 'Video call' }).click();
  await callScreen(Q).getByRole('button', { name: 'Decline' }).click();
  await expect(callScreen(P)).toContainText('Declined');
  await expect(P.page.locator('[data-k]').filter({ hasText: 'Video call declined' })).toBeVisible();

  await expect(callScreen(P)).toHaveCount(0, { timeout: 5000 });
  await P.page.getByRole('button', { name: 'Voice call' }).click();
  await expect(callScreen(Q)).toContainText('Incoming voice call');
  await callScreen(P).getByRole('button', { name: 'End call' }).click();
  await expect(callScreen(Q)).toContainText('Missed call');

  // Q opens the chat: the missed call, with a button to call back.
  await expect(callScreen(Q)).toHaveCount(0, { timeout: 5000 });
  await openChat(Q, P);
  const missed = Q.page.locator('[data-k]').filter({ hasText: 'Missed voice call' });
  await expect(missed).toBeVisible();
  await expect(Q.page.locator('[data-k]').filter({ hasText: 'Declined video call' })).toBeVisible();
  await missed.getByRole('button', { name: 'Call back' }).click();
  await expect(callScreen(P)).toContainText('Incoming voice call');
  await callScreen(P).getByRole('button', { name: 'Decline' }).click();
  expect([...P.errors, ...Q.errors]).toEqual([]);
});

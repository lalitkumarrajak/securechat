// End-to-end: voice and video calls between two friends, over real WebRTC (Chrome's fake camera and
// microphone). Answering, muting, hanging up, declining, cancelling, and the calls in the chat.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { makeFriends, phone, signUp, uname, type Phone, openFriends } from './helpers';

test.describe.configure({ mode: 'serial' });

let P: Phone, Q: Phone;
const callScreen = (p: Phone) => p.page.getByRole('dialog', { name: /^Call with/ });
const openChat = async (p: Phone, other: Phone) => {
  await openFriends(p);
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

  // The small floating window, where the browser has one: their photo, name and the call's time.
  const pip = callScreen(P).getByRole('button', { name: 'Small window' });
  if (await pip.count()) {
    await pip.click();
    await expect.poll(() => P.page.evaluate(() => (document.pictureInPictureElement as HTMLElement | null)?.dataset.callPip !== undefined)).toBe(true);
    // What it shows: a frame of it, kept with the test's screenshots.
    const frame = await P.page.evaluate(() => {
      const v = document.pictureInPictureElement as HTMLVideoElement;
      const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
      c.getContext('2d')!.drawImage(v, 0, 0);
      return c.toDataURL('image/png');
    });
    fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
    fs.writeFileSync('e2e/.artifacts/screens/78-call-small-window.png', Buffer.from(frame.split(',')[1], 'base64'));
    await P.page.evaluate(() => document.exitPictureInPicture());
  }

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

test('closing Sanga mid-call and opening it again picks the same call back up', async () => {
  await P.page.getByRole('button', { name: 'Voice call' }).click();
  await callScreen(Q).getByRole('button', { name: 'Accept' }).click();
  await expect(callScreen(P).getByText(/^0:0\d$/)).toBeVisible({ timeout: 20_000 });

  await P.page.reload(); // as good as closing the app and opening it again
  // Back on the same call, still counting from when it started; Q hears P again.
  await expect(callScreen(P).getByText(/^0:\d\d$/)).toBeVisible({ timeout: 30_000 });
  await expect(callScreen(Q).getByText(/^0:\d\d$/)).toBeVisible();
  await expect.poll(() => Q.page.evaluate(() => [...document.querySelectorAll('audio')].some((a) =>
    !!a.srcObject && (a.srcObject as MediaStream).getAudioTracks().some((t) => t.readyState === 'live'))), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => P.page.evaluate(() => [...document.querySelectorAll('audio')].some((a) =>
    !!a.srcObject && (a.srcObject as MediaStream).getAudioTracks().some((t) => t.readyState === 'live'))), { timeout: 20_000 }).toBe(true);

  await callScreen(Q).getByRole('button', { name: 'End call' }).click();
  await expect(callScreen(P)).toContainText('Call ended');
  await expect(callScreen(P)).toHaveCount(0, { timeout: 5000 });
  await expect(callScreen(Q)).toHaveCount(0, { timeout: 5000 });
  await openChat(P, Q); // the reload left the chat
  await expect(P.page.locator('[data-k]').filter({ hasText: 'Outgoing voice call' })).toHaveCount(2); // logged once
});

test('a video call: both see each other', async () => {
  await P.page.getByRole('button', { name: 'Video call' }).click();
  await callScreen(Q).getByRole('button', { name: 'Accept video call' }).click();
  await expect(callScreen(P).getByText(/^0:0\d$/)).toBeVisible({ timeout: 20_000 });
  // Their video plays (Chrome's fake camera), and ours shows in the corner.
  await expect.poll(() => P.page.evaluate(() => [...document.querySelectorAll('video:not([data-call-pip])')].filter((v) => (v as HTMLVideoElement).videoWidth > 0).length)).toBe(2);
  await callScreen(Q).getByRole('button', { name: 'Turn camera off' }).click();
  await expect(callScreen(P).getByText(`${Q.u}’s camera is off`)).toBeVisible();
  await callScreen(P).getByRole('button', { name: 'End call' }).click();
  await expect(callScreen(Q)).toContainText('Call ended');
  await expect(P.page.locator('[data-k]').filter({ hasText: 'Outgoing video call' })).toBeVisible();
});

// The browser's screen picker can't be clicked in a test: the "screen" is a moving drawing instead.
// Everything after picking it is real: the voice call gains a video track, agreed between the phones.
async function fakeScreen(p: Phone) {
  await p.page.evaluate(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const c = Object.assign(document.createElement('canvas'), { width: 640, height: 360 });
      const g = c.getContext('2d')!;
      let i = 0;
      setInterval(() => { g.fillStyle = `hsl(${i++ % 360} 70% 50%)`; g.fillRect(0, 0, 640, 360); }, 50);
      return c.captureStream(15);
    };
  });
}

test('share my screen in a voice call; the other side sees it', async () => {
  await expect(callScreen(P)).toHaveCount(0, { timeout: 5000 });
  await fakeScreen(P);
  await P.page.getByRole('button', { name: 'Voice call' }).click();
  await callScreen(Q).getByRole('button', { name: 'Accept' }).click();
  await expect(callScreen(P).getByText(/^0:0\d$/)).toBeVisible({ timeout: 20_000 });

  await callScreen(P).getByRole('button', { name: 'Share screen' }).click();
  await expect(callScreen(P).getByText('You’re sharing your screen')).toBeVisible();
  await expect(callScreen(Q).getByText(`${P.u} is sharing their screen`)).toBeVisible();
  // Q's screen plays P's picture
  await expect.poll(() => Q.page.evaluate(() => [...document.querySelectorAll('video')].some((v) => v.videoWidth > 0)), { timeout: 15_000 }).toBe(true);
  await P.page.screenshot({ path: 'e2e/.artifacts/screens/16-sharing.png' });
  await Q.page.screenshot({ path: 'e2e/.artifacts/screens/17-sharing-seen.png' });

  await callScreen(P).getByRole('button', { name: 'Stop sharing screen' }).click();
  await expect(callScreen(Q).getByText(`${P.u} is sharing their screen`)).toHaveCount(0);
  // and again, on the same video track (no new agreement needed)
  await callScreen(P).getByRole('button', { name: 'Share screen' }).click();
  await expect(callScreen(Q).getByText(`${P.u} is sharing their screen`)).toBeVisible();
  await callScreen(P).getByRole('button', { name: 'End call' }).click();
  await expect(callScreen(Q)).toContainText('Call ended');
  expect(P.errors).toEqual([]);
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

test('a group call: add a friend, everyone hears everyone, one leaves and the others carry on', async ({ browser }) => {
  const R = await phone(browser, uname('third'));
  await signUp(R);
  await expect(callScreen(P)).toHaveCount(0, { timeout: 5000 });
  for (const p of [P, Q]) await p.page.getByRole('button', { name: 'Back' }).first().click(); // to the chat list
  await makeFriends(P, R);
  await makeFriends(Q, R); // everyone on a call must be friends with everyone else
  await openChat(P, Q);
  await P.page.getByRole('button', { name: 'Voice call' }).click();
  await callScreen(Q).getByRole('button', { name: 'Accept' }).click();
  await expect(callScreen(P).getByText(/^0:0\d$/)).toBeVisible({ timeout: 20_000 });

  await callScreen(P).getByRole('button', { name: 'Add people' }).click();
  const add = P.page.getByRole('dialog', { name: 'Add people' });
  await expect(add.getByRole('button', { name: new RegExp(Q.u) })).toBeDisabled(); // already on it
  await add.getByRole('button', { name: new RegExp(R.u) }).click();
  await expect(callScreen(Q).getByRole('listitem', { name: R.u })).toContainText('Ringing…'); // Q sees R being rung
  await expect(callScreen(R)).toContainText('Incoming group voice call');
  await callScreen(R).getByRole('button', { name: 'Accept' }).click();

  // All three connected, each hearing the other two
  for (const p of [P, Q, R]) {
    await expect(callScreen(p).getByRole('heading', { name: 'Group call · 3 people' })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => p.page.evaluate(() => [...document.querySelectorAll('audio')]
      .filter((a) => (a.srcObject as MediaStream | null)?.getAudioTracks().some((t) => t.readyState === 'live')).length), { timeout: 20_000 }).toBe(2);
  }
  for (const p of [P, Q, R]) await expect(callScreen(p).getByRole('listitem').filter({ hasText: 'Connecting…' })).toHaveCount(0, { timeout: 20_000 });
  await R.page.screenshot({ path: 'e2e/.artifacts/screens/18-group-call.png' });

  await callScreen(R).getByRole('button', { name: 'Mute' }).click();
  await expect(callScreen(P).getByRole('listitem', { name: R.u }).getByLabel('Muted')).toBeVisible();

  await callScreen(R).getByRole('button', { name: 'Leave call' }).click();
  await expect(P.page.getByText(`${R.u} left the call`).first()).toBeVisible();
  await expect(callScreen(P).getByRole('heading', { name: 'Group call · 3 people' })).toHaveCount(0);
  await expect(callScreen(P)).toContainText(Q.u); // back to the two of them
  await callScreen(Q).getByRole('button', { name: 'End call' }).click();
  await expect(callScreen(P)).toContainText('Call ended');
  expect([...P.errors, ...Q.errors, ...R.errors]).toEqual([]);
  await R.ctx.close();
});

// Signing in on a new phone to an account with a long history: the latest messages show first, and
// the older ones fill in behind them, edits and reactions to them included.
import { test, expect } from '@playwright/test';
// The server tests' helpers: real accounts, encryption and sockets, to make 260 messages quickly.
// @ts-expect-error plain JavaScript
import { befriend, connect, register, sendText } from '../test/helpers.js';
import { bubble, openChats, phone, signIn, uname, PASSWORD } from './helpers';

const PORT = 4321;
const srv = {
  port: PORT,
  async api(p: string, body?: unknown, token?: string) {
    const res = await fetch(`http://localhost:${PORT}${p}`, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, data: await res.json().catch(() => null), res };
  },
};

test('a new phone shows the latest messages first and fills in the older ones', async ({ browser }) => {
  const a = await register(srv, uname('hista'), PASSWORD);
  const b = await register(srv, uname('histb'), PASSWORD);
  await befriend(srv, a, b);
  const wa = await connect(srv, a.token);
  const wb = await connect(srv, b.token);
  const sent = [];
  for (let i = 1; i <= 260; i++) sent.push(await sendText(wa, a, b, `History ${i}`));
  // Read on B's other phone already, so the chat opens at the newest (not at the first unread).
  wb.sendJson({ t: 'rcpt', ids: sent.map((r: { id: number }) => r.id), s: 2 });
  await new Promise((r) => setTimeout(r, 500));
  // After them: an edit and a reaction to early messages, which a new phone gets before those messages.
  await sendText(wa, a, b, { type: 'edit', k: `${a.u}/${sent[1].cid}`, text: 'History 2 (edited)' });
  await sendText(wb, b, a, { type: 'react', k: `${a.u}/${sent[2].cid}`, e: '🎉' });
  wa.close(); wb.close();

  const B = await phone(browser, b.u);
  await signIn(B);
  await openChats(B);
  await B.page.locator('aside li').filter({ hasText: a.u }).click();
  // The newest message is there straight away, at the bottom.
  await expect(bubble(B, 'History 260')).toBeInViewport();

  // Scrolling up reaches the very first message, filled in from the server behind the newest.
  const log = B.page.locator('[role=log]');
  const first = B.page.getByText('History 1', { exact: true });
  for (let i = 0; i < 40 && !(await first.count()); i++) {
    await log.evaluate((el) => { el.scrollTop = 0; });
    await B.page.waitForTimeout(300);
  }
  await expect(first).toHaveCount(1);
  const msg = (i: number) => B.page.locator(`[data-k="${a.u}/${sent[i - 1].cid}"]`);
  await expect(msg(2)).toContainText('History 2 (edited)');
  await expect(msg(3)).toContainText('🎉');
  // Every message once.
  await expect(B.page.locator('[data-k]').filter({ hasText: /^History \d+/ })).toHaveCount(260);
  await expect(B.page.getByRole('status', { name: 'Loading older messages' })).toHaveCount(0);
  expect(B.errors).toEqual([]);
  await B.ctx.close();
});

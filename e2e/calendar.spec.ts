// End-to-end: the calendar. The Hindu calendar (panchang, festivals, fasts) worked out on the device,
// events that repeat (by date or by tithi), holidays, the fast tracker, syncing to your other device,
// and a reminder sent by the server at the time and shown in the open app.
import { test, expect, type Page } from '@playwright/test';
import { phone, signIn, signUp, tab, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
const LAPTOP = { viewport: { width: 1366, height: 860 }, timezoneId: 'Asia/Kolkata' };
let P: Phone, P2: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;
const cal = (p: Phone) => p.page.getByRole('region', { name: 'Calendar' });
const pad = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

test.beforeAll(async ({ browser }) => { P = await phone(browser, uname('cal'), LAPTOP); });
test.afterAll(async () => { for (const p of [P, P2]) await p?.ctx.close(); });

/** Move the month view to `ym` (YYYY-MM). */
async function goToMonth(page: Page, ym: string) {
  for (let i = 0; i < 40; i++) {
    const title = await page.getByRole('region', { name: 'Month' }).getByRole('heading').first().textContent();
    const shown = new Date(`1 ${title}`);
    const want = new Date(`${ym}-01T12:00:00`);
    const diff = (want.getFullYear() - shown.getFullYear()) * 12 + want.getMonth() - shown.getMonth();
    if (diff === 0) return;
    await page.getByRole('button', { name: diff > 0 ? 'Next month' : 'Previous month' }).click();
  }
}

test('the Calendar tab: today in the Hindu calendar, and festivals on their days', async () => {
  await signUp(P);
  await tab(P, 'Calendar').click();
  await expect(cal(P).getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(cal(P).getByRole('region', { name: 'Today' })).toContainText(/(Shukla|Krishna) /);
  await expect(cal(P).getByText('Panchang')).toBeVisible();

  await goToMonth(P.page, '2026-11');
  await cal(P).getByRole('gridcell', { name: /November 8/ }).click();
  await expect(cal(P).getByRole('heading', { name: 'Diwali · Lakshmi Puja' })).toBeVisible();
  await expect(cal(P).getByText('Pradosh kaal (puja)')).toBeVisible();
  await goToMonth(P.page, '2026-11');
  await cal(P).getByRole('gridcell', { name: /November 20/ }).click();
  const ek = cal(P).getByRole('article').filter({ hasText: 'Devutthana Ekadashi' });
  await expect(ek).toContainText('Parana (break the fast)');
  await P.page.screenshot({ path: shots('70-calendar-ekadashi') });
  expect(P.errors).toEqual([]);
});

test('an event with a reminder: the server sends it at the time and the open app shows it', async () => {
  const start = new Date(Date.now() + 60e3);
  start.setSeconds(0, 0);
  if (start.getTime() - Date.now() < 25e3) start.setMinutes(start.getMinutes() + 1); // time to save it
  await cal(P).getByRole('button', { name: 'Today' }).click().catch(() => {});
  await cal(P).getByRole('button', { name: 'Add', exact: true }).click();
  const ed = P.page.getByRole('dialog', { name: 'New event' });
  await ed.getByLabel('Title').fill('Call Maa');
  await ed.getByLabel('Starts').fill(local(start));
  await ed.getByLabel('Ends').fill(local(new Date(start.getTime() + 30 * 60e3)));
  await ed.getByRole('button', { name: /15 min before/ }).click(); // off
  await ed.getByRole('button', { name: 'At the time' }).click();   // on
  await ed.getByLabel('Place').fill('Home');
  await ed.getByRole('button', { name: 'Save' }).click();
  await expect(cal(P).getByRole('button', { name: /Call Maa/ }).first()).toBeVisible();

  await tab(P, 'Chats').click(); // reminders show whichever tab is open
  const toast = P.page.locator('[data-sonner-toast]').filter({ hasText: 'Call Maa' });
  await expect(toast).toBeVisible({ timeout: 100_000 });
  await expect(toast).toContainText('Now');
  await expect(toast).toContainText('Home');
  await P.page.screenshot({ path: shots('71-reminder') });
  await toast.getByRole('button', { name: 'Open' }).click();
  await expect(cal(P).getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
});

test('a holiday, and an event every lunar month on its tithi', async () => {
  const day = new Date(Date.now() + 3 * 86400e3);
  const key = local(day).slice(0, 10);
  await cal(P).getByRole('button', { name: 'Add', exact: true }).click();
  const ed = P.page.getByRole('dialog'); // "New event", then "New holiday"
  await ed.getByRole('radio', { name: /Holiday/ }).click();
  await ed.getByLabel('Title').fill('Goa trip');
  await ed.getByLabel('From').fill(key);
  await ed.getByLabel('To').fill(local(new Date(day.getTime() + 2 * 86400e3)).slice(0, 10));
  await ed.getByRole('button', { name: 'Save' }).click();

  await cal(P).getByRole('button', { name: 'Add', exact: true }).click();
  await ed.getByLabel('Title').fill('Satyanarayan katha');
  await ed.getByRole('button', { name: /Repeat/ }).click();
  await ed.getByRole('radio', { name: /Every lunar month on/ }).click();
  await ed.getByRole('button', { name: 'Save' }).click();

  await cal(P).getByRole('tab', { name: 'Upcoming' }).click();
  await expect(cal(P).getByRole('button', { name: /Goa trip/ })).toHaveCount(3); // three days
  expect(await cal(P).getByRole('button', { name: /Satyanarayan katha/ }).count()).toBeGreaterThanOrEqual(2); // once a lunar month
  await P.page.screenshot({ path: shots('72-calendar-upcoming') });
});

test('fasts: plan one, then mark how it went', async () => {
  await cal(P).getByRole('tab', { name: 'Fasts' }).click();
  const first = cal(P).getByRole('listitem').filter({ has: P.page.getByRole('button', { name: 'Plan it' }) }).first();
  const name = (await first.locator('span.font-semibold').first().textContent())!;
  await first.getByRole('button', { name: 'Plan it' }).click();
  const planned = cal(P).getByRole('listitem').filter({ hasText: name }).first();
  await planned.getByRole('button', { name: 'Planned' }).click();
  const sheet = P.page.getByRole('dialog', { name: 'Your fast' });
  await sheet.getByRole('radio', { name: /Kept/ }).click();
  await sheet.getByRole('radio', { name: /Nirjala/ }).click();
  await sheet.getByLabel('Notes').fill('Only water in the evening');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(cal(P).getByRole('button', { name: new RegExp(name) }).filter({ hasText: 'Only water' })).toBeVisible();
  await P.page.screenshot({ path: shots('73-calendar-fasts') });
});

test('everything reaches my other device, still sealed on the way', async ({ browser }) => {
  P2 = await phone(browser, P.u, LAPTOP);
  await signIn(P2);
  await tab(P2, 'Calendar').click();
  await cal(P2).getByRole('tab', { name: 'Upcoming' }).click();
  await expect(cal(P2).getByRole('button', { name: /Goa trip/ }).first()).toBeVisible({ timeout: 20_000 });
  await cal(P2).getByRole('tab', { name: 'Fasts' }).click();
  await expect(cal(P2).getByText('Only water in the evening')).toBeVisible();
  // The server holds only ciphertext.
  const raw = await P2.page.evaluate(async () => {
    const s = await new Promise<any>((res) => { const r = indexedDB.open('chattrix'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('session'); g.onsuccess = () => res(g.result); }; });
    const res = await fetch('/api/items?app=calendar&since=0', { headers: { Authorization: 'Bearer ' + s.token } });
    return JSON.stringify(await res.json());
  });
  expect(raw).not.toContain('Goa');
  expect(raw).not.toContain('Only water');
  expect([...P.errors, ...P2.errors]).toEqual([]);
});

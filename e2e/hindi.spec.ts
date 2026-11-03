// End-to-end: Sanga in Hindi. English is the default; Settings → Language switches every screen (the
// shell and the apps it loads) at once, it stays after a reload, nothing that has a translation is
// left in English, the phone layout still fits, and switching back gives English again.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { phone, signUp, tab, uname, type Phone } from './helpers';

test.describe.configure({ mode: 'serial' });
let P: Phone;
const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

// All the Hindi, as the app has it: English → Hindi.
const DICT: Record<string, string> = {};
for (const ns of ['apps/shell/src', 'apps/split/src', 'apps/calendar/src', 'apps/notes/src', 'packages/ui/src', 'packages/sdk/src']) {
  const dir = path.join(ns, 'locales/hi');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')))
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, string | { other: string }>))
      DICT[k] = typeof v === 'string' ? v : v.other;
}
const hi = (en: string) => { expect(DICT[en], `a Hindi entry for "${en}"`).toBeTruthy(); return DICT[en]; };
// Words that read the same in both (names, symbols) can't show a missed translation.
const LEAKS = Object.keys(DICT).filter((k) => !/\{\w+\}/.test(k) && DICT[k] !== k && /[A-Za-z]{3,}/.test(k));

/** Text on the screen (and labels read aloud) that is English for which Hindi exists: the translation didn't apply there. */
async function leftovers(page: Page) {
  return page.evaluate((keys) => {
    const want = new Set(keys);
    const seen = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement!;
      if (!el.checkVisibility?.() || el.closest('[data-user-text], [contenteditable], input, textarea, [aria-hidden=true]')) continue;
      const s = n.textContent!.trim();
      if (want.has(s)) seen.add(s);
    }
    for (const el of document.querySelectorAll('[aria-label], [placeholder], [title]')) {
      if (!(el as HTMLElement).checkVisibility?.()) continue;
      for (const a of ['aria-label', 'placeholder', 'title']) { const v = el.getAttribute(a)?.trim(); if (v && want.has(v)) seen.add(v); }
    }
    return [...seen];
  }, LEAKS);
}
async function fits(page: Page, where: string) {
  const w = await page.evaluate(() => ({ vw: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(w.scroll, `${where}: wider than the phone in Hindi`).toBe(w.vw);
}
async function clean(page: Page, where: string) {
  await page.waitForTimeout(150);
  expect(await leftovers(page), `${where}: English left on screen`).toEqual([]);
  await fits(page, where);
}

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
  P = await phone(browser, uname('hin'));
});
test.afterAll(async () => { await P?.ctx.close(); });

test('English by default; Settings → Language → हिन्दी switches everything at once', async () => {
  await signUp(P);
  const html = P.page.locator('html');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(tab(P, 'Chats')).toBeVisible();
  await P.page.getByRole('button', { name: 'Profile and settings' }).click();
  await P.page.getByRole('button', { name: /Language/ }).click();
  await expect(P.page.getByRole('radio', { name: /English/ })).toHaveAttribute('aria-checked', 'true');
  await P.page.getByRole('radio', { name: /हिन्दी/ }).click();
  await expect(html).toHaveAttribute('lang', 'hi');
  await expect(P.page.getByRole('heading', { name: hi('Language') })).toBeVisible(); // still on the Language page, now in Hindi
  await expect(P.page.getByRole('radio', { name: /हिन्दी/ })).toHaveAttribute('aria-checked', 'true');
  await clean(P.page, 'Settings → Language');
  await P.page.screenshot({ path: shots('60-hindi-language') });
  await P.page.getByRole('button', { name: hi('Back') }).first().click();
  await expect(P.page.getByRole('banner').getByRole('heading', { name: hi('Settings') })).toBeVisible();
  await clean(P.page, 'Settings');
  await P.page.keyboard.press('Escape');
});

test('every app in Hindi: chats, stories, games, diary, calendar, split', async () => {
  await expect(tab(P, hi('Chats'))).toBeVisible();
  await clean(P.page, 'Chats');
  await P.page.screenshot({ path: shots('61-hindi-chats') });
  for (const [en, shot] of [['Stories', '62-hindi-stories'], ['Games', '63-hindi-games'], ['Diary', '64-hindi-diary'], ['Calendar', '65-hindi-calendar'], ['Split', '66-hindi-split']] as const) {
    await tab(P, hi(en)).click();
    await expect(tab(P, hi(en))).toHaveAttribute('aria-selected', 'true');
    await P.page.waitForTimeout(400); // the app's own words load with it
    await clean(P.page, en);
    await P.page.screenshot({ path: shots(shot) });
  }
  // Inside Split: a group with its tabs, and the add-expense form.
  const split = P.page.getByRole('region', { name: hi('Split') }).or(P.page.getByRole('region', { name: 'Split' })).first();
  await split.getByRole('button', { name: hi('New group') }).click();
  const ng = P.page.getByRole('dialog', { name: hi('New group') });
  await clean(P.page, 'Split → New group');
  await ng.locator('input').first().fill('परिवार');
  await ng.getByRole('button', { name: hi('Create group') }).click();
  await expect(split.getByRole('heading', { name: 'परिवार' })).toBeVisible();
  await clean(P.page, 'Split → group');
  for (const en of ['Balances', 'Insights', 'People', 'Activity']) {
    await split.getByRole('tab', { name: new RegExp(hi(en)) }).click();
    await clean(P.page, `Split → ${en}`);
  }
  await split.getByRole('tab', { name: new RegExp(hi('Expenses')) }).click();
  await split.getByRole('button', { name: hi('Add expense') }).click();
  await clean(P.page, 'Split → add expense');
  await P.page.screenshot({ path: shots('67-hindi-add-expense') });
  await P.page.keyboard.press('Escape');
  // Calendar → Cards.
  await tab(P, hi('Calendar')).click();
  const cal = P.page.getByRole('region', { name: hi('Calendar') }).or(P.page.getByRole('region', { name: 'Calendar' })).first();
  await cal.getByRole('tab', { name: hi('Cards') }).click();
  await clean(P.page, 'Calendar → Cards');
});

test('Hindi stays after a reload; switching back gives English', async () => {
  await P.page.reload();
  await expect(P.page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(tab(P, hi('Chats'))).toBeVisible({ timeout: 20_000 });
  await tab(P, hi('Chats')).click();
  await P.page.getByRole('button', { name: hi('Profile and settings') }).click();
  await P.page.getByRole('button', { name: new RegExp(hi('Language')) }).click();
  await P.page.getByRole('radio', { name: /English/ }).click();
  await expect(P.page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(P.page.getByRole('heading', { name: 'Language' })).toBeVisible();
  await P.page.keyboard.press('Escape');
  await expect(tab(P, 'Chats')).toBeVisible();
  expect(P.errors).toEqual([]);
});

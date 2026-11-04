// End-to-end: Sanga in Hindi and in Marathi. English is the default; Settings → Language switches every
// screen (the shell and the apps it loads) at once, it stays after a reload, nothing that has a
// translation is left in English, the phone layout still fits, and switching away gives the other language.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, phone, signUp, tab, uname, type Phone } from './helpers';

const shots = (name: string) => `e2e/.artifacts/screens/${name}.png`;

/** All of one language, as the app has it: English → that language. */
function dictOf(lang: string) {
  const dict: Record<string, string> = {};
  for (const ns of ['apps/shell/src', 'apps/split/src', 'apps/calendar/src', 'apps/notes/src', 'packages/ui/src', 'packages/sdk/src']) {
    const dir = path.join(ns, 'locales', lang);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')))
      for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, string | { other: string }>))
        dict[k] = typeof v === 'string' ? v : v.other;
  }
  return dict;
}

/** Text on the screen (and labels read aloud) that is English for which a translation exists: it didn't apply there. */
async function leftovers(page: Page, leaks: string[]) {
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
  }, leaks);
}

const LANGS = [
  { id: 'hi', name: 'हिन्दी', english: 'Hindi', other: { id: 'mr', name: 'मराठी' }, group: 'परिवार' },
  { id: 'mr', name: 'मराठी', english: 'Marathi', other: { id: 'hi', name: 'हिन्दी' }, group: 'कुटुंब' },
] as const;

for (const L of LANGS) test.describe(L.english, () => {
  test.describe.configure({ mode: 'serial' });
  let P: Phone;
  const DICT = dictOf(L.id);
  const OTHER = dictOf(L.other.id);
  const tr = (en: string) => { expect(DICT[en], `a ${L.english} entry for "${en}"`).toBeTruthy(); return DICT[en]; };
  // Words that read the same in both (names, symbols) can't show a missed translation.
  const LEAKS = Object.keys(DICT).filter((k) => !/\{\w+\}/.test(k) && DICT[k] !== k && /[A-Za-z]{3,}/.test(k));
  async function fits(page: Page, where: string) {
    const w = await page.evaluate(() => ({ vw: innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(w.scroll, `${where}: wider than the phone in ${L.english}`).toBe(w.vw);
  }
  async function clean(page: Page, where: string) {
    await page.waitForTimeout(150);
    expect(await leftovers(page, LEAKS), `${where}: English left on screen`).toEqual([]);
    await fits(page, where);
  }

  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync('e2e/.artifacts/screens', { recursive: true });
    P = await phone(browser, uname(L.id + 'lng'));
  });
  test.afterAll(async () => { await P?.ctx.close(); });

  test(`English by default; Settings → Language → ${L.name} switches everything at once`, async () => {
    await signUp(P);
    const html = P.page.locator('html');
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(tab(P, 'Chats')).toBeVisible();
    await P.page.getByRole('button', { name: 'Profile and settings' }).click();
    await P.page.getByRole('button', { name: /Language/ }).click();
    await expect(P.page.getByRole('radio', { name: /English/ })).toHaveAttribute('aria-checked', 'true');
    await P.page.getByRole('radio', { name: L.name }).click();
    await expect(html).toHaveAttribute('lang', L.id);
    await expect(P.page.getByRole('heading', { name: tr('Language') })).toBeVisible(); // still on the Language page, now in it
    await expect(P.page.getByRole('radio', { name: L.name })).toHaveAttribute('aria-checked', 'true');
    await clean(P.page, 'Settings → Language');
    await P.page.screenshot({ path: shots(`60-${L.english.toLowerCase()}-language`) });
    await P.page.getByRole('button', { name: tr('Back') }).first().click();
    await expect(P.page.getByRole('banner').getByRole('heading', { name: tr('Settings') })).toBeVisible();
    await clean(P.page, 'Settings');
    await P.page.keyboard.press('Escape');
  });

  test(`every app in ${L.english}: chats, stories, games, diary, calendar, split`, async () => {
    await expect(tab(P, tr('Chats'))).toBeVisible();
    await clean(P.page, 'Chats');
    await P.page.screenshot({ path: shots(`61-${L.english.toLowerCase()}-chats`) });
    for (const [en, shot] of [['Stories', `62-${L.english.toLowerCase()}-stories`], ['Games', `63-${L.english.toLowerCase()}-games`], ['Diary', `64-${L.english.toLowerCase()}-diary`], ['Calendar', `65-${L.english.toLowerCase()}-calendar`], ['Split', `66-${L.english.toLowerCase()}-split`]] as const) {
      const inMore = en === 'Games' || en === 'Diary';
      if (inMore) await openApp(P, tr(en), tr('More')); else await tab(P, tr(en)).click();
      await expect(tab(P, tr(inMore ? 'More' : en))).toHaveAttribute('aria-selected', 'true');
      await P.page.waitForTimeout(400); // the app's own words load with it
      await clean(P.page, en);
      await P.page.screenshot({ path: shots(shot) });
    }
    // Inside Split: a group with its tabs, and the add-expense form.
    const split = P.page.getByRole('region', { name: tr('Split') }).or(P.page.getByRole('region', { name: 'Split' })).first();
    await split.getByRole('button', { name: tr('New group') }).click();
    const ng = P.page.getByRole('dialog', { name: tr('New group') });
    await clean(P.page, 'Split → New group');
    await ng.locator('input').first().fill(L.group);
    await ng.getByRole('button', { name: tr('Create group') }).click();
    await expect(split.getByRole('heading', { name: L.group })).toBeVisible();
    await clean(P.page, 'Split → group');
    for (const en of ['Balances', 'Insights', 'People', 'Activity']) {
      await split.getByRole('tab', { name: new RegExp(tr(en)) }).click();
      await clean(P.page, `Split → ${en}`);
    }
    await split.getByRole('tab', { name: new RegExp(tr('Expenses')) }).click();
    await split.getByRole('button', { name: tr('Add expense') }).click();
    await clean(P.page, 'Split → add expense');
    await P.page.screenshot({ path: shots(`67-${L.english.toLowerCase()}-add-expense`) });
    await P.page.keyboard.press('Escape');
    // Calendar → Cards.
    await tab(P, tr('Calendar')).click();
    const cal = P.page.getByRole('region', { name: tr('Calendar') }).or(P.page.getByRole('region', { name: 'Calendar' })).first();
    await cal.getByRole('tab', { name: tr('Cards') }).click();
    await clean(P.page, 'Calendar → Cards');
  });

  test(`${L.english} stays after a reload; switching to ${L.other.name} and back to English`, async () => {
    await P.page.reload();
    await expect(P.page.locator('html')).toHaveAttribute('lang', L.id);
    await expect(tab(P, tr('Chats'))).toBeVisible({ timeout: 20_000 });
    await tab(P, tr('Chats')).click();
    await P.page.getByRole('button', { name: tr('Profile and settings') }).click();
    await P.page.getByRole('button', { name: new RegExp(tr('Language')) }).click();
    // Straight to the other language: its words, none of this one's left behind.
    await P.page.getByRole('radio', { name: L.other.name }).click();
    await expect(P.page.locator('html')).toHaveAttribute('lang', L.other.id);
    await expect(P.page.getByRole('heading', { name: OTHER['Language'] })).toBeVisible();
    await P.page.getByRole('radio', { name: /English/ }).click();
    await expect(P.page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(P.page.getByRole('heading', { name: 'Language' })).toBeVisible();
    await P.page.keyboard.press('Escape');
    await expect(tab(P, 'Chats')).toBeVisible();
    expect(P.errors).toEqual([]);
  });
});

// Sanga's translations. The English is written in the code and is also the key: t('Add expense').
// Another language is a dictionary from that English to the translation; each app (and the UI kit)
// has its own, loaded only when that language is on. The shell and every app bundle their own copy
// of this module, so they all keep one state on globalThis: switching the language reaches all of them.
import { createElement, Fragment, useSyncExternalStore, type ReactNode } from 'react';

export type Lang = 'en' | 'hi' | 'mr';
/** The languages you can pick, each named in itself. */
export const LANGS: { id: Lang; name: string; english: string }[] = [
  { id: 'en', name: 'English', english: 'English' },
  { id: 'hi', name: 'हिन्दी', english: 'Hindi' },
  { id: 'mr', name: 'मराठी', english: 'Marathi' },
];
export type Entry = string | { one: string; other: string };
export type Dict = Record<string, Entry>;
export type Loader = () => Promise<Dict>;

const KEY = 'sanga-lang';
interface State { lang: Lang; dicts: Partial<Record<Lang, Dict>>; version: number; subs: Set<() => void>; loaders: Map<string, Partial<Record<Lang, Loader>>>; loaded: Map<string, Promise<void>>; ready: Set<string> }
const isLang = (l: unknown): l is Lang => LANGS.some((x) => x.id === l);
const readLang = (): Lang => { try { const l = localStorage.getItem(KEY); return isLang(l) ? l : 'en'; } catch { return 'en'; } };
const G = globalThis as typeof globalThis & { __sangaI18n?: State };
const S: State = (G.__sangaI18n ??= { lang: readLang(), dicts: {}, version: 0, subs: new Set(), loaders: new Map(), loaded: new Map(), ready: new Set() });

const notify = () => { S.version++; for (const f of S.subs) f(); };
const setHtmlLang = () => { if (typeof document !== 'undefined') document.documentElement.lang = S.lang; };
setHtmlLang();

/** The language now on. English unless you picked another in Settings. */
export const lang = () => S.lang;
// Marathi would otherwise write numbers in Devanagari digits; amounts and dates keep 0-9, as in Hindi.
const LOCALES: Partial<Record<Lang, string>> = { hi: 'hi-IN', mr: 'mr-IN-u-nu-latn' };
/** For Intl and toLocale…(): the browser's own for English (as before), the language's otherwise. */
export const locale = (): string | undefined => LOCALES[S.lang];

const fill = (s: string, vars?: Record<string, string | number>) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);
const lookup = (en: string) => (S.lang === 'en' ? undefined : S.dicts[S.lang]?.[en]);

/** The text in the language now on (English if it has no translation yet). `{name}` is filled from `vars`. */
export function t(en: string, vars?: Record<string, string | number>): string {
  const e = lookup(en);
  return fill(typeof e === 'string' ? e : e ? e.other : en, vars);
}

/** Marks English to translate later, where it's written (a list of labels): show it with t(label). */
export const tk = <T extends string>(en: T): T => en;

/** One or many: tn(3, '{n} expense', '{n} expenses'). The dictionary keeps it under the many form. */
export function tn(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  const e = lookup(other);
  const many = S.lang === 'en' ? n !== 1 : new Intl.PluralRules(locale()).select(n) !== 'one';
  const s = typeof e === 'string' ? e : e ? (many ? e.other : e.one) : many ? other : one;
  return fill(s, { n, ...vars });
}

/** Like t(), with parts that are elements: tx('{who} paid {amount}', { who: <b>Ravi</b>, amount: … }). */
export function tx(en: string, parts: Record<string, ReactNode>): ReactNode {
  const s = t(en);
  const out: ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of s.matchAll(/\{(\w+)\}/g)) {
    if (!(m[1] in parts)) continue;
    if (m.index! > last) out.push(s.slice(last, m.index));
    out.push(createElement(Fragment, { key: i++ }, parts[m[1]]));
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return createElement(Fragment, null, ...out);
}

function load(ns: string, l: Lang = S.lang, quiet = false): Promise<void> {
  const key = ns + ':' + l;
  const loader = S.loaders.get(ns)?.[l];
  if (l === 'en' || !loader) return Promise.resolve();
  let p = S.loaded.get(key);
  if (!p) {
    p = loader().then((d) => {
      Object.assign((S.dicts[l] ??= {}), (d as { default?: Dict }).default ?? d);
      S.ready.add(key);
      if (!quiet) notify();
    }, () => { S.loaded.delete(key); });
    S.loaded.set(key, p);
  }
  return p;
}

/** An app's (or the UI kit's) dictionaries, by language. Loads the one for the language now on. */
export function register(ns: string, loaders: Partial<Record<Lang, Loader>>): Promise<void> {
  if (!S.loaders.has(ns)) S.loaders.set(ns, loaders);
  return load(ns);
}

/** Switch the language everywhere, and remember it on this device. Resolves once its words are here. */
export async function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked: for this visit only */ }
  // The words first, then the switch: everything redraws once, already in the new language.
  await Promise.all([...S.loaders.keys()].map((ns) => load(ns, l, true)));
  S.lang = l;
  setHtmlLang();
  notify();
}

const subscribe = (f: () => void) => { S.subs.add(f); return () => { S.subs.delete(f); }; };
/** Re-renders when the language changes or more words arrive; returns the language (a key for the
 *  root, so everything redraws in it). */
export function useLang(): Lang {
  useSyncExternalStore(subscribe, () => S.version);
  return S.lang;
}

/** Dictionaries split into parts (import.meta.glob of locales/<lang>/*.json), as one loader. */
export const fromParts = (parts: Record<string, () => Promise<unknown>>): Loader => async () =>
  Object.assign({}, ...(await Promise.all(Object.values(parts).map(async (f) => { const m = await f() as { default?: Dict }; return m.default ?? m; }))));

/** For an app's root: registers its dictionaries and, until the ones for the language now on are here,
 *  suspends (the Suspense around it shows its fallback). English needs nothing. */
export function useI18n(dicts: Record<string, Partial<Record<Lang, Loader>>>) {
  useLang();
  const waiting = Object.entries(dicts).filter(([ns, l]) => S.lang !== 'en' && l[S.lang] && !S.ready.has(ns + ':' + S.lang));
  for (const [ns, l] of Object.entries(dicts)) void register(ns, l);
  if (waiting.length) throw Promise.all(waiting.map(([ns]) => load(ns)));
}

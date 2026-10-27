// An app opened on its own page (e.g. /apps/notes/), without the shell. It uses the sign-in this
// device already has (the same browser storage as the main app) and its own connection to the
// server. Not signed in yet: it points to the main app to sign in. With an app lock or "sign out when
// I close the tab" on, it goes to the main app instead, which enforces them (see guarded()).
import { createElement, useEffect, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { confirm, ConfirmHost } from '@sanga/ui/confirm';
import { assertAppFrame, provideSdk, scopedStore, type AppProps, type Sdk } from '@sanga/sdk'; // by name: the same shared copy the app uses

const DB_NAME = 'chattrix'; // the main app's on-device database (named before the app became Sanga)

let dbp: Promise<IDBDatabase> | null = null;
function db() {
  return (dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME); // whatever version the main app made: never upgrade it from here
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
const wrap = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function kv(mode: IDBTransactionMode = 'readonly') {
  const d = await db();
  if (!d.objectStoreNames.contains('kv')) throw new Error('Not signed in');
  return d.transaction('kv', mode).objectStore('kv');
}

interface Session { u: string; token: string; priv: CryptoKey; pub: string }

function createSdk(s: Session): Sdk {
  const listeners = new Map<string, Set<(m: any) => void>>();
  const ready = new Set<() => void>();
  let online = false;
  const onlineSubs = new Set<(on: boolean) => void>();
  const setOnline = (on: boolean) => { online = on; onlineSubs.forEach((f) => f(on)); };

  // One connection, reconnecting with backoff.
  let backoff = 1000;
  const connect = () => {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    let ping = 0;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: s.token, act: document.visibilityState === 'visible' }));
    ws.onmessage = (e) => {
      let m: any;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'ok') {
        backoff = 1000;
        ping = window.setInterval(() => ws.send('{"t":"p"}'), 20_000);
        setOnline(true);
        ready.forEach((f) => f());
      }
      listeners.get(m.t)?.forEach((f) => f(m));
    };
    ws.onclose = () => {
      clearInterval(ping);
      setOnline(false);
      setTimeout(connect, backoff * (0.5 + Math.random()));
      backoff = Math.min(backoff * 2, 30_000);
    };
  };
  connect();

  const people: { peer: string; name: string }[] = [];
  let peopleLoaded: Promise<void> | null = null;
  const subs = new Set<() => void>();
  const api = async <T,>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.token },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    }).catch(() => { throw new Error('No connection. Check your internet and try again.'); });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  };

  return {
    identity: () => ({ me: s.u, priv: s.priv, pub: s.pub }),
    api,
    on(type, fn) {
      assertAppFrame(type); // the same rule as in the shell, so an app behaves the same in both
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
      return () => listeners.get(type)!.delete(fn);
    },
    onReady(fn) { ready.add(fn); return () => ready.delete(fn); },
    // The main app's table, sign-in token and group keys included: apps only get their own keys.
    store: scopedStore({
      get: async (k) => wrap((await kv()).get(k)),
      put: async (k, v) => { await wrap((await kv('readwrite')).put(v, k)); },
      del: async (k) => { await wrap((await kv('readwrite')).delete(k)); },
      prefix: async (p) => wrap((await kv()).getAll(IDBKeyRange.bound(p, p + '\uffff'))),
    }),
    useOnline() {
      const [on, set] = useState(online);
      useEffect(() => { onlineSubs.add(set); return () => { onlineSubs.delete(set); }; }, []);
      return on;
    },
    useChats() {
      const [, bump] = useState(0);
      useEffect(() => {
        const f = () => bump((n) => n + 1);
        subs.add(f);
        peopleLoaded ??= Promise.all([
          api<{ friends: { u: string; name: string }[] }>('/api/friends'),
          api<{ groups: { id: string; name: string }[] }>('/api/groups'),
        ]).then(([f, g]) => {
          people.push(...f.friends.map((x) => ({ peer: x.u, name: x.name || x.u })), ...g.groups.map((x) => ({ peer: 'g:' + x.id, name: x.name })));
          subs.forEach((fn) => fn());
        }).catch(() => { peopleLoaded = null; });
        return () => { subs.delete(f); };
      }, []);
      return people;
    },
    confirm,
    Avatar: Initial,
  };
}

// Photos come from the main app's cache there; on its own an app shows the coloured initial.
const hue = (name: string) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };
function Initial({ u, name, size = 40, className }: { u: string; name?: string; size?: number; className?: string }) {
  return createElement('span', {
    className: 'grid shrink-0 place-items-center rounded-full font-semibold text-white ' + (className || ''),
    style: { width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue(u)} 45% 48%)` }, 'aria-hidden': true,
  }, (name || u).replace(/^g:/, '')[0]?.toUpperCase() || '?');
}

// The main app's settings (apps/shell/src/state/settings.ts, zustand persist). This page has no PIN
// screen and can't tell a closed tab from a new one, so with an app lock or "sign out when I close
// the tab" on it doesn't show the app: the main app does, after its lock screen or sign-out check.
// Unreadable settings count as on: the main app then decides.
const SETTINGS = 'chattrix-settings';
function guarded() {
  try {
    const raw = localStorage.getItem(SETTINGS);
    if (!raw) return false;
    const s = JSON.parse(raw).state || {};
    return !!s.appLock || !!s.signOutOnClose;
  } catch { return true; }
}

/** Start an app on its own page. */
export async function bootStandalone(App: ComponentType<AppProps>) {
  if (guarded()) { location.replace('/'); return; }
  // Turned on in another tab while this page is open: leave too.
  window.addEventListener('storage', (e) => { if ((e.key === SETTINGS || e.key === null) && guarded()) location.replace('/'); });
  const root = createRoot(document.getElementById('root')!);
  let session: Session | undefined;
  try { session = await wrap((await kv()).get('session')); } catch { /* no database yet */ }
  if (!session) {
    root.render(createElement('div', { className: 'grid h-full place-items-center p-8 text-center' },
      createElement('div', null,
        createElement('p', { className: 'mb-4 text-muted' }, 'Sign in to Sanga first.'),
        createElement('a', { href: '/', className: 'rounded-xl bg-accent px-5 py-2.5 font-medium text-white' }, 'Open Sanga'))));
    return;
  }
  provideSdk(createSdk(session));
  const params = Object.fromEntries(new URLSearchParams(location.search));
  root.render(createElement('div', { className: 'mx-auto flex h-full max-w-xl flex-col bg-bg' },
    createElement(App, { params, onClose: () => { location.href = '/'; } }),
    createElement(ConfirmHost)));
}

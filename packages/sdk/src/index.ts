// The contract between the Sanga shell and its apps (Diary, and later Games, Split, …).
// An app never imports the shell or another app: it gets everything it needs from here. The shell
// provides the real implementation (its own connection, keys and storage); an app opened on its own
// page gets the standalone one (./standalone). Keep this small and stable: changing it means
// changing every app.
import type { ComponentType } from 'react';

export interface Sdk {
  /** Who is signed in. `priv` is the identity key: usable for encryption, never readable. */
  identity(): { me: string; priv: CryptoKey | null; pub: string };
  /** A request to the Sanga server, signed in. Throws with a readable message on failure. */
  api<T = any>(path: string, body?: unknown): Promise<T>;
  /** Live messages of one type from the server. Only the types in APP_FRAMES (e.g. 'notes'); any
   *  other throws. Returns a function that stops listening. */
  on(type: string, fn: (m: any) => void): () => void;
  /** Runs each time the connection to the server is (re)established. Returns a function that stops it. */
  onReady(fn: () => void): () => void;
  /** This device's storage, limited to the apps' own keys (see storeKeyAllowed): the shell's keys
   *  (sign-in token, group keys, cached messages) throw. */
  store: {
    get<T = any>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    del(key: string): Promise<void>;
    prefix<T = any>(prefix: string): Promise<T[]>;
  };
  /** React hook: whether the live connection to the server is up. */
  useOnline(): boolean;
  /** React hook: your friends and groups, e.g. to file a note under a chat. Peers: 'username' or 'g:<id>'. */
  useChats(): { peer: string; name: string }[];
  /** Ask before something that can't be undone. Resolves true if confirmed. */
  confirm(o: { title: string; description?: string; confirmText?: string; destructive?: boolean }): Promise<boolean>;
  /** A person's or group's photo (or initial). */
  Avatar: ComponentType<{ u: string; name?: string; size?: number; className?: string }>;
}

/** What the shell gives an app's main component. */
export interface AppProps {
  /** Leave the app (back to the chats). */
  onClose(): void;
  /** Where to open it, e.g. { chat: 'ravi' } for "Notes about this chat". */
  params: Record<string, string>;
  /** Shown as one of Sanga's bottom tabs: there's nothing to go back to, so no back button. */
  tab?: boolean;
}

/** The live message types apps may receive. The shell handles every other type itself (messages,
 *  calls, stories, games…); an app neither sees those nor can take them over. Add a type here when
 *  an app's server part (server/<name>.js) sends a new one. */
export const APP_FRAMES: readonly string[] = ['notes'];

export function assertAppFrame(type: string) {
  if (!APP_FRAMES.includes(type)) throw new Error(`Apps can't listen to “${type}” messages`);
}

/** The storage keys apps may use: the diary's ('note/<id>', 'notesSince', from before this rule) and
 *  'app/<appId>/…' for every other app. Everything else on the device belongs to the shell. The rule
 *  keeps apps away from the shell's secrets; between apps the appId is a convention, not enforced. */
export function storeKeyAllowed(key: string) {
  return typeof key === 'string' && (key.startsWith('note/') || key === 'notesSince' || /^app\/[^/]+\//.test(key));
}
/** For prefix(): the prefix itself must lie inside an app's keys, so the range can't reach the shell's. */
const prefixAllowed = (p: string) => typeof p === 'string' && (p.startsWith('note/') || /^app\/[^/]+\//.test(p));

/** Wraps a device store so apps only reach their own keys. */
export function scopedStore(s: Sdk['store']): Sdk['store'] {
  const check = (ok: boolean, k: string) => { if (!ok) throw new Error(`Apps can't use the storage key “${k}”`); };
  return {
    get: async (k) => { check(storeKeyAllowed(k), k); return s.get(k); },
    put: async (k, v) => { check(storeKeyAllowed(k), k); return s.put(k, v); },
    del: async (k) => { check(storeKeyAllowed(k), k); return s.del(k); },
    prefix: async (p) => { check(prefixAllowed(p), p); return s.prefix(p); },
  };
}

let current: Sdk | null = null;

/** The shell (or a standalone page) calls this once, before any app loads. */
export function provideSdk(s: Sdk) { current = s; }

/** The SDK, inside an app. */
export function sdk(): Sdk {
  if (!current) throw new Error('Sanga SDK not provided: load this app through the shell or its standalone page');
  return current;
}

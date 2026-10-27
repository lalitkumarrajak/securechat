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
  /** Live messages of one type from the server (e.g. 'notes'). Returns a function that stops listening. */
  on(type: string, fn: (m: any) => void): () => void;
  /** Runs each time the connection to the server is (re)established. Returns a function that stops it. */
  onReady(fn: () => void): () => void;
  /** This device's storage. Apps use their own key prefix ('note/…'). */
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
}

let current: Sdk | null = null;

/** The shell (or a standalone page) calls this once, before any app loads. */
export function provideSdk(s: Sdk) { current = s; }

/** The SDK, inside an app. */
export function sdk(): Sdk {
  if (!current) throw new Error('Sanga SDK not provided: load this app through the shell or its standalone page');
  return current;
}

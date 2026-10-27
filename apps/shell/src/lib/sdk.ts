// The shell's side of the Sanga SDK (@sanga/sdk): what the other apps (Diary, …) get to use. It hands
// them this app's connection, keys, storage and people, so an app never needs the shell's internals.
import { assertAppFrame, provideSdk, scopedStore, type Sdk } from '@sanga/sdk';
import { confirm } from '@sanga/ui/confirm';
import * as db from './db';
import { api, frameHooks, ownIdentity, readyHooks } from './engine';
import { Avatar } from '../components/Avatar';
import { displayName } from './types';
import { useApp } from '../state/app';
import { useMemo } from 'react';

const listeners = new Map<string, Set<(m: any) => void>>();

export const shellSdk: Sdk = {
  identity: ownIdentity,
  api,
  on(type, fn) {
    assertAppFrame(type); // only app types: frameHooks.call, .story, … are the shell's own
    if (!listeners.has(type)) {
      if (Object.hasOwn(frameHooks, type)) throw new Error(`“${type}” messages are the shell's`);
      listeners.set(type, new Set());
      frameHooks[type] = (m) => listeners.get(type)!.forEach((f) => f(m));
    }
    listeners.get(type)!.add(fn);
    return () => listeners.get(type)!.delete(fn);
  },
  onReady(fn) {
    readyHooks.push(fn);
    return () => { const i = readyHooks.indexOf(fn); if (i >= 0) readyHooks.splice(i, 1); };
  },
  // The same table holds the sign-in token and group keys: apps only get their own keys.
  store: scopedStore({
    get: (k) => db.get('kv', k),
    put: async (k, v) => { await db.put('kv', v, k); },
    del: async (k) => { await db.del('kv', k); },
    prefix: (p) => db.kvPrefix(p),
  }),
  useOnline: () => useApp((s) => s.conn === 'online'),
  useChats() {
    const friends = useApp((s) => s.friends);
    const groups = useApp((s) => s.groups);
    return useMemo(() => [
      ...Object.values(friends).map((f) => ({ peer: f.u, name: displayName(f, f.u) })),
      ...Object.values(groups).map((g) => ({ peer: 'g:' + g.id, name: g.name })),
    ], [friends, groups]);
  },
  confirm,
  Avatar,
};

provideSdk(shellSdk);

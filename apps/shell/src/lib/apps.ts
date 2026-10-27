// The other Sanga apps (Diary, and later Games, Split, …), each built and deployed on its own.
// Nothing about them is downloaded until one is opened: the first time, the shell fetches the list
// of apps (/apps.json, a few hundred bytes), registers them, and loads just that app's code.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { loadRemote, registerRemotes } from '@module-federation/runtime';
import type { AppProps } from '@sanga/sdk';
import './sdk';

export interface AppInfo { id: string; name: string; icon: string; entry: string; expose: string }

let list: Promise<AppInfo[]> | null = null;
function apps() {
  return (list ??= fetch('/apps.json').then((r) => {
    if (!r.ok) throw new Error('apps');
    return r.json() as Promise<AppInfo[]>;
  }).then((a) => {
    registerRemotes(a.map((x) => ({ name: x.id, entry: x.entry, type: 'module' })));
    return a;
  }).catch((e) => { list = null; throw e; }));
}

const loaded = new Map<string, LazyExoticComponent<ComponentType<AppProps>>>();
/** An app's main component, downloaded the first time it renders (keep it inside <Suspense>). */
export function appComponent(id: string) {
  if (!loaded.has(id)) {
    loaded.set(id, lazy(async () => {
      const info = (await apps()).find((a) => a.id === id);
      if (!info) throw new Error(`No app “${id}”`);
      const mod = await loadRemote<{ default: ComponentType<AppProps> }>(`${id}/${info.expose.replace(/^\.\//, '')}`);
      if (!mod) throw new Error(`Couldn’t load “${id}”`);
      return mod;
    }));
  }
  return loaded.get(id)!;
}

/** Forget a failed load, so "Try again" downloads it afresh: the runtime and the browser both remember
 *  a failed download, so the app is registered again under a new address. */
let attempts = 0;
export async function retryApp(id: string) {
  loaded.delete(id);
  const info = (await apps().catch(() => [])).find((a) => a.id === id);
  if (info) registerRemotes([{ name: id, entry: `${info.entry}?retry=${++attempts}`, type: 'module' }], { force: true });
}

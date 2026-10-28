// The other Sanga apps (Diary, and later Games, Split, …), each built and deployed on its own.
// Nothing about them is downloaded until one is opened: the first time, the shell fetches the list
// of apps (/apps.json, a few hundred bytes), registers them, and loads just that app's code.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { loadRemote, registerRemotes } from '@module-federation/runtime';
import type { AppProps } from '@sanga/sdk';
import './sdk';
import * as db from './db';

export interface AppInfo { id: string; name: string; icon: string; entry: string; expose: string; background?: string }

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

/** Apps you've used that do some work when Sanga starts (the calendar keeps its reminders current)
 *  register here ('app/bg/<id>'), and their `background` module runs once Sanga has settled. Nothing
 *  is downloaded for apps that haven't registered. */
export async function runBackgrounds() {
  const ids = (await db.kvPrefix('app/bg/').catch(() => [])) as unknown[];
  if (!ids.length) return;
  const list = await apps().catch(() => [] as AppInfo[]);
  for (const a of list) {
    if (!a.background || !ids.includes(a.id)) continue;
    try {
      const mod = await loadRemote<{ default: () => Promise<void> }>(`${a.id}/${a.background.replace(/^\.\//, '')}`);
      await mod?.default();
    } catch (e) { console.warn(`${a.id} background`, e); }
  }
}

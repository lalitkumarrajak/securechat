// Games you play on your own (puzzles, arcade, cards), found by folder: each games/<id>/ has
//   meta.ts   — name, emoji, category, how-to steps: tiny, part of the Games page
//   Game.tsx  — the game itself (default export): downloaded only when you open it
// To add one: make the folder (see games/watersort/ for the pattern) and its locales/<lang>/solo-<id>.json.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { SoloMeta } from './kit';

const metas = import.meta.glob<{ default: SoloMeta }>('./games/*/meta.ts', { eager: true });
const games = import.meta.glob<{ default: ComponentType }>('./games/*/Game.tsx');

export interface SoloEntry extends SoloMeta { Game: LazyExoticComponent<ComponentType> }

const idOf = (p: string) => p.split('/')[2];
export const SOLO: SoloEntry[] = Object.entries(metas)
  .map(([p, m]) => {
    const load = games[`./games/${idOf(p)}/Game.tsx`];
    return load ? { ...m.default, Game: lazy(load) } : null;
  })
  .filter((x): x is SoloEntry => !!x)
  .sort((a, b) => a.order - b.order);

export const soloById = (id: string) => SOLO.find((g) => g.id === id);

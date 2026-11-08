// What every solo game shares: its description (meta.ts), saved progress, a seeded random source
// (fixed in tests), and the card shown when a level is done or the game is over.
import { useCallback, useState, type ReactNode } from 'react';
import { Button } from '@sanga/ui/button';
import { t } from '@sanga/i18n';

export type SoloCategory = 'puzzle' | 'arcade' | 'brain' | 'cards' | 'strategy' | 'casual' | 'adventure';

export interface SoloMeta {
  id: string;            // the folder name
  name: string;          // English, shown with t(): wrap in tk() in meta.ts
  emoji: string;
  category: SoloCategory;
  blurb: string;         // one short line, tk()
  steps: string[];       // how to play, a few short steps, tk()
  background: string;    // CSS background behind the game (dark: the header is white)
  order: number;         // place on the Games page
}

/** Saved on this device: `sanga-solo-<id>`. A level number, a best score, whatever the game keeps. */
export function useSaved<T>(id: string, init: T): [T, (v: T | ((old: T) => T)) => void] {
  const key = `sanga-solo-${id}`;
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s ? { ...init, ...JSON.parse(s) } : init; } catch { return init; } });
  const set = useCallback((x: T | ((old: T) => T)) => setV((old) => {
    const next = typeof x === 'function' ? (x as (o: T) => T)(old) : x;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* kept for this visit */ }
    return next;
  }), [key]);
  return [v, set];
}

/** A random source from a seed (mulberry32): int(n) is 0..n-1. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n: number) => Math.floor(next() * n), pick: <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)],
    shuffle: <T,>(xs: T[]) => { const r = [...xs]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; } };
}

/** A new seed; tests fix it with localStorage `sanga-solo-seed`, so a level is always the same. */
export function newSeed() {
  try { const s = localStorage.getItem('sanga-solo-seed'); if (s) return Number(s); } catch { /* random */ }
  return Math.floor(Math.random() * 2 ** 31);
}

/** Tests set `sanga-solo-test` so timed games (arcade) can be driven step by step. */
export const testMode = () => { try { return localStorage.getItem('sanga-solo-test') === '1'; } catch { return false; } };

/** The card over the game when a level is done or the game is over. */
export function ResultCard({ emoji, title, children, primary, secondary }: {
  emoji: string; title: string; children?: ReactNode;
  primary: { label: string; onClick: () => void }; secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-5 animate-fade-in" role="dialog" aria-label={title}>
      <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
        <div className="text-5xl" aria-hidden>{emoji}</div>
        <h2 className="mt-2 text-xl font-bold">{title}</h2>
        {children && <div className="mt-1 text-sm text-slate-600">{children}</div>}
        <div className="mt-5 flex gap-3">
          {secondary && <Button variant="secondary" className="flex-1" onClick={secondary.onClick}>{secondary.label}</Button>}
          <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600" onClick={primary.onClick}>{primary.label}</Button>
        </div>
      </div>
    </div>
  );
}

/** A row of small round buttons under the header: undo, restart, hint… */
export function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/25 disabled:opacity-40">
      {children}
    </button>
  );
}

export const levelLabel = (n: number) => t('Level {n}', { n });

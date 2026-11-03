import { tk } from '@sanga/i18n';
import type { FastStatus, FastType } from './model';

export const STATUS: Record<FastStatus, { label: string; emoji: string; tone: string }> = {
  planned: { label: tk('Planned'), emoji: '🗓️', tone: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
  kept: { label: tk('Kept'), emoji: '✅', tone: 'bg-green-500/12 text-green-700 dark:text-green-300' },
  partial: { label: tk('Partly kept'), emoji: '🌓', tone: 'bg-amber-500/12 text-amber-800 dark:text-amber-300' },
  broken: { label: tk('Broken'), emoji: '❌', tone: 'bg-rose-500/12 text-rose-700 dark:text-rose-300' },
};
export const FAST_TYPES: Record<FastType, string> = {
  nirjala: tk('Nirjala (no water)'), phalahar: tk('Phalahar (fruit, milk)'), 'one-meal': tk('One meal'), water: tk('Water only'), custom: tk('My own way'),
};

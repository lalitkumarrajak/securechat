import { card } from '@sanga/game-rules/uno.js';
import { t, tk } from '@sanga/i18n';
import type { Game } from '../../store';
import { UnoView } from './types';

export const HEX: Record<string, string> = { r: '#e5322d', y: '#f7c300', g: '#2fa84f', b: '#1e74d6', w: '#1c1c1c' };

/** English: show with t(). */
export const NAME: Record<string, string> = { r: tk('Red'), y: tk('Yellow'), g: tk('Green'), b: tk('Blue') };

export const nameOf = (g: Game<UnoView>, j: number) => g.players[j]?.n || g.players[j]?.u || '';

export function describe(id: number, color: string) {
  const k = card(id);
  const name = { skip: tk('Skip'), rev: tk('Reverse'), d2: tk('Draw Two'), wild: tk('Wild'), w4: tk('Wild Draw Four') }[k.v];
  const v = name ? t(name) : k.v;
  return k.c === 'w' ? t('{card}, {color}', { card: v, color: t(NAME[color]) }) : t('{color} {card}', { color: t(NAME[k.c]), card: v });
}

export const SIZES = { xs: 'h-[26px] w-[18px] rounded-[3px] border', md: 'h-24 w-16 rounded-xl border-[3px]', lg: 'h-[126px] w-[84px] rounded-2xl border-4' };

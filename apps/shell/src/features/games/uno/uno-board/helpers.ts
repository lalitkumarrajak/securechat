import { card } from '@sanga/game-rules/uno.js';
import type { Game } from '../../store';
import { UnoView } from './types';

export const HEX: Record<string, string> = { r: '#e5322d', y: '#f7c300', g: '#2fa84f', b: '#1e74d6', w: '#1c1c1c' };

export const NAME: Record<string, string> = { r: 'Red', y: 'Yellow', g: 'Green', b: 'Blue' };

export const nameOf = (g: Game<UnoView>, j: number) => g.players[j]?.n || g.players[j]?.u || '';

export function describe(id: number, color: string) {
  const k = card(id);
  const v = { skip: 'Skip', rev: 'Reverse', d2: 'Draw Two', wild: 'Wild', w4: 'Wild Draw Four' }[k.v] || k.v;
  return k.c === 'w' ? `${v}, ${NAME[color]}` : `${NAME[k.c]} ${v}`;
}

export const SIZES = { xs: 'h-[26px] w-[18px] rounded-[3px] border', md: 'h-24 w-16 rounded-xl border-[3px]', lg: 'h-[126px] w-[84px] rounded-2xl border-4' };

// Game coins (server/coins.js): the balance chip, and amounts written with the coin.
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { useGames } from './store';

export const COIN = '🪙';
export const BETS = [0, 100, 500, 1000, 5000, 10_000]; // as server/coins.js
export const EMOJI_COST = 10;
export const fmtCoins = (n: number) => n.toLocaleString();

export function CoinBalance({ className }: { className?: string }) {
  const n = useGames((s) => s.coins);
  if (n === null) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2.5 py-1 text-sm font-bold text-amber-950 tabular-nums shadow', className)}
      aria-label={t('{n} coins', { n: fmtCoins(n) })}>
      <span aria-hidden>{COIN}</span>{fmtCoins(n)}
    </span>
  );
}

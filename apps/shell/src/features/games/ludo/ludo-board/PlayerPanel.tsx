import { Avatar } from '../../../../components/Avatar';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { homeAt } from '@sanga/game-rules/ludo.js';
import type { Game } from '../../store';
import { TurnRing } from '../../TurnRing';
import { MentionText } from '../../MentionText';
import { Chances } from '../../Chances';
import { COLORS, COLOR_NAMES } from '../geometry';
import { LudoState, Shown } from './types';
import { Dice } from './Dice';

export function PlayerPanel({ g, i, me, shown, canRoll, onRoll, spinning, bubble, right, below, settled }: {
  g: Game<LudoState>; i: number; me: number; shown: Shown; canRoll: boolean; onRoll: () => void; spinning: boolean;
  bubble: string | null; right: boolean; below: boolean;
  settled: boolean; // no move is still being played back
}) {
  const pl = g.players[i];
  const arm = g.s.arm[i];
  const color = COLORS[arm];
  const active = g.status === 'play' && shown.turn === i && pl.state === 'playing';
  const gone = pl.state === 'left' || pl.state === 'out';
  const dice = spinning ? { s: i, d: 6, rolling: true } : shown.dice?.s === i ? shown.dice : null;
  const home = homeAt(g.s.arms);
  const homeCount = shown.tokens[i].filter((p) => p === home).length;
  // The place is shown once the last token has actually walked in (or the moves have all played, for a
  // player who is placed without finishing, e.g. last one left), not the moment the server records it.
  const rank = pl.rank && (homeCount === 4 || settled) ? pl.rank : 0;
  const missed = pl.missed || 0;
  const away = pl.state === 'playing' && missed > 0; // the server has been playing for them

  const avatar = (
    <div className="relative">
      <TurnRing active={active} deadline={g.deadline} color={color}>
        <div className={cn('rounded-xl border-[3px] bg-white p-0.5', gone && 'opacity-40 grayscale')} style={{ borderColor: color }}>
          <Avatar u={pl.u} name={pl.n} size={40} className="[&>*]:rounded-lg" />
        </div>
      </TurnRing>
      {rank === 1 && <span className="ludo-crown pointer-events-none absolute -top-5 left-1/2 z-10 -translate-x-1/2 text-2xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]" aria-label={t('Winner')} role="img">👑</span>}
      {rank ? <span className="ludo-rank-in absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-amber-400 text-xs font-bold text-amber-950 shadow">{rank}</span> : null}
      {bubble && (
        <div className={cn('ludo-bubble absolute z-20 max-w-[160px] rounded-2xl bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-lg',
          below ? 'bottom-full mb-2' : 'top-full mt-2', right ? 'right-0' : 'left-0',
          /^\p{Extended_Pictographic}+$/u.test(bubble.replace(/\s/g, '')) && 'text-3xl px-2 py-0.5')}>
          <MentionText text={bubble} users={g.players.map((p) => p.u)} me={me >= 0 ? g.players[me]?.u : undefined} />
        </div>
      )}
    </div>
  );

  const diceBox = (
    <div className={cn('relative grid size-12 place-items-center rounded-xl', active ? 'bg-white/15 shadow-[0_0_18px_rgba(255,255,255,0.25)]' : 'bg-transparent')}>
      {active && (canRoll || dice) ? (
        <button type="button" disabled={!canRoll} onClick={onRoll} aria-label={canRoll ? t('Roll dice') : t('Rolled {n}', { n: dice?.d ?? '' })}
          className="rounded-lg">
          <span className={cn('block', canRoll && 'ludo-roll-hint')}><Dice value={dice?.d || 6} rolling={!!dice?.rolling} /></span>
          {canRoll && (
            <span className={cn('ludo-your-turn pointer-events-none absolute z-10 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-amber-950 shadow-lg',
              below ? 'bottom-full mb-1' : 'top-full mt-1')}>{t('Your turn!')}</span>
          )}
        </button>
      ) : active ? <Dice value={6} rolling={false} dim /> : null}
    </div>
  );

  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-2xl border-2 bg-black/25 p-1.5 shadow-lg backdrop-blur-sm transition-colors',
      right ? 'items-end' : 'items-start', active ? '' : 'border-transparent', rank === 1 && 'shadow-[0_0_22px_rgba(250,204,21,0.65)]')} style={active ? { borderColor: color } : undefined} data-player={pl.u}>
      <div className={cn('flex items-center gap-1.5', right && 'flex-row-reverse')}>
        {avatar}
        {diceBox}
      </div>
      <div className={cn('min-w-0 px-0.5 text-[11px] leading-tight text-white/90', right && 'text-right')}>
        <div className="max-w-[100px] truncate font-semibold">{i === me ? t('You') : pl.n || pl.u}</div>
        <div className={cn(away ? 'font-medium text-amber-300' : 'text-white/60')}>
          {away ? t('Auto-playing') : gone ? (pl.state === 'out' ? t('Removed') : t('Left')) : rank ? ordinal(rank) : homeCount ? t('{color} · {n}/4 home', { color: t(COLOR_NAMES[arm]), n: homeCount }) : t(COLOR_NAMES[arm])}
        </div>
        {pl.state === 'playing' && !pl.bot && <Chances missed={missed} right={right} />}
      </div>
    </div>
  );
}

// '2nd place': the English suffix picks the key.
const ordinal = (n: number) => {
  const sfx = ['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0];
  return sfx === 'st' ? t('{n}st place', { n }) : sfx === 'nd' ? t('{n}nd place', { n }) : sfx === 'rd' ? t('{n}rd place', { n }) : t('{n}th place', { n });
};

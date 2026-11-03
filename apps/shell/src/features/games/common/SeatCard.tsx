import type { ReactNode } from 'react';
import { Avatar } from '../../../components/Avatar';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import type { Game } from '../store';
import { Chances } from '../Chances';
import { MentionText } from '../MentionText';
import { TurnRing } from '../TurnRing';

/** A player at a simple table: photo with the turn countdown, name, their mark or colour, and what they just said.
 *  Tapping it (anywhere that isn't a button) opens the tease menu: it carries data-player. */
export function SeatCard({ g, i, me, color, mark, status, bubble, align = 'left' }: {
  g: Game; i: number; me: number; color: string; mark: ReactNode; status?: string /* already translated */; bubble: string | null; align?: 'left' | 'right';
}) {
  const pl = g.players[i];
  const active = g.status === 'play' && g.turn === i && pl.state === 'playing';
  const gone = pl.state === 'left' || pl.state === 'out';
  const label = gone ? (pl.state === 'out' ? t('Removed') : t('Left')) : pl.rank === 1 && g.status === 'over' ? t('Winner!') : status;
  return (
    <div className={cn('relative flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 bg-black/25 p-2 backdrop-blur-sm transition-colors', align === 'right' && 'flex-row-reverse text-right',
      active ? '' : 'border-transparent', pl.rank === 1 && g.status === 'over' && 'shadow-[0_0_22px_rgba(250,204,21,0.65)]')}
      style={active ? { borderColor: color } : undefined} data-player={pl.u}>
      <TurnRing active={active} deadline={g.deadline} color={color}>
        <div className={cn('rounded-xl border-[3px] bg-white p-0.5', gone && 'opacity-40 grayscale')} style={{ borderColor: color }}>
          <Avatar u={pl.u} name={pl.n} size={40} className="[&>*]:rounded-lg" />
        </div>
      </TurnRing>
      <div className="min-w-0 text-white">
        <div className="flex items-center gap-1.5 text-sm font-semibold" style={align === 'right' ? { justifyContent: 'flex-end' } : undefined}>
          <span className="truncate">{i === me ? t('You') : pl.n || pl.u}</span>{mark}
        </div>
        <div className="truncate text-[11px] text-white/70">{label}</div>
        {pl.state === 'playing' && !pl.bot && (pl.missed || 0) > 0 && <Chances missed={pl.missed || 0} right={align === 'right'} />}
      </div>
      {pl.rank === 1 && g.status === 'over' && <span className="ludo-crown pointer-events-none absolute -top-5 left-6 z-10 text-2xl" role="img" aria-label={t('Winner')}>👑</span>}
      {bubble && (
        <div className={cn('ludo-bubble absolute top-full z-20 mt-1 max-w-[170px] rounded-2xl bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-lg', align === 'right' ? 'right-2' : 'left-2')}>
          <MentionText text={bubble} users={g.players.map((p) => p.u)} me={me >= 0 ? g.players[me]?.u : undefined} />
        </div>
      )}
    </div>
  );
}

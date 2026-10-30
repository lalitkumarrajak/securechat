// The countdown ring around whoever's turn it is at every game's table. (The hearts showing how many
// missed turns a player has left are in Chances.tsx.)
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@sanga/ui/utils';

export const TURN_TOTAL = 35_000; // 30 s per turn + the server's allowance for animations (GAME_ANIM_MS)
const TURN_SECS = 30;

export function TurnRing({ active, deadline, color, children, total = TURN_TOTAL }: {
  active: boolean; deadline: number; color: string; children: ReactNode; total?: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  const frac = active ? Math.max(0, Math.min(1, (deadline - now) / total)) : 0;
  const low = frac < 0.25;
  const secs = Math.min(TURN_SECS, Math.max(0, Math.ceil((deadline - now) / 1000)));
  return (
    <div className="relative rounded-[14px] p-[3px]" data-turn={active || undefined}
      style={active ? { background: `conic-gradient(${low ? '#ef4444' : color} ${frac * 360}deg, rgba(255,255,255,0.15) 0)` } : undefined}>
      {children}
      {active && (
        <span className={cn('absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-bold tabular-nums text-white shadow', low ? 'bg-red-500' : 'bg-black/70')}
          aria-label={`${secs} seconds left`}>{secs}s</span>
      )}
    </div>
  );
}

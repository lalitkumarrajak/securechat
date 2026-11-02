import type { ReactNode } from 'react';

export interface Slice { key: string; value: number; color: string; label: string }

/** A ring chart. Every slice is also listed with its number next to it, so colour is never the only cue. */
export function Donut({ slices, active, onPick, center, summary }: { slices: Slice[]; active: string | null; onPick: (key: string | null) => void; center: ReactNode; summary: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 42, C = 2 * Math.PI * R, GAP = slices.length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={summary}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="13" />
        {total > 0 && slices.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.key} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth={active === s.key ? 16 : 13}
              strokeDasharray={`${Math.max(0, len - GAP)} ${C}`} strokeDashoffset={-offset} opacity={active && active !== s.key ? 0.3 : 1}
              className="cursor-pointer transition-all" onClick={() => onPick(active === s.key ? null : s.key)}>
              <title>{s.label}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}

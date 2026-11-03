import { t } from '@sanga/i18n';
import { useId } from 'react';
import { money, type Bucket } from './model';

const nice = (max: number) => {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= max) ?? 10 * p);
};

/** Spending per day / week / month as bars. Tap a bar to see what's in it. */
export function BarChart({ buckets, currency, active, onPick, label }: { buckets: Bucket[]; currency: string; active: string | null; onPick: (key: string | null) => void; label: (b: Bucket) => string }) {
  const id = useId();
  const W = 600, H = 190, L = 4, B = 24, T = 18;
  const top = nice(Math.max(...buckets.map((b) => b.total), 0));
  const bw = (W - L) / Math.max(buckets.length, 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const every = Math.ceil(buckets.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('Spending over time, highest {amount}', { amount: money(Math.max(...buckets.map((b) => b.total), 0), currency) })} aria-describedby={id}>
      <desc id={id}>{buckets.map((b) => `${label(b)}: ${money(b.total, currency)}`).join('. ')}</desc>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W} y1={y(top * f)} y2={y(top * f)} stroke="var(--border)" strokeWidth="1" strokeDasharray={f === 0 ? undefined : '3 4'} />
          {f > 0 && <text x={L + 2} y={y(top * f) - 3} fontSize="10" fill="var(--muted)">{money(top * f, currency, { compact: true })}</text>}
        </g>
      ))}
      {buckets.map((b, i) => {
        const h = Math.max(b.total > 0 ? 2 : 0, (H - T - B) * (b.total / top));
        const x = L + i * bw;
        return (
          <g key={b.key} className="cursor-pointer" onClick={() => onPick(active === b.key ? null : b.key)}>
            <rect x={x} y={T} width={bw} height={H - T - B} fill="transparent"><title>{`${label(b)}: ${money(b.total, currency)}`}</title></rect>
            <rect x={x + bw * 0.15} y={H - B - h} width={bw * 0.7} height={h} rx={Math.min(4, bw * 0.2)}
              fill="var(--accent)" opacity={active && active !== b.key ? 0.3 : 1} />
            {i % every === 0 && <text x={x + bw / 2} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--muted)">{label(b)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

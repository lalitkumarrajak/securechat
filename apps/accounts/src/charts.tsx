// The spending charts: one series each, in the accent colour, with a quiet grid. Hover or tap a bar to
// read it (the reading shows above the chart); tap again to let go. Every chart has its numbers in text too.
import { useId, useState } from 'react';
import { t } from '@sanga/i18n';

export interface Bar { key: string; label: string; value: number; title: string }

const nice = (max: number) => {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= max) ?? 10 * p;
};

/** A bar standing on `base`, its top corners rounded. */
function bar(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h), top = base - h;
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
}

/** Bars along a time axis (days or months). `active`: the picked bar, the others dim. */
export function Columns({ bars, active, onPick, fmt, compact, summary, every }: { bars: Bar[]; active: string | null; onPick: (k: string | null) => void; fmt: (n: number) => string; compact: (n: number) => string; summary: string; every?: number }) {
  const id = useId();
  const [hover, setHover] = useState<string | null>(null);
  const W = 640, H = 200, L = 6, B = 22, T = 14;
  const max = Math.max(0, ...bars.map((b) => b.value));
  const top = nice(max);
  const bw = (W - L) / Math.max(bars.length, 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const step = every ?? Math.max(1, Math.ceil(bars.length / 8));
  const shown = bars.find((b) => b.key === (hover ?? active));
  return (
    <figure className="m-0">
      <p className="h-5 text-sm tabular-nums" aria-live="polite">{shown ? <><b>{shown.title}</b> · {fmt(shown.value)}</> : <span className="text-muted">{t('Tap a bar to see it')}</span>}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-manipulation" role="img" aria-label={summary} aria-describedby={id} onMouseLeave={() => setHover(null)}>
        <desc id={id}>{bars.map((b) => `${b.title}: ${fmt(b.value)}`).join('. ')}</desc>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W} y1={y(top * f)} y2={y(top * f)} stroke="var(--border)" strokeWidth="1" strokeDasharray={f === 0 ? undefined : '3 4'} />
            {f > 0 && <text x={L + 2} y={y(top * f) - 3} fontSize="10" fill="var(--muted)">{compact(top * f)}</text>}
          </g>
        ))}
        {bars.map((b, i) => {
          const h = Math.max(b.value > 0 ? 2 : 0, (H - T - B) * (b.value / top));
          const x = L + i * bw, w = Math.max(1, Math.min(bw - 2, bw * 0.72));
          const lit = !active || active === b.key || hover === b.key;
          return (
            <g key={b.key} className="cursor-pointer" onMouseEnter={() => setHover(b.key)} onClick={() => onPick(active === b.key ? null : b.key)}>
              <rect x={x} y={T} width={bw} height={H - T - B} fill="transparent" />
              {h > 0 && <path d={bar(x + (bw - w) / 2, H - B, w, h)}
                fill="var(--accent)" opacity={lit ? 1 : 0.3} />}
              {i % step === 0 && <text x={x + bw / 2} y={H - 7} fontSize="10" textAnchor="middle" fill="var(--muted)">{b.label}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Ranked horizontal bars with the name and number in text (categories, places). */
export function Ranking({ rows, active, onPick, fmt }: { rows: { key: string; name: string; emoji?: string; value: number; note?: string }[]; active?: string | null; onPick?: (k: string | null) => void; fmt: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const body = (
          <>
            <span className="flex items-baseline gap-2 text-sm">
              {r.emoji && <span aria-hidden>{r.emoji}</span>}
              <span className="min-w-0 flex-1 break-words">{r.name}{r.note && <span className="text-muted"> · {r.note}</span>}</span>
              <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{fmt(r.value)}</span>
              <span className="w-10 shrink-0 text-right text-xs text-muted tabular-nums">{Math.round((r.value / total) * 100)}%</span>
            </span>
            <span className="mt-1 block h-2 rounded-full bg-panel-2"><span className="block h-2 rounded-full bg-accent transition-all" style={{ width: `${(r.value / max) * 100}%`, opacity: active && active !== r.key ? 0.3 : 1 }} /></span>
          </>
        );
        return <li key={r.key}>{onPick ? <button type="button" aria-pressed={active === r.key} className="block w-full rounded-lg text-left" onClick={() => onPick(active === r.key ? null : r.key)}>{body}</button> : body}</li>;
      })}
    </ul>
  );
}

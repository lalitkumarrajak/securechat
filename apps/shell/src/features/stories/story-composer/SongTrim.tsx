import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { fmtDuration } from '@sanga/ui/format';
import { CLIP_SECONDS, clipFrom, peaks, type Song } from '../../../lib/songs';
import { t } from '@sanga/i18n';

const BARS = 90;

/** Pick which part of a song goes on the story: drag the highlighted stretch along the song, and play it. */
export function SongTrim({ song, title, onPick, onBack }: { song: AudioBuffer; title: string; onPick: (s: Song) => void; onBack: () => void }) {
  const dur = song.duration;
  const len = Math.min(CLIP_SECONDS, dur);
  const maxStart = Math.max(0, dur - len);
  const [start, setStart] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0); // how far into the part it's playing (0–1)
  const [busy, setBusy] = useState(false);
  const bars = useMemo(() => peaks(song, BARS), [song]);
  const wave = useRef<HTMLDivElement>(null);
  const player = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode; began: number; raf: number } | null>(null);

  const stop = () => {
    const p = player.current;
    if (!p) return;
    player.current = null;
    cancelAnimationFrame(p.raf);
    try { p.src.stop(); } catch { /* already stopped */ }
    void p.ctx.close();
    setPlaying(false); setAt(0);
  };
  const play = (from = start) => {
    stop();
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AC();
    const src = ctx.createBufferSource();
    src.buffer = song; src.connect(ctx.destination);
    src.start(0, from, len);
    const p = { ctx, src, began: ctx.currentTime, raf: 0 };
    const tick = () => { if (player.current !== p) return; setAt(Math.min(1, (ctx.currentTime - p.began) / len)); p.raf = requestAnimationFrame(tick); };
    src.onended = () => { if (player.current === p) stop(); };
    player.current = p;
    setPlaying(true); tick();
  };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag (or tap) on the song: the part centres where your finger is.
  const fromPointer = (x: number) => {
    const r = wave.current?.getBoundingClientRect();
    if (!r || !r.width) return start;
    const s = Math.max(0, Math.min(maxStart, ((x - r.left) / r.width) * dur - len / 2));
    setStart(s);
    return s;
  };
  const dragging = useRef(false);

  const left = dur ? (start / dur) * 100 : 0, width = dur ? (len / dur) * 100 : 100;
  const use = async () => {
    stop(); setBusy(true);
    try { onPick(await clipFrom(song, start, title)); } finally { setBusy(false); }
  };

  return (
    <div>
      <p className="truncate font-medium">{title}</p>
      <p className="text-sm text-muted">{t('Drag to choose the {n} seconds for your story.', { n: Math.round(len) })}</p>

      <div ref={wave} role="presentation"
        className="relative mt-4 flex h-24 cursor-grab touch-none items-center gap-px rounded-xl bg-panel-2 px-1 select-none active:cursor-grabbing"
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e.clientX); if (playing) stop(); }}
        onPointerMove={(e) => { if (dragging.current) fromPointer(e.clientX); }}
        onPointerUp={(e) => { if (!dragging.current) return; dragging.current = false; play(fromPointer(e.clientX)); }}
        onPointerCancel={() => { dragging.current = false; }}>
        {bars.map((v, i) => {
          const pos = (i + 0.5) / BARS * 100;
          const on = pos >= left && pos <= left + width;
          return <span key={i} className={on ? 'flex-1 rounded-full bg-accent' : 'flex-1 rounded-full bg-muted/40'} style={{ height: `${Math.max(6, v * 88)}%` }} />;
        })}
        <span className="pointer-events-none absolute inset-y-1 rounded-lg border-2 border-accent bg-accent/10" style={{ left: `${left}%`, width: `${width}%` }}>
          {playing && <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${at * 100}%` }} />}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={() => (playing ? stop() : play())} aria-label={playing ? t('Pause') : t('Play this part')}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-white">
          {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
        </button>
        <input type="range" min={0} max={Math.max(0, Math.floor(maxStart * 2)) / 2} step={0.5} value={start} disabled={!maxStart}
          aria-label={t('Start of the part')} aria-valuetext={fmtDuration(start)}
          onChange={(e) => { setStart(Number(e.target.value)); if (playing) stop(); }}
          onPointerUp={() => play()} onKeyUp={() => play()}
          className="min-w-0 flex-1 accent-[var(--color-accent)]" />
        <span className="shrink-0 text-sm tabular-nums text-muted">{fmtDuration(start)} – {fmtDuration(start + len)}</span>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => { stop(); onBack(); }}>{t('Back')}</Button>
        <Button loading={busy} onClick={() => void use()}>{t('Use this part')}</Button>
      </div>
    </div>
  );
}

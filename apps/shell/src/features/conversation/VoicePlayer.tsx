import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { fmtDuration } from '@sanga/ui/format';
import { cn } from '@sanga/ui/utils';

let playing: HTMLAudioElement | null = null; // only one voice message plays at a time
const SPEEDS = [1, 1.5, 2];

export function VoicePlayer({ src, dur, peaks, out }: { src: string; dur: number; peaks: number[]; out: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [t, setT] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => () => { audio.current?.pause(); }, []);

  function el() {
    if (!audio.current) {
      const a = new Audio(src);
      a.ontimeupdate = () => setT(a.currentTime);
      a.onplay = () => setOn(true);
      a.onpause = () => setOn(false);
      a.onended = () => { setOn(false); setT(0); };
      audio.current = a;
    }
    return audio.current;
  }

  const toggle = () => {
    const a = el();
    if (a.paused) {
      if (playing && playing !== a) playing.pause();
      playing = a;
      a.playbackRate = speed;
      a.play().catch(() => {});
    } else a.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const a = el();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (dur || a.duration || 0);
    setT(a.currentTime);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const progress = dur ? t / dur : 0;
  const bars = peaks.length ? peaks : Array(40).fill(0.1);
  return (
    <div className="flex w-64 max-w-full items-center gap-2.5 py-1" onClick={(e) => e.stopPropagation()}>
      <button onClick={toggle} aria-label={on ? 'Pause' : 'Play voice message'}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white shadow-sm">
        {on ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-8 cursor-pointer items-center gap-[2px]" onClick={seek} role="slider" aria-label="Seek"
          aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)}>
          {bars.map((p, i) => (
            <span key={i} className={cn('w-[3px] flex-1 rounded-full transition-colors',
              i / bars.length < progress ? 'bg-accent' : out ? 'bg-ink/25' : 'bg-muted/40')}
              style={{ height: `${Math.max(12, p * 100)}%` }} />
          ))}
        </div>
        <div className="mt-0.5 flex justify-between text-[11px] text-muted">
          <span>{fmtDuration(on || t ? t : dur)}</span>
          <button onClick={cycleSpeed} className="rounded-full bg-ink/10 px-1.5 font-semibold" aria-label="Playback speed">{speed}×</button>
        </div>
      </div>
    </div>
  );
}

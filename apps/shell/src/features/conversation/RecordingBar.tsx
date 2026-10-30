import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Mic, SendHorizontal, Trash2 } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { sendTyping, sendVoice } from '../../lib/engine';
import { fmtDuration } from '@sanga/ui/format';
import { cn } from '@sanga/ui/utils';
import { getApp, setApp } from '../../state/app';
import { hold, voice } from './voiceHold';

export function RecordingBar({ peer, onDone }: { peer: string; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const r = voice.recorder;
    if (!r) { onDone(); return; }
    if (hold.released) { hold.active = false; setLocked(true); }
    r.onLevel = (level, t) => {
      setElapsed(t);
      setLevels((l) => [...l.slice(-39), level]);
      sendTyping(peer, true);
    };
    r.onLimit = () => finish(true);
    const move = (e: PointerEvent) => {
      if (!hold.active) return;
      const dx = voice.pressX - e.clientX;
      setSlide(Math.max(0, dx));
      if (dx > 110) { hold.cancelled = true; hold.active = false; finish(false); }
    };
    const up = () => {
      if (!hold.active) return;
      hold.active = false;
      if (performance.now() - voice.pressStart < 400) setLocked(true); // quick tap: keep recording
      else finish(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []); // set up once when recording starts

  async function finish(send: boolean) {
    const r = voice.recorder;
    voice.recorder = null;
    onDone();
    if (!r) return;
    if (!send) { r.cancel(); toast('Recording cancelled'); return; }
    const rec = await r.stop();
    if (!rec) { toast('Hold the mic button to record'); return; }
    const re = getApp().replyTo;
    setApp({ replyTo: null });
    sendVoice(peer, rec, re).catch((e) => toast.error(e.message));
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-line bg-panel px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {locked ? (
        <IconButton label="Delete recording" onClick={() => finish(false)} className="text-danger hover:text-danger"><Trash2 /></IconButton>
      ) : (
        <span className="size-3 animate-pulse rounded-full bg-danger" aria-hidden />
      )}
      <span className="w-12 font-mono text-sm tabular-nums">{fmtDuration(elapsed)}</span>
      <div className="flex h-9 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
        {locked || !slide ? levels.map((l, i) => (
          <span key={i} className="w-[3px] flex-1 rounded-full bg-accent/70" style={{ height: `${Math.max(10, Math.min(100, l * 400))}%` }} />
        )) : null}
        {!locked && (
          <span className={cn('ml-auto text-sm text-muted transition', slide > 0 && 'mr-auto ml-0')} style={{ transform: `translateX(-${slide}px)` }}>
            ‹ Slide to cancel
          </span>
        )}
      </div>
      {locked ? (
        <button onClick={() => finish(true)} aria-label="Send voice message"
          className="grid size-11 place-items-center rounded-full bg-accent text-white shadow-sm"><SendHorizontal className="size-5" /></button>
      ) : (
        <span className="grid size-14 -m-1.5 place-items-center rounded-full bg-accent text-white shadow-lg"><Mic className="size-6" /></span>
      )}
    </div>
  );
}

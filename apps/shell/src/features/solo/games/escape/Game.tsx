// Escape Room: the room (SVG art, every thing in it a button), your bag below, a keypad or the stove's
// knobs when you look closer. Where you are is kept on this device, with the time you've spent.
import { useEffect, useState, type ReactNode } from 'react';
import { Delete, Lightbulb, Timer } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t, tk } from '@sanga/i18n';
import { ResultCard, testMode, ToolButton, useSaved } from '../../kit';
import { ITEMS, KNOBS, ROOMS, SPOT_NAMES, combine, enter, fresh, hint, knobs, nextRoom, tap, use, type Escape, type Item, type Result, type View } from './logic';
import { Kitchen, Lab, Study } from './rooms';

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const SHAKE = '@keyframes escape-shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }'; // i18n-ok
const TIP = tk('Tap where to use it, or another item to put them together.');

export default function EscapeRoom() {
  const [saved, setSaved] = useSaved('escape', { ...fresh(), time: 0, best: 0, started: false });
  const s: Escape = { room: saved.room, inv: saved.inv, flags: saved.flags, out: saved.out };
  const [msg, setMsg] = useState<string[]>([]);
  const [held, setHeld] = useState<Item | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [shake, setShake] = useState(0);
  const playing = saved.started && !s.out;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => { if (!document.hidden) setSaved((o) => ({ ...o, time: o.time + 1 })); }, 1000);
    return () => clearInterval(id);
  }, [playing, setSaved]);

  const apply = (r: Result, extra?: View) => {
    const won = r.s.out && !s.out && r.s.room === ROOMS.length - 1;
    setSaved((o) => ({ ...o, ...r.s, best: won ? (o.best ? Math.min(o.best, o.time) : o.time) : o.best }));
    setMsg([r.msg]);
    setView(extra ?? null);
    if (!r.ok && /Wrong|doesn’t|don’t|stays cold/.test(r.msg)) setShake((n) => n + 1);
  };
  const onSpot = (id: string) => {
    if (!playing) return;
    if (held) { const r = use(s, held, id); apply(r); if (r.ok) setHeld(null); return; }
    const r = tap(s, id);
    apply(r, r.view);
  };
  const onItem = (i: Item) => {
    if (held === i) { setHeld(null); setMsg([]); return; }
    if (held) { const r = combine(s, held, i); apply(r); setHeld(r.ok ? null : held); return; }
    setHeld(i);
    setMsg([ITEMS[i].about, TIP]);
  };
  const spot = (id: string, children: ReactNode) => (
    <g role="button" aria-label={t(SPOT_NAMES[id])} onClick={() => onSpot(id)} className="cursor-pointer transition-[filter] hover:brightness-110">{children}</g>
  );
  const restart = () => { setSaved({ ...fresh(), time: 0, best: saved.best, started: true }); setMsg([]); setHeld(null); setView(null); };
  const Room = [Study, Kitchen, Lab][s.room];
  const test = testMode() ? { 'data-room': s.room + 1, 'data-flags': s.flags.join(' ') } : {};
  const status = msg.length ? msg.map((m) => t(m)).join(' ') : held ? t(TIP) : t('Tap around the room to look for clues.');

  return (
    <div className="flex h-full flex-col items-center px-3 pb-3" data-state={!saved.started ? 'start' : s.out ? 'out' : 'play'} {...test}>
      <div className="flex w-full max-w-md items-center justify-between gap-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate rounded-full bg-black/30 px-3 py-1 text-sm font-bold">{t('Room {n} of {total}', { n: s.room + 1, total: ROOMS.length })} · {t(ROOMS[s.room])}</h2>
          <span className="flex items-center gap-1 text-sm tabular-nums text-white/80" aria-label={t('Time: {time}', { time: clock(saved.time) })}><Timer className="size-4" aria-hidden />{clock(saved.time)}</span>
        </div>
        <ToolButton label={t('Hint')} onClick={() => { setMsg([hint(s)]); setHeld(null); }} disabled={!playing}><Lightbulb className="size-4" />{t('Hint')}</ToolButton>
      </div>

      <p className="flex min-h-11 w-full max-w-md items-center justify-center text-center text-sm leading-snug text-white/90" role="status">{status}</p>

      <div key={shake} className={cn('relative mt-1 min-h-0 w-full max-w-md flex-1', shake > 0 && 'animate-[escape-shake_0.3s]')}>
        <svg viewBox="0 0 360 400" className="absolute inset-0 size-full select-none overflow-hidden rounded-2xl" role="group" aria-label={t(ROOMS[s.room])}>
          <Room flags={s.flags} spot={spot} />
        </svg>
      </div>

      <div className="mt-3 flex w-full max-w-md items-center gap-2" role="group" aria-label={t('Your bag')}>
        {Array.from({ length: 5 }, (_, k) => {
          const i = s.inv[k];
          if (!i) return <span key={k} className="h-14 flex-1 rounded-2xl border-2 border-dashed border-white/15" aria-hidden />;
          return (
            <button key={i} type="button" onClick={() => onItem(i)} aria-pressed={held === i} aria-label={t(ITEMS[i].name)} title={t(ITEMS[i].name)}
              className={cn('relative grid h-14 min-w-0 flex-1 place-items-center rounded-2xl bg-white/15 text-3xl transition hover:bg-white/25',
                held === i && '-translate-y-1 bg-amber-300/40 ring-2 ring-amber-300')}>
              <span aria-hidden className={cn(i === 'torchEmpty' && 'opacity-50 grayscale', i === 'cardB' && 'rotate-180')}>{ITEMS[i].icon}</span>
            </button>
          );
        })}
      </div>

      <style>{SHAKE}</style>
      {view?.kind === 'code' && <Keypad digits={view.digits} onClose={() => setView(null)} onTry={(code) => { const r = enter(s, view.lock, code); apply(r); if (!r.ok) setView(view); return !!r.ok; }} />}
      {view?.kind === 'knobs' && <Knobs onClose={() => setView(null)} onSet={(k) => { const r = knobs(s, k); if (r.ok) apply(r); return !!r.ok; }} />}

      {!saved.started && (
        <ResultCard emoji="🗝️" title={t('Locked in!')} primary={{ label: t('Play'), onClick: () => setSaved((o) => ({ ...o, started: true })) }}>
          {t('Three rooms, one way out of each. Look around, pick things up, crack the codes.')}
          {saved.best > 0 && <div className="mt-2 font-semibold text-slate-800">{t('Best time: {time}', { time: clock(saved.best) })}</div>}
        </ResultCard>
      )}
      {saved.started && s.out && s.room < ROOMS.length - 1 && (
        <ResultCard emoji="🚪" title={t('Room {n} escaped!', { n: s.room + 1 })}
          primary={{ label: t('Next room'), onClick: () => { setSaved((o) => ({ ...o, ...nextRoom(s) })); setMsg([]); setHeld(null); } }}>
          {t('Next up: the {room}.', { room: t(ROOMS[s.room + 1]) })}
        </ResultCard>
      )}
      {saved.started && s.out && s.room === ROOMS.length - 1 && (
        <ResultCard emoji="🎉" title={t('You escaped!')} primary={{ label: t('Play again'), onClick: restart }}>
          {t('All three rooms in {time}.', { time: clock(saved.time) })}
          <div className="mt-1 font-semibold text-slate-800">{saved.best >= saved.time ? t('Your best yet!') : t('Best time: {time}', { time: clock(saved.best) })}</div>
        </ResultCard>
      )}
    </div>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 p-5 animate-fade-in" role="dialog" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-[18rem] rounded-3xl bg-slate-800 p-5 text-white shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-center font-bold">{title}</h3>
        {children}
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold hover:bg-white/20">{t('Close')}</button>
      </div>
    </div>
  );
}

function Keypad({ digits, onTry, onClose }: { digits: number; onTry: (code: string) => boolean; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  const press = (d: string) => {
    setBad(false);
    const next = (code + d).slice(0, digits);
    setCode(next);
    if (next.length === digits && !onTry(next)) { setBad(true); setCode(''); }
  };
  return (
    <Panel title={t('Keypad')} onClose={onClose}>
      <div className={cn('mb-4 flex justify-center gap-2', bad && 'animate-[escape-shake_0.3s]')} aria-label={t('Code so far: {code}', { code: code || '-' })}>
        {Array.from({ length: digits }, (_, i) => (
          <span key={i} className={cn('grid h-12 w-10 place-items-center rounded-lg bg-black/40 font-mono text-2xl font-bold', bad ? 'text-rose-400 ring-2 ring-rose-400' : 'text-emerald-300')}>{code[i] ?? ''}</span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key key={d} onClick={() => press(d)}>{d}</Key>)}
        <Key onClick={() => { setCode(code.slice(0, -1)); setBad(false); }} label={t('Delete')}><Delete className="mx-auto size-5" /></Key>
        <Key onClick={() => press('0')}>0</Key>
        <span />
      </div>
    </Panel>
  );
}
const Key = ({ onClick, label, children }: { onClick: () => void; label?: string; children: ReactNode }) => (
  <button type="button" onClick={onClick} aria-label={label} className="h-12 rounded-xl bg-white/15 text-xl font-semibold transition hover:bg-white/25 active:scale-95">{children}</button>
);

function Knobs({ onSet, onClose }: { onSet: (k: boolean[]) => boolean; onClose: () => void }) {
  const [k, setK] = useState(() => KNOBS.map(() => false));
  const turn = (i: number) => { const next = k.map((v, j) => (j === i ? !v : v)); setK(next); onSet(next); };
  return (
    <Panel title={t('Stove knobs')} onClose={onClose}>
      <div className="flex justify-center gap-3">
        {k.map((on, i) => (
          <button key={i} type="button" onClick={() => turn(i)} aria-pressed={on} aria-label={t('Knob {n}', { n: i + 1 })}
            className="grid size-14 place-items-center rounded-full bg-slate-200 shadow-inner transition active:scale-95">
            <span className={cn('h-6 w-2 rounded-full transition-transform', on ? 'rotate-90 bg-orange-500' : 'bg-slate-600')} />
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-3 text-xs text-white/60" aria-hidden>{k.map((on, i) => <span key={i} className="w-14 text-center">{on ? t('on') : t('off')}</span>)}</div>
    </Panel>
  );
}



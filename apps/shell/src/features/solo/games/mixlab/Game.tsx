// Mix Lab: the bowl with two places, what you've found (searchable), a hint. Tap two things (or drag
// them onto the bowl) to mix them. What you've found is kept on this device.
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Lightbulb, Search, X } from 'lucide-react';
import { cn } from '@sanga/ui/utils';
import { t } from '@sanga/i18n';
import { ResultCard, ToolButton, useSaved } from '../../kit';
import { BASICS, byId, hint, ITEMS, mix } from './logic';

const STYLE = /* CSS, i18n-ok */ `
@keyframes mix-new { 0% { transform: scale(.2) rotate(-20deg); } 60% { transform: scale(1.25) rotate(6deg); } 100% { transform: scale(1); } }
@keyframes mix-glow { from { box-shadow: 0 0 0 0 #fde68a; } to { box-shadow: 0 0 0 18px #fde68a00; } }
@keyframes mix-swirl { to { transform: rotate(360deg); } }`;

type Out = { a: string; b: string; result: string | null; fresh: boolean; n: number } | null;
const nameOf = (id: string) => t(byId.get(id)!.name);

export default function MixLab() {
  const [saved, setSaved] = useSaved<{ found: string[] }>('mixlab', { found: BASICS });
  const found = saved.found;
  const [slots, setSlots] = useState<string[]>([]);
  const [out, setOut] = useState<Out>(null);
  const [tip, setTip] = useState<[string, string, string] | null>(null);
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; x0: number; y0: number; moved: boolean } | null>(null);
  const [closed, setClosed] = useState(false);
  const justDragged = useRef(false);
  const counter = useRef(0);

  const add = (id: string) => {
    setTip(null);
    if (!slots.length) { setSlots([id]); setOut(null); return; }
    const [a] = slots, result = mix(a, id);
    const fresh = !!result && !found.includes(result);
    setOut({ a, b: id, result, fresh, n: ++counter.current });
    setSlots([]);
    if (fresh) setSaved((s) => ({ found: [...s.found, result!] }));
  };

  const onDown = (e: RPointerEvent, id: string) => {
    if (e.pointerType === 'touch' || e.button !== 0) return; // on a phone: tap (dragging would fight the scrolling list)
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false });
  };
  const onMove = (e: RPointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved: drag.moved || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8 });
  };
  const onUp = (e: RPointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return;
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 0);
    if (document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-bowl]')) add(d.id);
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = found.map((id) => byId.get(id)!).filter(Boolean);
    return q ? items.filter((i) => t(i.name).toLowerCase().includes(q) || i.name.toLowerCase().includes(q)) : items;
  }, [found, query]);
  const newest = found[found.length - 1];
  const all = found.length >= ITEMS.length;

  const status = tip ? t('Try {a} + {b}.', { a: nameOf(tip[0]), b: nameOf(tip[1]) })
    : slots.length ? t('{a} is in the bowl. Now pick something to mix it with.', { a: nameOf(slots[0]) })
    : out?.result && out.fresh ? t('{a} + {b} make {c}. New!', { a: nameOf(out.a), b: nameOf(out.b), c: nameOf(out.result) })
    : out?.result ? t('{a} + {b} make {c}. You have it already.', { a: nameOf(out.a), b: nameOf(out.b), c: nameOf(out.result) })
    : out ? t('{a} and {b} don’t mix. Try something else.', { a: nameOf(out.a), b: nameOf(out.b) })
    : t('Tap two things to mix them in the bowl.');

  const Slot = ({ id, pos }: { id?: string; pos: string }) => (
    id ? (
      <button type="button" onClick={() => setSlots([])} aria-label={t('Take {name} out of the bowl', { name: nameOf(id) })}
        className="grid size-16 place-items-center rounded-2xl bg-white/90 text-4xl shadow-lg animate-pop">{byId.get(id)!.emoji}</button>
    ) : (
      <span className="grid size-16 place-items-center rounded-2xl border-2 border-dashed border-white/40 text-2xl text-white/40" aria-hidden>{pos}</span>
    )
  );

  return (
    <div className="flex h-full flex-col items-center gap-3 px-3 py-3" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
      <style>{STYLE}</style>
      <div className="flex w-full max-w-lg items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" aria-live="polite">{t('{n} of {total} found', { n: found.length, total: ITEMS.length })}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-pink-400 transition-all duration-500" style={{ width: `${(found.length / ITEMS.length) * 100}%` }} /></div>
        </div>
        <ToolButton label={t('Hint')} onClick={() => { setTip(hint(found)); setSlots([]); setOut(null); }} disabled={all}><Lightbulb className="size-4" />{t('Hint')}</ToolButton>
      </div>

      <div data-bowl className="relative flex w-full max-w-lg items-center justify-center gap-2 rounded-[2rem] bg-white/10 px-3 py-4 ring-1 ring-white/15" role="group" aria-label={t('Mixing bowl')}>
        <Slot id={slots[0] ?? (out ? out.a : undefined)} pos="1" />
        <span className="text-2xl font-bold text-white/60" aria-hidden>+</span>
        <Slot id={out && !slots.length ? out.b : undefined} pos="2" />
        <span className="text-2xl font-bold text-white/60" aria-hidden>=</span>
        <div key={out?.n ?? 0} className={cn('relative grid size-20 place-items-center rounded-full text-5xl',
          out?.result ? 'bg-gradient-to-b from-amber-100 to-amber-300 shadow-xl' : 'bg-black/25')}
          style={out?.fresh ? { animation: 'mix-new .55s cubic-bezier(.2,1.4,.5,1), mix-glow 1s ease-out' } : out && !out.result ? { animation: 'shake .4s ease-in-out' } : undefined}
          role="img" aria-label={out?.result ? nameOf(out.result) : t('Nothing yet')}>
          {out?.result ? byId.get(out.result)!.emoji : out ? '💨' : <span className="text-3xl" style={{ animation: 'mix-swirl 6s linear infinite', display: 'inline-block' }} aria-hidden>🌀</span>}
          {out?.fresh && <span className="absolute -right-1 -top-1 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">{t('New')}</span>}
        </div>
      </div>

      <p className="min-h-10 max-w-lg text-center text-sm leading-snug text-white/90" role="status">{status}</p>

      <label className="flex w-full max-w-lg items-center gap-2 rounded-full bg-white/10 px-4 py-2 focus-within:ring-2 focus-within:ring-white/40">
        <Search className="size-4 shrink-0 text-white/60" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search')} aria-label={t('Search')}
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label={t('Clear search')}><X className="size-4" /></button>}
      </label>

      <ul className="grid min-h-0 w-full max-w-lg flex-1 auto-rows-min grid-cols-4 gap-2 overflow-y-auto pb-2 sm:grid-cols-5" aria-label={t('What you’ve found')}>
        {list.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => { if (!justDragged.current) add(i.id); }} onPointerDown={(e) => onDown(e, i.id)} aria-label={t(i.name)}
              className={cn('flex w-full flex-col items-center gap-0.5 rounded-2xl px-1 py-2 transition active:scale-95',
                slots[0] === i.id || (tip && (tip[0] === i.id || tip[1] === i.id)) ? 'bg-amber-200/30 ring-2 ring-amber-200' : 'bg-white/10 hover:bg-white/20',
                i.id === newest && found.length > BASICS.length && 'animate-pop')}>
              <span className="text-3xl leading-none" aria-hidden>{i.emoji}</span>
              <span className="w-full truncate text-center text-[11px] font-medium">{t(i.name)}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className="col-span-full py-6 text-center text-sm text-white/60">{t('Nothing found.')}</li>}
      </ul>

      {drag?.moved && (
        <div className="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-1/2 text-5xl drop-shadow-2xl" style={{ left: drag.x, top: drag.y }} aria-hidden>{byId.get(drag.id)!.emoji}</div>
      )}

      {all && !closed && (
        <ResultCard emoji="🏆" title={t('You found all {n}!', { n: ITEMS.length })} primary={{ label: t('Start again'), onClick: () => { setSaved({ found: BASICS }); setOut(null); } }}
          secondary={{ label: t('Close'), onClick: () => setClosed(true) }}>
          {t('Every mix in the lab is yours.')}
        </ResultCard>
      )}
    </div>
  );
}

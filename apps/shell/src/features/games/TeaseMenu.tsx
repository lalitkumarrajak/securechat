import { useEffect, useRef } from 'react';
import { TEASES } from './teases';

/** Pick something to throw at the player whose panel you tapped. */
export function TeaseMenu({ name, at, onPick, onClose }: { name: string; at: { x: number; y: number; top: number }; onPick: (k: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', key);
    const t = setTimeout(() => window.addEventListener('pointerdown', away), 0); // not the tap that opened it
    box.current?.querySelector('button')?.focus();
    return () => { clearTimeout(t); window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', away); };
  }, [onClose]);

  const W = Math.min(300, innerWidth - 16);
  const left = Math.max(8, Math.min(at.x - W / 2, innerWidth - W - 8));
  const below = at.y + 190 < innerHeight;
  return (
    <div ref={box} role="menu" aria-label={`Tease ${name}`} className="fixed z-[60] rounded-2xl bg-white p-3 text-slate-900 shadow-2xl animate-fade-in"
      style={{ left, width: W, ...(below ? { top: at.y + 8 } : { bottom: innerHeight - at.top + 8 }) }}>
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Tease {name}</p>
      <div className="grid grid-cols-4 gap-1">
        {TEASES.map((t) => (
          <button key={t.k} type="button" role="menuitem" onClick={() => onPick(t.k)} aria-label={t.label}
            className="flex flex-col items-center rounded-xl py-1.5 hover:bg-slate-100 active:scale-95">
            <span className="text-3xl leading-none">{t.emoji}</span><span className="mt-1 text-[10px] font-medium text-slate-500">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

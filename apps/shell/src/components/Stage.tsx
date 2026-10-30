import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Crop } from '../lib/image';
import { Button } from '@sanga/ui/button';

const MAX_ZOOM = 5;

export function Stage({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (crop: Crop) => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState({ z: 1, x: 0, y: 0 }); // zoom, and offset of the photo's centre in stage px
  const size = Math.min(window.innerWidth - 32, window.innerHeight - 260, 380);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);

  const base = nat ? size / Math.min(nat.w, nat.h) : 1; // at zoom 1 the photo just covers the circle
  // Keep the photo covering the whole circle.
  const clamp = (v: { z: number; x: number; y: number }) => {
    if (!nat) return v;
    const z = Math.min(MAX_ZOOM, Math.max(1, v.z));
    const mx = (nat.w * base * z - size) / 2, my = (nat.h * base * z - size) / 2;
    return { z, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  };
  const zoomTo = (z: number) => setView((v) => clamp({ ...v, z }));

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z };
    }
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const z = pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d;
      setView((v) => clamp({ ...v, z }));
    } else if (pointers.current.size === 1) {
      setView((v) => clamp({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }));
    }
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  function done() {
    if (!nat) return;
    const scale = base * view.z;
    const side = size / scale;
    onDone({
      side,
      x: Math.max(0, nat.w / 2 - view.x / scale - side / 2),
      y: Math.max(0, nat.h / 2 - view.y / scale - side / 2),
    });
  }

  const scale = base * view.z;
  return (
    <>
      <div className="relative touch-none overflow-hidden rounded-2xl bg-black select-none" style={{ width: size, height: size }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={(e) => zoomTo(view.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))}
        aria-label="Photo to crop" role="img">
        <img src={url} alt="" draggable={false}
          onError={() => { toast.error('Couldn’t open that photo', { description: 'Try a JPEG or PNG, or take a screenshot of it and use that.' }); onCancel(); }}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
          style={nat ? { width: nat.w * scale, height: nat.h * scale, transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` } : { opacity: 0 }} />
        {/* the round photo people will see; the rest is dimmed */}
        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] ring-2 ring-white/80" />
      </div>
      <div className="flex w-full max-w-[380px] items-center gap-3">
        <button onClick={() => zoomTo(view.z / 1.25)} aria-label="Zoom out" className="grid size-9 place-items-center rounded-full hover:bg-white/15"><Minus className="size-5" /></button>
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={view.z} onChange={(e) => zoomTo(Number(e.target.value))}
          aria-label="Zoom" className="flex-1 accent-[var(--accent)]" />
        <button onClick={() => zoomTo(view.z * 1.25)} aria-label="Zoom in" className="grid size-9 place-items-center rounded-full hover:bg-white/15"><Plus className="size-5" /></button>
      </div>
      <div className="flex w-full max-w-[380px] gap-3">
        <Button variant="ghost" className="flex-1 text-white hover:bg-white/15" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" onClick={done} disabled={!nat}>Use photo</Button>
      </div>
    </>
  );
}

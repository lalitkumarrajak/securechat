// Horizontal swipes (finger or mouse drag) between photos: the photo follows your finger, and
// letting go past a threshold (or flicking) moves to the next or previous one.
import { useRef, useState } from 'react';

export function useSwipe(onPrev: (() => void) | null, onNext: (() => void) | null) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; t: number; id: number; horizontal: boolean | null } | null>(null);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button > 0) return;
      start.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, horizontal: null };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const mx = e.clientX - s.x, my = e.clientY - s.y;
      if (s.horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
        s.horizontal = Math.abs(mx) > Math.abs(my);
        if (s.horizontal) { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragging(true); }
      }
      // Past the first or last photo it only gives a little, so you can tell there's nothing more.
      if (s.horizontal) setDx((mx > 0 && !onPrev) || (mx < 0 && !onNext) ? mx / 4 : mx);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      setDragging(false);
      setDx(0);
      if (!s?.horizontal) return;
      const mx = e.clientX - s.x;
      const flick = Math.abs(mx) > 25 && performance.now() - s.t < 250;
      const width = (e.currentTarget as HTMLElement).clientWidth || 1;
      if (mx < 0 && (flick || -mx > width / 5)) onNext?.();
      else if (mx > 0 && (flick || mx > width / 5)) onPrev?.();
    },
    onPointerCancel: () => { start.current = null; setDragging(false); setDx(0); },
  };
  return { dx, dragging, handlers };
}

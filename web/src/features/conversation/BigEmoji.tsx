// Emoji-only messages: shown larger and animated once when they first appear, then they rest
// on the last frame, like WhatsApp. Tap to play again. Animations are Google's Noto set,
// relayed by our server (/emoji/<codepoints>.json).
import { useEffect, useRef } from 'react';
import { codepoints } from '../../lib/emoji';
import { cn } from '../../lib/utils';

type Lottie = typeof import('lottie-web').default;
type Anim = ReturnType<Lottie['loadAnimation']>;

let lottie: Promise<Lottie> | null = null;
const loadLottie = () => (lottie ??= import('lottie-web/build/player/lottie_light').then((m: any) => m.default ?? m));

const animations = new Map<string, Promise<object | null>>();
function animationData(e: string) {
  const cp = codepoints(e);
  if (!animations.has(cp)) {
    animations.set(cp, fetch(`/emoji/${cp}.json`).then((r) => (r.ok ? r.json() : null))
      .catch(() => { animations.delete(cp); return null; }));
  }
  return animations.get(cp)!;
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function Emoji({ e, size }: { e: string; size: number }) {
  const box = useRef<HTMLSpanElement>(null);
  const anim = useRef<Anim | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = box.current!;
    // Load and play only once the emoji scrolls into view.
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const [data, L] = await Promise.all([animationData(e), loadLottie().catch(() => null)]);
      if (cancelled) return;
      if (!data || !L) { el.classList.add('animate-pop'); return; } // no animated version: a little pop
      el.textContent = '';
      const a = L.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, animationData: data });
      anim.current = a;
      if (reduceMotion()) a.goToAndStop(a.totalFrames - 1, true);
      else a.play();
    });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); anim.current?.destroy(); anim.current = null; };
  }, [e]);

  const replay = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (anim.current) anim.current.goToAndPlay(0, true);
    else { box.current?.classList.remove('animate-pop'); void box.current?.offsetWidth; box.current?.classList.add('animate-pop'); }
  };

  return (
    <span ref={box} role="img" aria-label={e} onClick={replay}
      className="big-emoji inline-grid cursor-pointer place-items-center select-none"
      style={{ width: size, height: size, fontSize: size * 0.8, lineHeight: 1 }}>
      {e}
    </span>
  );
}

export function BigEmoji({ parts, className }: { parts: string[]; className?: string }) {
  const size = parts.length === 1 ? 64 : 44;
  return (
    <span className={cn('flex gap-0.5', className)}>
      {parts.map((e, i) => <Emoji key={i + e} e={e} size={size} />)}
    </span>
  );
}

import { useEffect } from 'react';
import { loadAvatar } from '../lib/engine';
import { cn } from '../lib/utils';
import { useApp } from '../state/app';

const hue = (name: string) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };

/** Profile photo, or coloured initial if there is none. `online` shows a green dot. */
export function Avatar({ u, name, size = 44, online, className }: {
  u: string; name?: string; size?: number; online?: boolean; className?: string;
}) {
  const url = useApp((s) => s.avatars[u]);
  useEffect(() => { if (url === undefined) loadAvatar(u); }, [u, url]);
  const label = name || u;
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt="" className="size-full rounded-full object-cover" draggable={false} />
      ) : (
        <span
          className="grid size-full place-items-center rounded-full font-semibold text-white select-none"
          style={{ background: `hsl(${hue(u)} 45% 48%)`, fontSize: size * 0.42 }}
          aria-hidden
        >
          {label[0]?.toUpperCase() || '?'}
        </span>
      )}
      {online && (
        <span className="absolute right-0 bottom-0 rounded-full border-2 border-panel bg-green-500"
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }} aria-label="online" />
      )}
    </span>
  );
}

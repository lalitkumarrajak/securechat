import { createElement } from 'react';

// Photos come from the main app's cache there; on its own an app shows the coloured initial.
const hue = (name: string) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };
export function Initial({ u, name, size = 40, className }: { u: string; name?: string; size?: number; className?: string }) {
  return createElement('span', {
    className: 'grid shrink-0 place-items-center rounded-full font-semibold text-white ' + (className || ''),
    style: { width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue(u)} 45% 48%)` }, 'aria-hidden': true,
  }, (name || u).replace(/^g:/, '')[0]?.toUpperCase() || '?');
}

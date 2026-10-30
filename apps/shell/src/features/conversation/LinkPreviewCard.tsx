import type { LinkPreview } from '../../lib/types';
import { cn } from '@sanga/ui/utils';
import { stop } from './attachments';

export function LinkPreviewCard({ lp, out }: { lp: LinkPreview; out: boolean }) {
  return (
    <a href={lp.url} target="_blank" rel="noopener noreferrer nofollow" onClick={stop}
      className={cn('mb-1 block max-w-80 overflow-hidden rounded-lg', out ? 'bg-ink/8' : 'bg-ink/5')}>
      {lp.img && <img src={lp.img} alt="" className="block max-h-44 w-full object-cover" />}
      <span className="block border-l-4 border-accent px-2.5 py-1.5">
        <span className="line-clamp-2 text-sm font-semibold">{lp.title}</span>
        {lp.desc && <span className="line-clamp-2 text-xs text-muted">{lp.desc}</span>}
        <span className="mt-0.5 block truncate text-xs text-accent-ink">{lp.site}</span>
      </span>
    </a>
  );
}

import { Link2, X } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import type { LinkPreview } from '../../lib/types';

export function LinkCard({ lp, onClose }: { lp: LinkPreview; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 pt-2">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-xl bg-panel-2">
        {lp.img ? <img src={lp.img} alt="" className="size-16 shrink-0 object-cover" /> : <span className="grid size-16 shrink-0 place-items-center text-muted"><Link2 className="size-6" /></span>}
        <span className="min-w-0 py-1.5 pr-2">
          <span className="block truncate text-sm font-semibold">{lp.title}</span>
          {lp.desc && <span className="line-clamp-1 text-xs text-muted">{lp.desc}</span>}
          <span className="block truncate text-xs text-accent-ink">{lp.site}</span>
        </span>
      </div>
      <IconButton label="Remove link preview" size="icon-sm" onClick={onClose}><X /></IconButton>
    </div>
  );
}

import { MicOff } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { cn } from '@sanga/ui/utils';
import { Media } from './Media';

export function Tile({ u, name, stream, muted, label, mirror, fit }: { u: string; name: string; stream: MediaStream | null; muted?: boolean; label?: string; mirror?: boolean; fit?: boolean }) {
  return (
    <div role="listitem" aria-label={name} className="relative grid min-h-0 place-items-center overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
      {stream ? <Media stream={stream} mirror={mirror} fit={fit} className="absolute inset-0 size-full" />
        : <span className={cn('rounded-full', label === 'Ringing…' && 'animate-pulse')}><Avatar u={u} name={name} size={72} /></span>}
      <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium">
        {muted && <MicOff className="size-3.5 shrink-0" aria-label="Muted" />}
        <span className="truncate">{name}</span>
        {label && <span className="shrink-0 text-white/70">· {label}</span>}
      </span>
    </div>
  );
}

import { sdk } from '@sanga/sdk';
import { cn } from '@sanga/ui/utils';
import type { Person } from './model';

/** A person's picture: their Sanga photo, or an initial for someone who isn't on Sanga. */
export function PersonDot({ p, name, size = 32, className }: { p: Person; name: string; size?: number; className?: string }) {
  const { Avatar } = sdk();
  if (p.u) return <Avatar u={p.u} name={name} size={size} className={className} />;
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-panel-2 font-semibold text-muted', className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>{(name.trim()[0] || '?').toUpperCase()}</span>
  );
}

import type { ReactNode } from 'react';
import { Laptop, MapPin, MonitorSmartphone, Smartphone, Tablet } from 'lucide-react';
import { fmtListTime } from '@sanga/ui/format';
import { cn } from '@sanga/ui/utils';
import { deviceName, osVersion, parseDevice, placeName } from '../../../lib/device';
import type { Session } from '../../../lib/types';

export function SessionRow({ s, children }: { s: Session; children?: ReactNode }) {
  const d = parseDevice(s.ua);
  const Icon = d?.kind === 'phone' ? Smartphone : d?.kind === 'tablet' ? Tablet : d ? Laptop : MonitorSmartphone;
  const active = s.current || s.online;
  const place = placeName(s.loc);
  const detail = s.device?.model ? osVersion(s.ua, s.device) : ''; // model in the title: OS version here
  return (
    <li className="flex items-center gap-4 px-5 py-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/12 text-accent-ink"><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{deviceName(s.ua, s.device)}</span>
        <span className={cn('block truncate text-sm', active ? 'text-accent-ink' : 'text-muted')}>
          {s.current ? 'This device · active now' : s.online ? 'Active now' : s.lastSeen ? `Last active ${fmtListTime(s.lastSeen).toLowerCase()}` : 'Last active: unknown'}
        </span>
        {(place || detail) && (
          <span className="mt-0.5 flex items-center gap-1 truncate text-sm">
            {place && <MapPin className="size-3.5 shrink-0 text-muted" />}
            <span className="truncate">{[place, detail].filter(Boolean).join(' · ')}</span>
          </span>
        )}
        <span className="block truncate text-xs text-muted">
          {s.created ? `Signed in ${new Date(s.created).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Signed in before session details were recorded'}
          {s.ip && ` · IP ${s.ip}`}{s.loc?.isp && ` · ${s.loc.isp}`}
        </span>
      </span>
      {children}
    </li>
  );
}

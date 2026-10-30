import { ExternalLink, MapPin } from 'lucide-react';
import { mapsLink, tileOf } from '../../lib/location';
import type { Msg } from '../../lib/types';
import { stop } from './attachments';

// A small OpenStreetMap view (2×2 tiles) centred on the pin. Tiles load from openstreetmap.org.
const ZOOM = 15;
export function LocationCard({ m }: { m: Msg }) {
  const l = m.loc!;
  const t = tileOf(l.lat, l.lng, ZOOM);
  const x0 = t.fx < 0.5 ? t.x - 1 : t.x; // pick the 2×2 block with the pin nearest its centre
  const y0 = t.fy < 0.5 ? t.y - 1 : t.y;
  const px = (t.x - x0 + t.fx) * 256; // pin position inside the 512×512 block
  const py = (t.y - y0 + t.fy) * 256;
  const W = 260, H = 160;
  return (
    <a href={mapsLink(l)} target="_blank" rel="noopener noreferrer" onClick={stop} className="block w-[260px] max-w-full">
      <span className="relative block overflow-hidden rounded-xl bg-panel-2" style={{ width: W, height: H }}>
        <span className="absolute grid grid-cols-2" style={{ width: 512, height: 512, left: W / 2 - px, top: H / 2 - py }}>
          {[0, 1].flatMap((dy) => [0, 1].map((dx) => (
            <img key={`${dx}${dy}`} alt="" width={256} height={256} loading="lazy" referrerPolicy="origin"
              src={`https://tile.openstreetmap.org/${ZOOM}/${x0 + dx}/${y0 + dy}.png`} />
          )))}
        </span>
        <MapPin className="absolute size-8 -translate-x-1/2 -translate-y-full fill-red-500 text-white drop-shadow" style={{ left: W / 2, top: H / 2 }} />
        <span className="absolute right-1 bottom-1 rounded bg-white/80 px-1 text-[9px] text-gray-700">© OpenStreetMap</span>
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 px-1 text-sm">
        <MapPin className="size-4 text-accent-ink" />
        <span className="flex-1 font-medium">Location</span>
        <span className="flex items-center gap-1 text-xs text-accent-ink">Open in Maps <ExternalLink className="size-3" /></span>
      </span>
      <span className="block px-1 text-xs text-muted">{l.lat.toFixed(5)}, {l.lng.toFixed(5)} · ±{l.acc} m</span>
    </a>
  );
}

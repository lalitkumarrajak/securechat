// How files, locations and link previews look inside a message bubble.
import { Download, ExternalLink, FileText, MapPin } from 'lucide-react';
import { downloadDataUrl, fileExt, fmtSize } from '../../lib/files';
import { mapsLink, tileOf } from '../../lib/location';
import type { LinkPreview, Msg } from '../../lib/types';
import { cn } from '../../lib/utils';
import { setChatUi } from './chatUi';

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function FileCard({ m }: { m: Msg }) {
  const f = m.file!;
  const video = f.mime.startsWith('video/');
  const save = (e: React.MouseEvent) => { e.stopPropagation(); downloadDataUrl(m.src!, f.name); };
  return (
    <div className="w-72 max-w-full" onClick={stop}>
      {video ? (
        <video src={m.src} poster={f.thumb} controls playsInline preload="none" className="mb-1 block max-h-72 w-full rounded-xl bg-black" />
      ) : f.thumb ? (
        <button onClick={() => setChatUi({ viewer: f.thumb! })} className="mb-1 block w-full overflow-hidden rounded-xl border border-line bg-white" aria-label="Preview">
          <img src={f.thumb} alt="" className="block max-h-56 w-full object-cover object-top" />
        </button>
      ) : f.text ? (
        <pre className="mb-1 max-h-32 overflow-hidden rounded-xl bg-ink/5 p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted">{f.text}</pre>
      ) : null}
      <div className="flex items-center gap-3 rounded-xl bg-ink/5 p-2">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent-ink">
          <FileText className="size-5" />
          <span className="absolute -bottom-1 rounded bg-accent px-1 text-[9px] leading-3 font-bold text-white">{fileExt(f.name, f.mime)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{f.name}</span>
          <span className="block text-xs text-muted">{[f.pages && `${f.pages} page${f.pages > 1 ? 's' : ''}`, fmtSize(f.size), fileExt(f.name, f.mime)].filter(Boolean).join(' · ')}</span>
        </span>
        <button onClick={save} aria-label={`Download ${f.name}`} className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted hover:text-ink">
          <Download className="size-4" />
        </button>
      </div>
    </div>
  );
}

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

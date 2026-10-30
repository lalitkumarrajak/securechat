// How a file looks inside a message bubble.
import { Download, FileText } from 'lucide-react';
import { downloadDataUrl, fileExt, fmtSize } from '../../lib/files';
import type { Msg } from '../../lib/types';
import { setChatUi } from './chatUi';
import { stop } from './attachments';

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

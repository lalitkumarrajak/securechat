// Files on their way up: a card in the corner with each one's progress, a way to stop one, and
// "Try again" for one that failed. It folds down to one line and goes once you close it.
import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, CircleAlert, RotateCcw, X } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { cn } from '@sanga/ui/utils';
import { t, tn } from '@sanga/i18n';
import { fmtSize } from './kinds';
import { cancelUpload, dismissUploads, MAX_FILE, retryUpload, useDrive, type Upload } from './store';

export function Uploads() {
  const list = useDrive((s) => s.uploads);
  const [open, setOpen] = useState(true);
  const busy = list.filter((u) => u.state === 'waiting' || u.state === 'sending');
  const failed = list.filter((u) => u.state === 'failed').length;
  const allDone = list.length > 0 && !busy.length && !failed;
  // New uploads unfold it; once all are up it folds down, then goes, so it doesn't sit over your files.
  useEffect(() => { if (busy.length) setOpen(true); }, [busy.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!allDone) return;
    const fold = setTimeout(() => setOpen(false), 2500), gone = setTimeout(dismissUploads, 8000);
    return () => { clearTimeout(fold); clearTimeout(gone); };
  }, [allDone]);
  if (!list.length) return null;
  const total = busy.reduce((n, u) => n + u.size, 0), sent = busy.reduce((n, u) => n + u.sent, 0);
  const done = list.filter((u) => u.state === 'done').length;
  const title = busy.length ? tn(busy.length, 'Uploading {n} file', 'Uploading {n} files')
    : failed ? tn(failed, '{n} upload failed', '{n} uploads failed')
    : tn(done, '{n} upload complete', '{n} uploads complete');

  return (
    <section aria-label={t('Uploads')} className="absolute right-3 bottom-[5.5rem] z-30 w-[min(24rem,calc(100%-1.5rem))] overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl md:right-5 md:bottom-5">
      <header className="flex items-center gap-1 bg-panel-2 py-1.5 pr-1.5 pl-4">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold" role="status">{title}</p>
        <IconButton label={open ? t('Hide') : t('Show')} size="icon-sm" onClick={() => setOpen(!open)}>{open ? <ChevronDown /> : <ChevronUp />}</IconButton>
        <IconButton label={t('Close')} size="icon-sm" onClick={dismissUploads}><X /></IconButton>
      </header>
      {busy.length > 0 && (
        <div className="h-1 bg-line"><div className="h-full bg-accent transition-[width]" style={{ width: `${total ? (sent / total) * 100 : 0}%` }} /></div>
      )}
      {open && (
        <ul className="max-h-64 overflow-y-auto py-1">
          {list.map((u) => <Row key={u.id} u={u} />)}
        </ul>
      )}
    </section>
  );
}

function Row({ u }: { u: Upload }) {
  const pct = u.size ? Math.round((u.sent / u.size) * 100) : 0;
  const sub = u.state === 'sending' ? `${fmtSize(u.sent)} / ${fmtSize(u.size)}`
    : u.state === 'waiting' ? t('Waiting…')
    : u.state === 'cancelled' ? t('Cancelled')
    : u.state === 'failed' ? (u.error === 'big' ? t('Too big: up to {size} a file', { size: fmtSize(MAX_FILE) }) : u.error === 'full' ? t('Not enough space in your Drive') : u.error || t('Couldn’t upload'))
    : fmtSize(u.size);
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{u.name}</p>
        <p className={cn('truncate text-xs', u.state === 'failed' ? 'text-danger' : 'text-muted')}>{sub}</p>
      </div>
      {u.state === 'done' && <Check className="size-5 text-accent" aria-label={t('Uploaded')} />}
      {u.state === 'sending' && (
        <span className="relative grid size-8 place-items-center" aria-label={`${pct}%`}>
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 94.2} 94.2`} /></svg>
          <button type="button" onClick={() => cancelUpload(u.id)} aria-label={t('Cancel')} title={t('Cancel')} className="relative grid size-6 place-items-center rounded-full text-muted hover:text-ink"><X className="size-3.5" /></button>
        </span>
      )}
      {u.state === 'waiting' && <IconButton label={t('Cancel')} size="icon-sm" onClick={() => cancelUpload(u.id)}><X /></IconButton>}
      {u.state === 'failed' && u.error !== 'big' && <IconButton label={t('Try again')} size="icon-sm" onClick={() => retryUpload(u.id)}><RotateCcw /></IconButton>}
      {u.state === 'failed' && u.error === 'big' && <CircleAlert className="size-5 text-danger" aria-hidden />}
    </li>
  );
}

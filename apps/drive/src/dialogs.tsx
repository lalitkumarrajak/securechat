// The small windows: name a folder (or rename anything), pick where to move something, and a file's details.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Folder, HardDrive } from 'lucide-react';
import { Button, IconButton } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { Input } from '@sanga/ui/input';
import { locale, t, tn } from '@sanga/i18n';
import { fmtSize, kindName } from './kinds';
import { kindOfEntry, Preview } from './parts';
import { children, descendants, NAME_MAX, pathTo, sorted, useDrive, within, type Entry } from './store';

export function NameDialog({ title, initial, action, onDone, onClose }: {
  title: string; initial: string; action: string; onDone: (name: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const ok = !!name.trim() && name.trim() !== initial.trim() && !/[/\\]/.test(name);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (ok) { onDone(name.trim()); onClose(); } }}>
        <Input autoFocus maxLength={NAME_MAX} value={name} aria-label={t('Name')}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => { const dot = e.target.value.lastIndexOf('.'); e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length); }} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" disabled={!ok}>{action}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Pick a folder: start where the item is, go into folders, back up, and "Move here". */
export function MoveDialog({ e, onDone, onClose }: { e: Entry; onDone: (folder: string) => void; onClose: () => void }) {
  const [at, setAt] = useState(e.parent);
  const map = useDrive((s) => s.entries);
  const here = useMemo(() => sorted(children(at, map).filter((x) => x.type === 'folder'), 'name'), [at, map]);
  const path = useMemo(() => pathTo(at, map), [at, map]);
  const can = at !== e.parent && !(e.type === 'folder' && within(at, e.id, map));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t('Move “{name}”', { name: e.name })}>
      <div className="mb-2 flex min-h-10 items-center gap-1">
        {at ? <IconButton label={t('Back')} size="icon-sm" onClick={() => setAt(path.at(-2)?.id ?? '')}><ChevronLeft /></IconButton>
          : <span className="grid size-8 place-items-center text-muted"><HardDrive className="size-5" /></span>}
        <p className="min-w-0 flex-1 truncate font-medium">{path.at(-1)?.name ?? t('My Drive')}</p>
      </div>
      <ul className="-mx-2 max-h-[45dvh] min-h-40 overflow-y-auto">
        {!here.length && <li className="py-10 text-center text-sm text-muted">{t('No folders here')}</li>}
        {here.map((f) => {
          const self = e.type === 'folder' && within(f.id, e.id, map);
          return (
            <li key={f.id}>
              <button type="button" disabled={self} onClick={() => setAt(f.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-hover disabled:opacity-40">
                <Folder className="size-5 shrink-0 fill-current text-accent" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
        <Button disabled={!can} onClick={() => { onDone(at); onClose(); }}>{t('Move here')}</Button>
      </div>
    </Dialog>
  );
}

const when = (ts: number) => (ts ? new Date(ts).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function InfoDialog({ e, onClose }: { e: Entry; onClose: () => void }) {
  const map = useDrive((s) => s.entries);
  const where = pathTo(e.parent, map).map((x) => x.name);
  const inside = e.type === 'folder' ? descendants(e.id, map) : [];
  const rows: [string, string][] = [
    [t('Type'), e.type === 'folder' ? t('Folder') : `${kindName(kindOfEntry(e))}${e.mime ? ` · ${e.mime}` : ''}`],
    ...(e.type === 'file' ? [[t('Size'), fmtSize(e.size ?? 0)] as [string, string]] : []),
    ...(e.type === 'folder' ? [[t('Inside'), `${tn(inside.filter((x) => x.type === 'file').length, '{n} file', '{n} files')} · ${fmtSize(inside.reduce((n, x) => n + (x.size ?? 0), 0))}`] as [string, string]] : []),
    ...(e.w && e.h ? [[t('Dimensions'), `${e.w} × ${e.h}`] as [string, string]] : []),
    ...(e.pages ? [[t('Pages'), String(e.pages)] as [string, string]] : []),
    [t('Location'), [t('My Drive'), ...where].join(' › ')],
    [t('Modified'), when(e.edited)],
    [t('Created'), when(e.created)],
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={e.name}>
      {e.type === 'file' && <Preview e={e} big className="mb-4 aspect-video w-full rounded-2xl" />}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted">{t('Encrypted end-to-end: only your devices can open it.')}</p>
    </Dialog>
  );
}

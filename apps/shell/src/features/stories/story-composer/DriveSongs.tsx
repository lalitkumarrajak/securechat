import { useEffect, useMemo, useState } from 'react';
import { HardDrive, Music2, Search } from 'lucide-react';
import { Button, Spinner } from '@sanga/ui/button';
import { Input } from '@sanga/ui/input';
import { appModule } from '../../../lib/apps';
import { t } from '@sanga/i18n';

interface DriveSong { id: string; name: string; size: number; edited: number; folder: string }
type Songs = Promise<DriveSong[]>; // i18n-ok
type Opened = Promise<File>; // i18n-ok
interface Picker { MAX_SONG: number; driveSongs: () => Songs; openDriveSong: (id: string, onProgress?: (p: number) => void) => Opened }
const picker = (): Promise<Picker> => appModule('drive', './picker'); // i18n-ok

const mb = (n: number) => `${(n / 1e6).toFixed(n < 10e6 ? 1 : 0)} MB`; // i18n-ok

/** The songs in your Drive, to search and pick one. Opens it (on this device, as Drive does) and hands it on. */
export function DriveSongs({ onOpen, onBack }: { onOpen: (file: File) => void; onBack: () => void }) {
  const [songs, setSongs] = useState<DriveSong[] | null>(null);
  const [max, setMax] = useState(Infinity);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [opening, setOpening] = useState<{ id: string; p: number } | null>(null);

  useEffect(() => {
    let live = true;
    picker().then(async (m) => { const list = await m.driveSongs(); if (live) { setSongs(list); setMax(m.MAX_SONG); } })
      .catch(() => { if (live) setErr(t('Couldn’t open your Drive. Check your connection and try again.')); });
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (songs ?? []).filter((x) => !s || x.name.toLowerCase().includes(s) || x.folder.toLowerCase().includes(s));
  }, [songs, q]);

  const open = async (x: DriveSong) => {
    setOpening({ id: x.id, p: 0 }); setErr('');
    try {
      const m = await picker();
      onOpen(await m.openDriveSong(x.id, (p) => setOpening((o) => (o?.id === x.id ? { id: x.id, p } : o))));
    } catch { setErr(t('Couldn’t open that song. Try again.')); }
    finally { setOpening(null); }
  };

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search your Drive’s songs')} aria-label={t('Search your Drive’s songs')} className="pl-10" autoFocus />
      </div>
      <div className="mt-3 min-h-40">
        {err ? <p className="py-10 text-center text-sm text-danger" role="alert">{err}</p> // i18n-ok
          : !songs ? <div className="grid place-items-center py-10"><Spinner /></div>
          : !songs.length ? (
            <div className="py-8 text-center">
              <HardDrive className="mx-auto size-8 text-muted" />
              <p className="mt-2 text-sm text-muted">{t('No songs in your Drive yet. Upload MP3 or M4A files there, then pick one here.')}</p>
            </div>
          )
          : !shown.length ? <p className="py-10 text-center text-sm text-muted">{t('No songs found.')}</p>
          : (
            <ul className="-mx-1 max-h-[45dvh] overflow-y-auto" aria-label={t('Songs in your Drive')}>
              {shown.map((x) => {
                const big = x.size > max, busy = opening?.id === x.id;
                return (
                  <li key={x.id}>
                    <button type="button" disabled={!!opening || big} onClick={() => void open(x)} aria-label={t('Use {title}', { title: x.name })}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-hover disabled:opacity-60">
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-300">
                        {busy ? <Spinner /> : <Music2 className="size-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{x.name}</span>
                        <span className="block truncate text-sm text-muted">
                          {busy ? t('Opening… {n}%', { n: Math.round(opening.p * 100) }) : big ? t('Too big to use (over {size})', { size: mb(max) }) : [mb(x.size), x.folder].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
      <div className="mt-3 flex justify-end"><Button variant="ghost" onClick={onBack}>{t('Back')}</Button></div>
    </div>
  );
}
